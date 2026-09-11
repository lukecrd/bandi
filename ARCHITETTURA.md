# Architettura

```text
Browser
  │
  ├── Next.js UI (Vercel)
  │     ├── Dashboard
  │     ├── Clienti
  │     ├── Bandi
  │     └── Fonti / Sync
  │
  ├── Route Handlers
  │     ├── /api/customers
  │     ├── /api/customers/import
  │     ├── /api/sync
  │     └── /api/export/matches
  │
  ├── Vercel Cron
  │     ├── sync-incentivi
  │     └── sync-eu
  │
  ├── Connectors
  │     ├── Incentivi.gov.it
  │     └── EU Funding & Tenders
  │
  └── Neon Postgres
        ├── customers
        ├── grants
        └── sync_runs
```

## Scelta progettuale

Il matching non viene salvato in una tabella: viene calcolato quando si apre il cliente o si esportano i risultati. In questo modo ogni variazione del profilo cliente o del catalogo bandi produce immediatamente un nuovo risultato senza dover mantenere una tabella derivata.

Se il numero di clienti/bandi cresce molto, il passo successivo è materializzare i match in background dopo ogni sincronizzazione.
