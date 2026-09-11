# BandiMatch Web

Applicazione web per associare un portafoglio clienti a bandi/incentivi potenzialmente rilevanti.

## Stack

- Next.js 16 App Router + TypeScript
- Vercel
- Neon Postgres
- Vercel Cron
- Incentivi.gov.it
- EU Funding & Tenders Search API
- Import clienti `.xlsx` / `.csv`

## Funzioni

- anagrafica clienti;
- import massivo del foglio CLIENTI;
- sincronizzazione delle opportunità italiane;
- sincronizzazione call/topic UE;
- normalizzazione dei bandi in Postgres;
- score cliente ↔ bando 0-100;
- filtri e dashboard;
- link alle fonti ufficiali;
- export CSV dei match;
- login con password;
- cron giornalieri;
- storico delle sincronizzazioni.

## Score

| Fattore | Peso |
|---|---:|
| Regione | 25 |
| Dimensione | 15 |
| ATECO | 15 |
| Temi | 25 |
| Investimento | 10 |
| Tempistica | 10 |
| Totale | 100 |

Classi:
- ALTA: >= 75
- MEDIA: 50-74
- BASSA: < 50

`MATCH_MIN_SCORE` controlla la soglia minima mostrata dall'app.

## Avvio locale

Richiede Node.js >= 20.9.

```bash
cp .env.example .env.local
npm install
npm run db:init
npm run db:seed
npm run dev
```

Apri `http://localhost:3000`.

## Deploy su Vercel

### 1. Repository

Crea un repository GitHub e carica la cartella del progetto.

### 2. Crea il progetto Vercel

Da Vercel:
- **Add New → Project**
- importa il repository;
- Vercel rileva automaticamente Next.js.

### 3. Collega Neon

Dal Marketplace Vercel installa **Neon** e collegalo al progetto. Neon/Vercel fornisce la connection string Postgres. Inseriscila come:

```text
DATABASE_URL=...
```

Riferimenti:
- https://vercel.com/integrations/neon
- https://neon.com/docs/serverless/serverless-driver

### 4. Environment Variables

Configura in Vercel → Project → Settings → Environment Variables:

```text
DATABASE_URL
APP_PASSWORD
AUTH_SECRET
CRON_SECRET
MATCH_MIN_SCORE=50
INCENTIVI_PAGE_ROWS=200
INCENTIVI_MAX_PAGES=35
EU_PAGE_SIZE=50
EU_MAX_PAGES=20
EU_INCLUDE_FORTHCOMING=true
EU_PROGRAMME_FILTER=
```

Genera `AUTH_SECRET` e `CRON_SECRET` come valori lunghi e casuali.

### 5. Inizializza il database

Metodo consigliato: apri il SQL Editor di Neon e incolla `db/schema.sql`.

In alternativa, in locale dopo avere impostato `DATABASE_URL`:

```bash
npm run db:init
```

Per inserire i due clienti demo:

```bash
npm run db:seed
```

### 6. Primo deploy

Dopo il deploy:
1. accedi con `APP_PASSWORD`;
2. apri **Fonti & Sync**;
3. esegui **Sincronizza Italia**;
4. esegui **Sincronizza UE**;
5. importa i clienti oppure creali manualmente.

### 7. Cron

`vercel.json` registra due job giornalieri:

```text
04:15 UTC /api/cron/sync-incentivi
04:45 UTC /api/cron/sync-eu
```

Sui piani Vercel Hobby i cron giornalieri hanno precisione oraria, quindi l'invocazione può avvenire in qualunque momento dell'ora configurata. Il progetto verifica `Authorization: Bearer <CRON_SECRET>`.

Documentazione:
- https://vercel.com/docs/cron-jobs

## Fonte UE

La query usa la Search API pubblica del Funding & Tenders Portal:

- documentazione: https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/support/apis
- endpoint: https://api.tech.ec.europa.eu/search-api/prod/rest/search

## Fonte italiana

La query `lib/sources/incentivi.ts` usa l'endpoint JSON dell'export Open Data del portale Incentivi.gov.it.

È volutamente isolato in un singolo modulo: se il portale modifica il proprio endpoint o la struttura dei campi, si aggiorna soltanto quel connettore senza modificare database, UI o scoring.

## Import Excel

Il parser riconosce le intestazioni del modello originale, tra cui:

```text
ID_Cliente
Ragione_sociale
Regione
Provincia
ATECO
Dimensione
Dipendenti
Fatturato_EUR
Investimento_previsto_EUR
Digitale
Green
R&S
Cloud_Cyber
Investimenti_beni
Export
Formazione
Note
```

`ID_Cliente` è la chiave di aggiornamento: un successivo import con lo stesso ID aggiorna il cliente.

## Sicurezza

Questa versione è pensata come MVP privato:
- password applicativa;
- cookie HttpOnly firmato HMAC;
- cron protetti da `CRON_SECRET`;
- database e segreti solo tramite Environment Variables.

Per un'app multiutente o commerciale è consigliato sostituire il login con Better Auth / Auth.js / SSO e introdurre ruoli e audit log.

## Limite importante

Il matching è un pre-screening. La piattaforma deve sempre indirizzare alla fonte ufficiale e non deve presentare lo score come conferma di ammissibilità.
