import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "bandi.db");

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    ragione_sociale TEXT NOT NULL,
    partita_iva TEXT,
    citta TEXT,
    codici_ateco TEXT,
    settore TEXT,
    regione TEXT,
    taglia_aziendale TEXT,
    requisiti TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bands (
    id TEXT PRIMARY KEY,
    titolo TEXT NOT NULL,
    ente TEXT,
    regione TEXT,
    settore TEXT,
    importo TEXT,
    scadenza TEXT,
    requisiti TEXT,
    descrizione TEXT,
    link TEXT,
    source TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    band_id TEXT NOT NULL,
    score REAL NOT NULL,
    motivazione TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (band_id) REFERENCES bands(id)
  );

  CREATE INDEX IF NOT EXISTS idx_matches_client ON matches(client_id);
  CREATE INDEX IF NOT EXISTS idx_matches_band ON matches(band_id);
  CREATE INDEX IF NOT EXISTS idx_clients_settore ON clients(settore);
  CREATE INDEX IF NOT EXISTS idx_clients_regione ON clients(regione);
  CREATE INDEX IF NOT EXISTS idx_bands_settore ON bands(settore);
  CREATE INDEX IF NOT EXISTS idx_bands_regione ON bands(regione);

  CREATE TABLE IF NOT EXISTS domande (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    band_id TEXT NOT NULL,
    stato TEXT DEFAULT 'bozza',
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (band_id) REFERENCES bands(id),
    UNIQUE(client_id, band_id)
  );

  CREATE TABLE IF NOT EXISTS documenti (
    id TEXT PRIMARY KEY,
    domanda_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    path TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (domanda_id) REFERENCES domande(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS moduli (
    id TEXT PRIMARY KEY,
    domanda_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    stato TEXT DEFAULT 'vuoto',
    dati TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (domanda_id) REFERENCES domande(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_domande_client ON domande(client_id);
  CREATE INDEX IF NOT EXISTS idx_domande_band ON domande(band_id);
  CREATE INDEX IF NOT EXISTS idx_documenti_domanda ON documenti(domanda_id);
  CREATE INDEX IF NOT EXISTS idx_moduli_domanda ON moduli(domanda_id);
`);

const clientColumns = new Set(
  (db.prepare("PRAGMA table_info(clients)").all() as Array<{ name: string }>).map(({ name }) => name),
);
if (!clientColumns.has("citta")) db.exec("ALTER TABLE clients ADD COLUMN citta TEXT");
if (!clientColumns.has("codici_ateco")) db.exec("ALTER TABLE clients ADD COLUMN codici_ateco TEXT");

db.exec(`
  DELETE FROM matches
  WHERE rowid NOT IN (SELECT MAX(rowid) FROM matches GROUP BY client_id, band_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_client_band ON matches(client_id, band_id);
`);

export default db;
