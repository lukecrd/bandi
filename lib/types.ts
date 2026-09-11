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
  created_at: string;
  updated_at: string;
};

export type CustomerInput = Omit<
  Customer,
  "id" | "created_at" | "updated_at"
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

export type SyncSource = "incentivi" | "eu";
