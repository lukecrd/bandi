// Self-check offline per lib/sources/rna.ts — run: npx tsx scripts/check-rna.ts
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { finestra, scanMese } from "../lib/sources/rna";

function zip(xml: string, method = 8, level = 9) {
  const dati = deflateRawSync(Buffer.from(xml), { level });
  const nome = Buffer.from("OpenData.xml");
  const testa = Buffer.alloc(30);
  testa.writeUInt32LE(0x04034b50, 0);
  testa.writeUInt16LE(method, 8);
  testa.writeUInt32LE(dati.length, 18);
  testa.writeUInt16LE(nome.length, 26);
  testa.writeUInt16LE(3, 28); // campo extra
  // in coda l'inizio della directory centrale, come nei file reali
  return Buffer.concat([testa, nome, Buffer.alloc(3), dati, Buffer.from("PK\x01\x02"), Buffer.alloc(120)]);
}

async function* pezzi(buf: Buffer, size: number) {
  for (let i = 0; i < buf.length; i += size) yield buf.subarray(i, i + size);
}

type Comp = [procedimento: string, regolamento: string, ...strumenti: [elemento: string, nominale: string][]];
const aiuto = (cf: string, cor: string, data: string, ...componenti: Comp[]) => `
    <AIUTO>
        <CAR>00042</CAR>
        <TITOLO_MISURA>Attività &amp; qualità &#13;
          «à»</TITOLO_MISURA>
        <SOGGETTO_CONCEDENTE>Società &lt;X&gt;</SOGGETTO_CONCEDENTE>
        <COR>${cor}</COR>
        <TITOLO_PROGETTO>n.d.</TITOLO_PROGETTO>
        <DATA_CONCESSIONE>${data}</DATA_CONCESSIONE>
        <CODICE_FISCALE_BENEFICIARIO>${cf}</CODICE_FISCALE_BENEFICIARIO>
        <COMPONENTI_AIUTO>${componenti.map(([proc, reg, ...strumenti]) => `
            <COMPONENTE_AIUTO>
                <COD_PROCEDIMENTO>${proc}</COD_PROCEDIMENTO>
                <DES_REGOLAMENTO>${reg}</DES_REGOLAMENTO>
                <STRUMENTI_AIUTO>${strumenti.map(([e, n]) => `
                    <STRUMENTO_AIUTO><ELEMENTO_DI_AIUTO>${e}</ELEMENTO_DI_AIUTO><IMPORTO_NOMINALE>${n}</IMPORTO_NOMINALE></STRUMENTO_AIUTO>`).join("")}
                </STRUMENTI_AIUTO>
            </COMPONENTE_AIUTO>`).join("")}
        </COMPONENTI_AIUTO>
    </AIUTO>`;
const lista = (...aiuti: string[]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<LISTA_AIUTI xmlns="http://www.rna.it/RNA_aiuto/schema">${aiuti.join("")}\n</LISTA_AIUTI>\n`;

const CF = "00123456789";
const cfs = new Set([CF]);
const xml = lista(
  aiuto("99999999999", "1", "2026-10-01", ["1", "altro", ["5.00", "5.00"]]),
  aiuto(CF, "0007", "2026-10-05",
    ["1", "Reg. UE  2831/2023", ["0.10", "100.00"], ["0.20", "50.50"]],
    ["3", "Esenzione", ["1000.00", "9000.00"]],
    ["1", "Reg. UE 2831/2023", ["10.00", "20.00"]]),
  aiuto(CF, "2", "2026-10-06", ["3", "Esenzione", ["7.00", "7.00"]]),
  aiuto(CF, "3", "2026-10-07", ["1", "Agricolo", ["1.00", "2.00"]])
);
const atteso = [
  {
    cf: CF,
    aiuto: {
      cor: "0007", car: "00042", misura: "Attività & qualità «à»", progetto: "n.d.", concedente: "Società <X>",
      data_concessione: "2026-10-05", regolamento: "Reg. UE 2831/2023", elemento_aiuto: 10.3, importo_nominale: 170.5,
    },
  },
  {
    cf: CF,
    aiuto: {
      cor: "3", car: "00042", misura: "Attività & qualità «à»", progetto: "n.d.", concedente: "Società <X>",
      data_concessione: "2026-10-07", regolamento: "Agricolo", elemento_aiuto: 1, importo_nominale: 2,
    },
  },
];

async function main() {
  // blocchi deflate non compressi a un byte per volta: il testo si spezza in ogni punto, caratteri multibyte compresi
  for (const level of [0, 9]) {
    const buf = zip(xml, 8, level);
    for (const size of [1, 7, buf.length]) assert.deepEqual(await scanMese(pezzi(buf, size), cfs), atteso);
  }

  // mai "nessun aiuto" da un file incompleto o di formato diverso
  await assert.rejects(scanMese(pezzi(zip(xml.slice(0, -20)), 64), cfs), /troncato/);
  await assert.rejects(scanMese(pezzi(zip(xml).subarray(0, 200), 64), cfs));
  await assert.rejects(scanMese(pezzi(zip(xml).subarray(0, 20), 64), cfs));
  await assert.rejects(scanMese(pezzi(Buffer.alloc(0), 64), cfs));
  await assert.rejects(scanMese(pezzi(zip(lista()), 64), cfs), /vuoto/);
  await assert.rejects(scanMese(pezzi(zip(xml, 0), 64), cfs), /ZIP inatteso/);
  await assert.rejects(scanMese(pezzi(Buffer.from("<html>pagina di errore, non uno zip</html>"), 64), cfs), /ZIP inatteso/);
  await assert.rejects(scanMese(pezzi(zip(xml.replaceAll("CODICE_FISCALE_BENEFICIARIO", "CF")), 64), cfs), /senza codice fiscale/);
  await assert.rejects(scanMese(pezzi(zip(lista(aiuto(CF, "4", "2026-10-07", ["1", "Reg", ["", "2.00"]]))), 64), cfs), /ELEMENTO_DI_AIUTO/);
  await assert.rejects(scanMese(pezzi(zip(xml.replaceAll("COD_PROCEDIMENTO", "PROC")), 64), cfs), /componenti inattese/);
  await assert.rejects(scanMese(pezzi(zip(xml.replaceAll("STRUMENTO_AIUTO>", "STR>")), 64), cfs), /strumenti mancanti/);
  const voce = zip(lista(aiuto("99999999999", "1", "2026-10-01", ["3", "altro", ["5.00", "5.00"]]))).subarray(0, -124);
  for (const size of [1, 7, 9999]) {
    await assert.rejects(scanMese(pezzi(Buffer.concat([voce, zip(xml)]), size), cfs), /più voci/);
  }

  const { mesi, dal } = finestra(new Date("2026-11-24T10:00:00Z"));
  assert.deepEqual([mesi.length, mesi[0], mesi[10], mesi[11], mesi[36], dal], [37, "2026_11", "2026_01", "2025_12", "2023_11", "2023-11-24"]);
  assert.equal(finestra(new Date("2026-03-31T10:00:00Z")).mesi[1], "2026_02");

  console.log("rna OK");
}

main();
