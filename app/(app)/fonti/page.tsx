import { StatusBadge } from "@/components/status-badge";
import { SyncButtons } from "@/components/sync-buttons";
import { getRecentSyncRuns } from "@/lib/data";

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
      </div>

      <div style={{ height: 18 }} />

      <section className="card">
        <h2>Automazione</h2>
        <p>
          Vercel Cron esegue due job separati ogni giorno: Italia nell'ora delle 04 UTC e UE nell'ora delle 04 UTC.
          Su piani con precisione al minuto sono configurati rispettivamente 04:15 e 04:45 UTC; su Hobby l'esecuzione può avvenire in qualunque momento dell'ora.
        </p>
        <div className="code">{`vercel.json
04:15 UTC  /api/cron/sync-incentivi
04:45 UTC  /api/cron/sync-eu`}</div>
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
                <td>{run.source === "eu" ? "EU Funding & Tenders" : "Incentivi.gov.it"}</td>
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
