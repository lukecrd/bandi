import { XMLParser } from "fast-xml-parser";
import db from "@/lib/db";
import { Band } from "@/lib/types";

export async function fetchEUDeals(): Promise<Partial<Band>[]> {
  try {
    const res = await fetch("https://api.ted.europa.eu/v3/notices/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "buyer-country=ITA AND PD>=20260101",
        fields: ["notice-title", "buyer-name", "buyer-country", "total-value", "total-value-cur", "deadline", "publication-date", "contract-nature", "links"],
        limit: 30,
        scope: "ACTIVE",
      }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const notices = data.notices ?? data.results ?? [];
    return notices.map((item: any) => {
      const titleRaw = item["notice-title"];
      const buyerRaw = item["buyer-name"];
      const totalValue = item["total-value"];
      const deadlineRaw = item["deadline"];
      const links = item["links"];
      const noticeUrl = links?.html?.ITA || links?.html?.ENG || "";
      const getFirstString = (val: any): string => {
        if (typeof val === "string") return val;
        if (Array.isArray(val) && val.length > 0) return val[0];
        return "";
      };
      const title = typeof titleRaw === "object" && titleRaw !== null
        ? getFirstString(titleRaw.eng) || getFirstString(titleRaw.ita) || (((Object.values(titleRaw)) as any[])[0]?.[0] ?? "")
        : titleRaw || "";
      const ente = typeof buyerRaw === "object" && buyerRaw !== null
        ? getFirstString(buyerRaw.eng) || getFirstString(buyerRaw.ita) || (((Object.values(buyerRaw)) as any[])[0]?.[0] ?? "")
        : buyerRaw || "";
      const deadline = typeof deadlineRaw === "string" ? deadlineRaw.substring(0, 10) : "";
      const settore = Array.isArray(item["contract-nature"]) ? item["contract-nature"].filter(Boolean).join(", ") : item["contract-nature"] || "";
      return {
        titolo: title,
        ente,
        regione: "",
        settore,
        importo: totalValue ? `${totalValue} ${item["total-value-cur"] || "EUR"}` : "",
        scadenza: deadline,
        descrizione: "",
        requisiti: "",
        link: noticeUrl || `https://ted.europa.eu/en/notice/-/detail/${item["publication-number"] || ""}`,
        source: "EU TED",
      };
    });
  } catch {
    return [];
  }
}

export async function fetchItalianBands(): Promise<Partial<Band>[]> {
  try {
    const res = await fetch("https://www.datos.it/api/bandi?size=30", {
      next: { revalidate: 3600 },
    }).catch(() => null);
    if (!res || !res.ok) return [];
    const data = await res.json();
    return (data.content ?? []).map((item: any) => ({
      titolo: item.title || item.titolo || "",
      ente: item.ente || "",
      regione: item.regione || "",
      settore: item.settore || "",
      importo: item.importo || "",
      scadenza: item.scadenza || "",
      descrizione: item.descrizione || "",
      requisiti: item.requisiti || "",
      link: item.link || "",
      source: "Datos.it",
    }));
  } catch {
    return [];
  }
}

const RNA_LATEST_YEAR = 2026;
const RNA_LATEST_MONTH = 8;

function rnaOpenDataUrl(year: number, month: number): string {
  return `https://www.rna.gov.it/sites/rna.mise.gov.it/files/opendata/OpenData_Aiuti_${year}_${String(month).padStart(2, "0")}.xml`;
}

export async function fetchRNABands(): Promise<Partial<Band>[]> {
  // The RNA publishes a new open-data file every month; try the current month first,
  // then fall back to progressively earlier months since the latest one may not be
  // published yet (or may have already been superseded/removed).
  let year = RNA_LATEST_YEAR;
  let month = RNA_LATEST_MONTH;
  for (let attempt = 0; attempt < 6; attempt++) {
    const result = await fetchRNABandsFromUrl(rnaOpenDataUrl(year, month));
    if (result.length > 0) return result;
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  return [];
}

async function fetchRNABandsFromUrl(url: string): Promise<Partial<Band>[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok || !res.body) return [];

    const streamReader = res.body.getReader();
    const decoder = new TextDecoder();
    let xmlText = "";
    const MAX_BYTES = 5_000_000;
    let receivedLength = 0;

    while (receivedLength < MAX_BYTES) {
      const { done, value } = await streamReader.read();
      if (done) break;
      xmlText += decoder.decode(value, { stream: true });
      receivedLength += value.length;
      const aiutoCount = (xmlText.match(/<AIUTO[ >]/g) || []).length;
      if (aiutoCount >= 30 && xmlText.includes("</AIUTO>")) break;
    }
    xmlText += decoder.decode();

    if (!xmlText.trim()) return [];

    const aiudoRegex = /<AIUTO[\s\S]*?<\/AIUTO>/g;
    const matches = xmlText.match(aiudoRegex);
    if (!matches || matches.length === 0) return [];

    const parser = new XMLParser({
      ignoreAttributes: true,
      textNodeName: "_text",
      parseAttributeValue: false,
    });

    return matches.slice(0, 30).map((block) => {
      const wrapped = `<root>${block}</root>`;
      let data;
      try {
        data = parser.parse(wrapped);
      } catch {
        return null;
      }
      const rootChild = Object.keys(data?.root ?? {})[0];
      const item = data?.root?.[rootChild];
      if (!item) return null;
      const getVal = (obj: any, keys: string[]): string => {
        if (!obj) return "";
        for (const key of keys) {
          const v = obj[key];
          if (typeof v === "string" && v.trim()) return v.trim();
          if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return v[0].trim();
        }
        const instruments = obj?.COMPONENTI_AIUTO?.COMPONENTE_AIUTO;
        if (Array.isArray(instruments)) {
          for (const comp of instruments) {
            const strumenti = comp?.STRUMENTI_AIUTO?.STRUMENTO_AIUTO;
            const strArray = Array.isArray(strumenti) ? strumenti : [strumenti];
            for (const str of strArray) {
              for (const key of keys) {
                const v = str?.[key];
                if (typeof v === "string" && v.trim()) return v.trim();
                if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return v[0].trim();
              }
            }
          }
        }
        return "";
      };
      const titolo = getVal(item, [
        "TITOLO_MISURA",
        "TITOLO_PROGETTO",
        "DES_AIUTO",
        "DENOMINAZIONE_AIUTO",
        "DENOMINAZIONE",
        "DES_MISURA",
        "TITOLO",
        "nome",
        "denominazione",
      ]);
      const ente = getVal(item, [
        "SOGGETTO_CONCEDENTE",
        "DENOMINAZIONE_SOGGETTO_GESTORE",
        "DENOMINAZIONE_GESTORE",
        "ENTE",
        "ente",
        "soggetto",
        "gestore",
      ]);
      const regione = getVal(item, [
        "REGIONE_BENEFICIARIO",
        "REGIONE",
        "regione",
        "codice_regione",
        "des_regione",
      ]);
      const settore = getVal(item, [
        "SETTORE_ATTIVITA",
        "CODICE_ATECO",
        "ATECO",
        "settore",
        "des_settore",
        "categoria",
        "CAR",
      ]);
      const importo = getVal(item, [
        "IMPORTO_NOMINALE",
        "ELEMENTO_DI_AIUTO",
        "IMPORTO_AMMESSO",
        "IMPORTO",
        "importo",
        "ammontare",
        "totale",
      ]);
      const scadenza = getVal(item, [
        "DATA_CONCESSIONE",
        "DATA_SCADENZA",
        "DATA_TERMINE",
        "scadenza",
        "deadline",
      ]);
      const link = getVal(item, [
        "LINK_TRASPARENZA_NAZIONALE",
        "LINK_TESTO_INTEGRALE_MISURA",
        "LINK_RIFERIMENTO",
        "LINK",
        "url",
        "link",
      ]);
      return {
        titolo: titolo || "Aiuto di Stato",
        ente: ente || "RNA",
        regione: regione || "",
        settore: settore || "",
        importo: importo ? `${importo} EUR` : "",
        scadenza: scadenza ? scadenza.substring(0, 10) : "",
        descrizione: item?.DESCRIZIONE_PROGETTO || "",
        requisiti: "",
        link: link || "https://www.rna.gov.it/",
        source: "RNA",
      };
    }).filter(Boolean) as Partial<Band>[];
  } catch {
    return [];
  }
}

export function generateMockBands(): Partial<Band>[] {
  return [
    {
      titolo: "Progetto di trasformazione digitale per PMI",
      ente: "Ministero delle Imprese e del Made in Italy",
      regione: "Lombardia",
      settore: "Technologie",
      importo: "2.000.000 EUR",
      scadenza: "2026-12-31",
      descrizione: "Finanziamento per la digitalizzazione delle piccole e medie imprese attraverso l'adozione di tecnologie avanzate.",
      requisiti: "Partita IVA attiva, fatturato annuo < 5M EUR, sede legale in Italia",
      link: "https://example.com/bando/1",
      source: "Simulato",
    },
    {
      titolo: "Bando per l'Innovazione nel Settore Agroalimentare",
      ente: "Regione Lazio",
      regione: "Lazio",
      settore: "Agricoltura",
      importo: "1.500.000 EUR",
      scadenza: "2026-11-30",
      descrizione: "Supporto all'innovazione tecnologica nel settore agroalimentare attraverso interventi di trasformazione e commercializzazione.",
      requisiti: "Impresa agricola iscritta alla Camera di Commercio, presenza in regione Lazio",
      link: "https://example.com/bando/2",
      source: "Simulato",
    },
    {
      titolo: "Programma di Sostegno alle Start-up Innovative",
      ente: "Invitalia",
      regione: "Campania",
      settore: "Innovazione",
      importo: "500.000 EUR",
      scadenza: "2026-10-15",
      descrizione: "Borse di investimento per start-up innovative con potenziale di crescita elevato.",
      requisiti: "Start-up costituita da meno di 5 anni, brevetto o know-how innovativo",
      link: "https://example.com/bando/3",
      source: "Simulato",
    },
    {
      titolo: "Appalto per Servizi di Manutenzione Infrastrutture Scolastiche",
      ente: "Comune di Milano",
      regione: "Lombardia",
      settore: "Edilizia",
      importo: "3.500.000 EUR",
      scadenza: "2026-08-20",
      descrizione: "Appalto per servizi di manutenzione straordinaria e ordinaria delle infrastrutture scolastiche.",
      requisiti: "Requisiti SOF, esperienza pregressa 5 anni, idoneità morale e professionale",
      link: "https://example.com/bando/4",
      source: "Simulato",
    },
    {
      titolo: "Bando per l'Efficienza Energetica degli Edifici Pubblici",
      ente: "ENRAL (Ente Nazionale per la Transizione Energetica)",
      regione: "Veneto",
      settore: "Energia",
      importo: "4.000.000 EUR",
      scadenza: "2026-09-30",
      descrizione: "Interventi di riqualificazione energetica di edifici pubblici con obiettivo di riduzione consumi del 40%.",
      requisiti: "Ente pubblico o privativo con finalità pubblica, certificazione energetica inferiore a F",
      link: "https://example.com/bando/5",
      source: "Simulato",
    },
    {
      titolo: "Contributi per Internazionalizzazione delle PMI",
      ente: "ICE - Agenzia per la promozione all'estero",
      regione: "Emilia-Romagna",
      settore: "Commercio",
      importo: "800.000 EUR",
      scadenza: "2026-11-15",
      descrizione: "Sostegno alle PMI per l'apertura di nuovi mercati esteri e partecipazione a fiere internazionali.",
      requisiti: "Fatturato estero < 50% del totale, presenza in almeno 3 Paesi",
      link: "https://example.com/bando/6",
      source: "Simulato",
    },
  ];
}

export function upsertBands(bands: Partial<Band>[]) {
  for (const band of bands) {
    const existing = db
      .prepare("SELECT id FROM bands WHERE titolo = ? AND source = ?")
      .get(band.titolo, band.source ?? "Simulato");
    if (!existing) {
      const id = crypto.randomUUID();
      db.prepare(
        `INSERT INTO bands (id, titolo, ente, regione, settore, importo, scadenza, requisiti, descrizione, link, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        id,
        band.titolo || "",
        band.ente || "",
        band.regione || "",
        band.settore || "",
        band.importo || "",
        band.scadenza || "",
        band.requisiti || "",
        band.descrizione || "",
        band.link || "",
        band.source || "Simulato"
      );
    }
  }
}

export async function fetchAllExternalBands(): Promise<Partial<Band>[]> {
  const [euBands, itBands, rnaBands] = await Promise.all([
    fetchEUDeals(),
    fetchItalianBands(),
    fetchRNABands(),
  ]);
  return [...euBands, ...itBands, ...rnaBands];
}
