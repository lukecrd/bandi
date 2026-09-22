export interface Client {
  id: string;
  ragione_sociale: string;
  partita_iva: string;
  citta: string;
  codici_ateco: string;
  settore: string;
  regione: string;
  taglia_aziendale: string;
  requisiti: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface Band {
  id: string;
  titolo: string;
  ente: string;
  regione: string;
  settore: string;
  importo: string;
  scadenza: string;
  requisiti: string;
  descrizione: string;
  link: string;
  source: string;
  created_at: string;
}

export interface Match {
  id: string;
  client_id: string;
  band_id: string;
  score: number;
  motivazione: string;
  created_at: string;
}

export interface ClientInput {
  ragione_sociale: string;
  partita_iva: string;
  citta: string;
  codici_ateco: string;
  settore: string;
  regione: string;
  taglia_aziendale: string;
  requisiti: string;
  note: string;
}

export interface BandInput {
  titolo: string;
  ente: string;
  regione: string;
  settore: string;
  importo: string;
  scadenza: string;
  requisiti: string;
  descrizione: string;
  link: string;
  source: string;
}

export interface ImportRow {
  ragione_sociale: string;
  partita_iva: string;
  regione: string;
  citta: string;
  codici_ateco: string;
}

export interface MatchResult {
  band: Band;
  score: number;
  motivazione: string;
}

export type DocumentType = "iban" | "iscrizione_inps" | "polizza_catastrofale" | "visura" | "fatture" | "quietanza";

export type ModuloType = "domanda_bando" | "delega_bando" | "allegato_a" | "dichiarazione_inps";

export type DomandaStatus = "bozza" | "in_compilazione" | "pronta" | "inviata" | "errata";

export interface Domanda {
  id: string;
  client_id: string;
  band_id: string;
  stato: DomandaStatus;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface Documento {
  id: string;
  domanda_id: string;
  nome: string;
  tipo: DocumentType;
  size: number;
  path: string;
  created_at: string;
}

export interface Modulo {
  id: string;
  domanda_id: string;
  tipo: ModuloType;
  stato: "vuoto" | "parziale" | "completo" | "revisione";
  dati: Record<string, { valore: string; fonte: string; compilato: boolean } | string>;
  created_at: string;
  updated_at: string;
}

export interface CampoModulo {
  id: string;
  modulo_id: string;
  nome: string;
  valore: string;
  fonte_documento?: string;
  fonte_dato?: string;
}

export interface DomandaInput {
  client_id: string;
  band_id: string;
  note?: string;
}

export interface DocumentoInput {
  nome: string;
  tipo: DocumentType;
  size: number;
  path: string;
}

export interface ModuloTemplate {
  tipo: ModuloType;
  titolo: string;
  descrizione: string;
  campi: CampoTemplate[];
}

export interface CampoTemplate {
  nome: string;
  etichetta: string;
  tipo: "testo" | "numero" | "data" | "selezione" | "textarea";
  obbligatorio: boolean;
  documento_fonte?: DocumentType[];
  dato_fonte?: string;
}
