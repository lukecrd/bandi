# BandiMatch

Applicazione web Next.js per la ricerca di bandi pubblici in Italia e Europa, la gestione di clienti e il match automatico tra requisiti dei clienti e bandi disponibili.

## Funzionalità Principali

### 📊 Dashboard
- Statistiche generali (clienti, bandi, match)
- Grafici settimanali e distribuzione per settore
- Bandi recenti e distribuzione clienti per regione

### 👥 Clienti
- CRUD completo (crea, leggi, aggiorna, elimina)
- Ricerca, filtro per settore e regione
- Importazione da Excel (.xlsx, .xls, .csv)

### 🔍 Bandi
- Lista bandi con dati da API pubbliche (EU TED, Datos.it) e dati simulati
- Ricerca per titolo/ente
- Filtri per settore, regione e fonte
- Link diretto ai bandi originali

### 🤝 Match Bandi-Clienti
- Algoritmo di matching automatico basato su:
  - Allineamento regionale (30 punti)
  - Coerenza settoriale (30 punti)
  - Compatibilità taglia aziendale (10 punti)
  - Requisiti comuni (fino a 30 punti)
  - Scadenza imminente (5 punti)
- Visualizzazione punteggio e motivazione

## Stack Tecnologico

- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind CSS v4
- **Database**: SQLite (better-sqlite3)
- **Grafici**: Recharts
- **Importazione**: SheetJS (xlsx)
- **Icone**: Lucide React

## Avvio

```bash
# Installa le dipendenze
npm install

# Popola il database con dati di esempio
npm run seed

# Avvia il server di sviluppo
npm run dev
```

L'applicazione sarà disponibile su http://localhost:3000
