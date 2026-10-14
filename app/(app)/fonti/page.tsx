import { StatusBadge } from "@/components/status-badge";
import { SyncButtons } from "@/components/sync-buttons";
import { getRecentSyncRuns } from "@/lib/data";
import { sourceLabel } from "@/lib/sync-sources";

export const dynamic = "force-dynamic";

function dt(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function SourcesPage() {
  const runs = await getRecentSyncRuns();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fonti & sincronizzazione</h1>
          <p>Aggiornamento del catalogo italiano ed europeo.</p>
        </div>
        <SyncButtons />
      </div>

      <div className="grid two">
        <section className="card source-card">
          <span className="badge open">Fonte ufficiale italiana</span>
          <strong>Incentivi.gov.it</strong>
          <p className="muted">
            Catalogo nazionale degli incentivi. Il connettore normalizza territorio,
            dimensione, date, forma di sostegno e descrizione.
          </p>
          <a className="btn secondary" target="_blank" rel="noreferrer" href="https://www.incentivi.gov.it/">Apri il portale</a>
        </section>

        <section className="card source-card">
          <span className="badge open">Fonte ufficiale UE</span>
          <strong>EU Funding & Tenders Portal</strong>
          <p className="muted">
            Search API ufficiale della Commissione europea per call e topic aperti o in arrivo.
          </p>
          <a className="btn secondary" target="_blank" rel="noreferrer" href="https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/support/apis">Documentazione API</a>
        </section>

        <section className="card source-card">
          <span className="badge open">Fonte camerale</span>
          <strong>CCIAA Maremma e Tirreno</strong>
          <p className="muted">
            Bandi camerali per le imprese di Livorno e Grosseto. Il sito non espone un&apos;API pubblica:
            il connettore legge la pagina elenco e le pagine di dettaglio dei singoli bandi.
          </p>
          <a className="btn secondary" target="_blank" rel="noreferrer" href="https://www.lg.camcom.it/bandi">Apri il portale</a>
        </section>

        <section className="card source-card">
          <span className="badge open">Fonte regionale</span>
          <strong>Sviluppo Toscana</strong>
          <p className="muted">
            Bandi FESR e regionali gestiti per Regione Toscana. Il connettore legge l&apos;elenco dei bandi
            aperti e in arrivo e, dal dettaglio, destinatari, temi e scadenza.
          </p>
          <a className="btn secondary" target="_blank" rel="noreferrer" href="https://www.sviluppo.toscana.it/bandi/">Apri il portale</a>
        </section>

        <section className="card source-card">
          <span className="badge open">Fonte camerale</span>
          <strong>CCIAA Firenze e CCIAA Bergamo</strong>
          <p className="muted">
            Stesso template del sito della CCIAA Maremma e Tirreno: lo scraper camerale è condiviso.
            Per aggiungere un&apos;altra Camera basta una voce in <code>lib/sources/camcom.ts</code>.
          </p>
          <div className="actions">
            <a className="btn secondary" target="_blank" rel="noreferrer" href="https://www.fi.camcom.gov.it/bandi">Firenze</a>
            <a className="btn secondary" target="_blank" rel="noreferrer" href="https://www.bg.camcom.it/bandi">Bergamo</a>
          </div>
        </section>
      </div>

      <div style={{ height: 18 }} />

      <section className="card">
        <h2>Automazione</h2>
        <p>
          Vercel Cron esegue un job separato per ogni fonte, ogni giorno. Su piani con precisione al minuto
          gli orari sono quelli indicati; su Hobby l&apos;esecuzione può avvenire in qualunque momento dell&apos;ora.
        </p>
        <div className="code">{`vercel.json
04:15 UTC  /api/cron/sync-incentivi
04:45 UTC  /api/cron/sync-eu
05:15 UTC  /api/cron/sync-camcom-lg
05:30 UTC  /api/cron/sync-source/sviluppo-toscana
05:45 UTC  /api/cron/sync-source/camcom-fi
06:00 UTC  /api/cron/sync-source/camcom-bg`}</div>
      </section>

      <div style={{ height: 18 }} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fonte</th>
              <th>Stato</th>
              <th>Record</th>
              <th>Avvio</th>
              <th>Fine</th>
              <th>Messaggio</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{sourceLabel(run.source)}</td>
                <td><StatusBadge value={run.status} /></td>
                <td>{run.records}</td>
                <td>{dt(run.started_at)}</td>
                <td>{dt(run.finished_at)}</td>
                <td className="small">{run.message || "—"}</td>
              </tr>
            ))}
            {!runs.length && <tr><td colSpan={6} className="muted">Nessuna sincronizzazione registrata.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
