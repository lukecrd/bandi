// Document types offered by ReStart's "Allegati" step (option texts of the tipoFile select).
export const TIPI_ALLEGATO = [
  "DICHIARAZIONE SOSTITUTIVA",
  "FATTURA",
  "DOCUMENTO CONTABILE",
  "QUIETANZA PAGAMENTO",
  "RELAZIONE IMPRESA",
  "RELAZIONE CONSULENTE",
  "PERCORSO ALTERNANZA",
  "ATTO DI DELEGA",
  "MODULO DOMANDA",
  "ALTRO DOCUMENTO",
] as const;

// Vercel rejects request bodies above ~4.5 MB
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

// Uploaded files are served from the app's origin: sandbox them so an uploaded HTML/SVG can't run script there.
export function fileHeaders(file: { filename: string; mime: string }) {
  return {
    "Content-Type": file.mime,
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    "Content-Security-Policy": "sandbox",
    "X-Content-Type-Options": "nosniff",
  };
}

export type CustomerFile = {
  id: string;
  tipo: string;
  data_documento: string; // yyyy-mm-dd
  filename: string;
  mime: string;
  size: number;
  da_caricare: boolean;
};

// The bookmarklet calls /api/allegati from the portal's origin: token-authorized, no cookies, so any origin may read.
export const CORS = { "Access-Control-Allow-Origin": "*" };
