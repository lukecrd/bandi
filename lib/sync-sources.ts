// Fonti bandi sincronizzabili. L'etichetta coincide con il campo `source` dei bandi salvati.
// Modulo senza dipendenze server: lo usano anche i componenti client.
export const SYNC_SOURCES = {
  incentivi: "Incentivi.gov.it",
  eu: "EU Funding & Tenders",
  "sviluppo-toscana": "Sviluppo Toscana",
  "camcom-lg": "CCIAA Maremma e Tirreno",
  "camcom-fi": "CCIAA Firenze",
  "camcom-bg": "CCIAA Bergamo",
  "contributi-europa": "Contributi Europa",
  ted: "TED - Gare UE",
  anac: "ANAC - Gare d'appalto",
} as const;

// Gare d'appalto: nel catalogo bandi ma fuori dal matching automatico con i clienti,
// perché il punteggio (temi, dimensione, ATECO) è pensato per la finanza agevolata.
export const TENDER_SOURCES: string[] = [SYNC_SOURCES.ted, SYNC_SOURCES.anac];

export type SyncSource = keyof typeof SYNC_SOURCES;

export function isSyncSource(value: unknown): value is SyncSource {
  return typeof value === "string" && Object.hasOwn(SYNC_SOURCES, value);
}

export function sourceLabel(value: string) {
  return isSyncSource(value) ? SYNC_SOURCES[value] : value;
}
