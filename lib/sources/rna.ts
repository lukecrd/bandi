import type { IncomingMessage } from "node:http";
import { get } from "node:https";
import { pipeline } from "node:stream/promises";
import { createInflateRaw } from "node:zlib";
import { XMLParser } from "fast-xml-parser";
import { sleep } from "@/lib/sources/camcom";
import type { AiutoDeMinimis } from "@/lib/types";

// Registro Nazionale Aiuti, open data ufficiale (CC BY 4.0): uno ZIP per mese di concessione, rigenerato ogni settimana.
// La ricerca per codice fiscale del portale è dietro reCAPTCHA: qui si leggono solo i file pubblici.
const OPEN_DATA_URL = "https://www.incentivitalia.gov.it/open-data/aiuti/OpenData_Aiuti_";
const USER_AGENT = "BandiMatch/1.0 (+matching bandi-clienti)";
const CONCURRENCY = 4;
const TIMEOUT_MS = 120_000;
const MESI = 37; // tre anni mobili toccano 37 mesi di calendario

const FINE_AIUTO = "</AIUTO>";
const TAG_CF = "<CODICE_FISCALE_BENEFICIARIO>";

type Strumento = { ELEMENTO_DI_AIUTO?: string; IMPORTO_NOMINALE?: string };
type Componente = { COD_PROCEDIMENTO?: string; DES_REGOLAMENTO?: string; STRUMENTI_AIUTO?: { STRUMENTO_AIUTO?: Strumento[] } };

const parser = new XMLParser({
  parseTagValue: false, // CF, COR e CAR restano stringhe
  htmlEntities: true, // decodifica anche le entità numeriche (&#13;)
  isArray: (name) => name === "COMPONENTE_AIUTO" || name === "STRUMENTO_AIUTO",
});

// \p{Cc}: nei file ci sono caratteri di controllo, e un NUL farebbe rifiutare il JSONB
const testo = (value: unknown) => String(value ?? "").replace(/[\s\p{Cc}]+/gu, " ").trim();

function somma(strumenti: Strumento[], campo: keyof Strumento) {
  const totale = strumenti.reduce((tot, s) => tot + parseFloat(s[campo] ?? ""), 0);
  if (!Number.isFinite(totale)) throw new Error(`${campo} mancante o non numerico`);
  return Math.round(totale * 100) / 100;
}

function leggiAiuto(xml: string): AiutoDeMinimis | null {
  const aiuto = parser.parse(xml).AIUTO;
  const componenti: Componente[] = aiuto.COMPONENTI_AIUTO?.COMPONENTE_AIUTO ?? [];
  if (!componenti.length || componenti.some((c) => !c.COD_PROCEDIMENTO)) throw new Error(`COR ${testo(aiuto.COR)}: componenti inattese`);
  const deMinimis = componenti.filter((c) => c.COD_PROCEDIMENTO === "1");
  if (!deMinimis.length) return null;

  const strumenti = deMinimis.flatMap((c) => c.STRUMENTI_AIUTO?.STRUMENTO_AIUTO ?? []);
  if (!strumenti.length) throw new Error(`COR ${testo(aiuto.COR)}: strumenti mancanti`);
  const data = testo(aiuto.DATA_CONCESSIONE);
  if (!/^\d{4}-\d\d-\d\d$/.test(data)) throw new Error(`data di concessione inattesa: "${data}"`);
  return {
    cor: testo(aiuto.COR),
    car: testo(aiuto.CAR),
    misura: testo(aiuto.TITOLO_MISURA),
    progetto: testo(aiuto.TITOLO_PROGETTO),
    concedente: testo(aiuto.SOGGETTO_CONCEDENTE),
    data_concessione: data,
    regolamento: [...new Set(deMinimis.map((c) => testo(c.DES_REGOLAMENTO)))].join("; "),
    elemento_aiuto: somma(strumenti, "ELEMENTO_DI_AIUTO"),
    importo_nominale: somma(strumenti, "IMPORTO_NOMINALE"),
  };
}

/** Dati deflate dell'unica voce dello ZIP. La directory in coda va esclusa: se arriva a parte, chiude male lo stream di zlib. */
async function* datiCompressi(zip: AsyncIterable<Uint8Array>) {
  let testa = Buffer.alloc(0);
  let dopo = Buffer.alloc(0); // primi byte dopo i dati
  let mancanti = -1; // -1 = intestazione non ancora letta
  for await (const pezzo of zip) {
    let dati = pezzo;
    if (mancanti < 0) {
      testa = Buffer.concat([testa, pezzo]);
      if (testa.length < 30) continue;
      // firma, dimensione nell'intestazione (bit 3 spento), metodo deflate
      if (testa.readUInt32LE(0) !== 0x04034b50 || testa.readUInt16LE(6) & 8 || testa.readUInt16LE(8) !== 8) {
        throw new Error("formato ZIP inatteso");
      }
      const inizio = 30 + testa.readUInt16LE(26) + testa.readUInt16LE(28);
      if (testa.length < inizio) continue;
      mancanti = testa.readUInt32LE(18);
      dati = testa.subarray(inizio);
    }
    dopo = Buffer.concat([dopo, dati.subarray(mancanti, mancanti + 4 - dopo.length)]);
    dati = dati.subarray(0, mancanti);
    mancanti -= dati.length;
    yield dati;
  }
  // subito dopo deve esserci la directory: una seconda voce andrebbe persa in silenzio
  if (dopo.length < 4 || dopo.readUInt32LE(0) !== 0x02014b50) throw new Error("ZIP con più voci o troncato");
}

/** Aiuti De Minimis di un mese per i codici fiscali indicati. Lancia un errore se il file non è completo. */
export async function scanMese(zip: AsyncIterable<Uint8Array>, cfs: Set<string>) {
  const trovati: { cf: string; aiuto: AiutoDeMinimis }[] = [];

  await pipeline(zip, datiCompressi, createInflateRaw({ chunkSize: 1 << 20 }), async (xml: AsyncIterable<Buffer>) => {
    // latin1 è veloce e conserva i byte: solo i record che interessano vengono riletti come UTF-8
    let coda = "";
    let letti = 0;
    for await (const pezzo of xml) {
      coda += pezzo.toString("latin1");
      let i = 0;
      for (let fine; (fine = coda.indexOf(FINE_AIUTO, i)) >= 0; i = fine + FINE_AIUTO.length) {
        const tag = coda.indexOf(TAG_CF, i);
        // un cambio di formato non deve passare per "nessun aiuto"
        if (tag < 0 || tag > fine) throw new Error("record senza codice fiscale del beneficiario");
        letti++;
        const inizioCf = tag + TAG_CF.length;
        const cf = coda.slice(inizioCf, coda.indexOf("<", inizioCf)).trim().toUpperCase();
        if (!cfs.has(cf)) continue;
        const record = coda.slice(coda.indexOf("<AIUTO>", i), fine + FINE_AIUTO.length);
        const aiuto = leggiAiuto(Buffer.from(record, "latin1").toString("utf8"));
        if (aiuto) trovati.push({ cf, aiuto });
      }
      coda = coda.slice(i);
    }
    if (!letti || !coda.trimEnd().endsWith("</LISTA_AIUTI>")) throw new Error("file vuoto o troncato");
  });

  return trovati;
}

// node:https invece di fetch per lo stesso motivo di incentivi.ts: è lo stesso server, che a volte tronca la risposta.
function apri(url: string) {
  return new Promise<IncomingMessage>((resolve, reject) => {
    get(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) }, resolve).on("error", reject);
  });
}

async function leggiMese(mese: string, recente: boolean, cfs: Set<string>) {
  for (let tentativo = 1; ; tentativo++) {
    try {
      const risposta = await apri(`${OPEN_DATA_URL}${mese}.zip`);
      if (risposta.statusCode === 200) return await scanMese(risposta, cfs);
      risposta.destroy();
      // a inizio mese il file può non essere ancora pubblicato
      if (risposta.statusCode === 404 && recente) return [];
      throw new Error(`HTTP ${risposta.statusCode}`);
    } catch (error) {
      if (tentativo >= 3) throw new Error(`RNA open data ${mese}: ${error instanceof Error ? error.message : error}`);
      await sleep(1000 * tentativo);
    }
  }
}

/** Mesi da leggere (dal più recente, "2026_11") e prima data di concessione utile: tre anni fa, stesso giorno. */
export function finestra(oggi: Date) {
  const mesi = Array.from({ length: MESI }, (_, i) =>
    new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth() - i, 1)).toISOString().slice(0, 7).replace("-", "_")
  );
  return { mesi, dal: `${oggi.getUTCFullYear() - 3}${oggi.toISOString().slice(4, 10)}` };
}

/** Aiuti De Minimis degli ultimi tre anni per ogni codice fiscale (elenco vuoto = nessuno). Tutto o niente. */
export async function fetchDeMinimis(cfs: Set<string>) {
  const risultati = new Map([...cfs].map((cf) => [cf, [] as AiutoDeMinimis[]]));
  if (!cfs.size) return risultati;

  const oggi = new Date();
  const { mesi, dal } = finestra(oggi);
  // oltre il giorno 10 il file del mese in corso deve esserci: il 404 è un guasto, non "nessun aiuto"
  const recente = oggi.getUTCDate() <= 10 ? mesi[0] : "";
  const worker = async () => {
    for (let mese; (mese = mesi.shift()); ) {
      for (const { cf, aiuto } of await leggiMese(mese, mese === recente, cfs)) {
        if (aiuto.data_concessione >= dal) risultati.get(cf)!.push(aiuto);
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } catch (error) {
    mesi.length = 0; // gli altri worker non scaricano oltre
    throw error;
  }

  for (const aiuti of risultati.values()) aiuti.sort((a, b) => b.data_concessione.localeCompare(a.data_concessione));
  return risultati;
}
