export type Anagrafica = {
  partita_iva?: string; codice_fiscale?: string; denominazione?: string; forma_giuridica?: string;
  pec?: string; rea?: string; data_costituzione?: string; // ISO yyyy-mm-dd
  sede_indirizzo?: string; sede_cap?: string; sede_comune?: string; sede_provincia?: string; // sigla 2 lettere
  ateco?: string; capitale_sociale?: string;
  lr_nome?: string; lr_cognome?: string; lr_codice_fiscale?: string; lr_data_nascita?: string; lr_luogo_nascita?: string;
  lr_documento_tipo?: string; lr_documento_numero?: string; lr_documento_rilascio?: string; lr_documento_scadenza?: string; lr_documento_ente?: string;
  iban?: string; iban_intestatario?: string;
};

export type Customer = {
  id: string;
  external_id: string;
  ragione_sociale: string;
  regione: string;
  provincia: string | null;
  ateco: string | null;
  dimensione: string;
  dipendenti: number | null;
  fatturato_eur: number | null;
  investimento_previsto_eur: number | null;
  digitale: boolean;
  green: boolean;
  ricerca_sviluppo: boolean;
  cloud_cyber: boolean;
  investimenti_beni: boolean;
  export: boolean;
  formazione: boolean;
  note: string | null;
  anagrafica: Anagrafica;
  created_at: string;
  updated_at: string;
};

// anagrafica is written only via PATCH /api/customers/[id]; imports/sync keep the DB value
export type CustomerInput = Omit<
  Customer,
  "id" | "created_at" | "updated_at" | "anagrafica"
>;

export type Grant = {
  id: string;
  title: string;
  ente: string | null;
  level: string | null;
  status: string;
  regions: string[];
  sizes: string[];
  ateco_filter: string[];
  topics: string[];
  invest_min_eur: number | null;
  invest_max_eur: number | null;
  opening_date: string | null;
  deadline: string | null;
  aid_type: string | null;
  budget: string | null;
  url: string | null;
  source: string;
  source_updated_at: string | null;
  requirements: string | null;
  raw: unknown;
  synced_at: string;
};

export type MatchResult = {
  grant: Grant;
  score_regione: number;
  score_dimensione: number;
  score_ateco: number;
  score_temi: number;
  score_investimento: number;
  score_tempistica: number;
  score_totale: number;
  classe: "ALTA" | "MEDIA" | "BASSA";
};

export type { SyncSource } from "@/lib/sync-sources";

export type CustomerSyncSource = "teamleader";

export type IntegrationToken = {
  provider: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  updated_at: string;
};
