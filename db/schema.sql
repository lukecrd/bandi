CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL UNIQUE,
  ragione_sociale TEXT NOT NULL,
  regione TEXT NOT NULL DEFAULT '',
  provincia TEXT,
  ateco TEXT,
  dimensione TEXT NOT NULL DEFAULT 'Micro',
  dipendenti INTEGER,
  fatturato_eur NUMERIC(16,2),
  investimento_previsto_eur NUMERIC(16,2),
  digitale BOOLEAN NOT NULL DEFAULT FALSE,
  green BOOLEAN NOT NULL DEFAULT FALSE,
  ricerca_sviluppo BOOLEAN NOT NULL DEFAULT FALSE,
  cloud_cyber BOOLEAN NOT NULL DEFAULT FALSE,
  investimenti_beni BOOLEAN NOT NULL DEFAULT FALSE,
  export BOOLEAN NOT NULL DEFAULT FALSE,
  formazione BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grants (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  ente TEXT,
  level TEXT,
  status TEXT NOT NULL,
  regions TEXT[] NOT NULL DEFAULT '{}',
  sizes TEXT[] NOT NULL DEFAULT '{}',
  ateco_filter TEXT[] NOT NULL DEFAULT '{}',
  topics TEXT[] NOT NULL DEFAULT '{}',
  invest_min_eur NUMERIC(16,2),
  invest_max_eur NUMERIC(16,2),
  opening_date DATE,
  deadline DATE,
  aid_type TEXT,
  budget TEXT,
  url TEXT,
  source TEXT NOT NULL,
  source_updated_at TIMESTAMPTZ,
  requirements TEXT,
  raw JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  records INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS customers_regione_idx ON customers(regione);
CREATE INDEX IF NOT EXISTS customers_ateco_idx ON customers(ateco);
CREATE INDEX IF NOT EXISTS grants_status_idx ON grants(status);
CREATE INDEX IF NOT EXISTS grants_source_idx ON grants(source);
CREATE INDEX IF NOT EXISTS grants_deadline_idx ON grants(deadline);
CREATE INDEX IF NOT EXISTS grants_regions_gin_idx ON grants USING GIN(regions);
CREATE INDEX IF NOT EXISTS grants_topics_gin_idx ON grants USING GIN(topics);
