import Link from "next/link";
import { Kpi } from "@/components/kpi";
import { StatusBadge } from "@/components/status-badge";
import {
  getActiveGrants,
  getCustomers,
  getDashboardStats,
  getRecentSyncRuns,
} from "@/lib/data";
import { scoreAll } from "@/lib/scoring";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT").format(new Date(value));
}

export default async function Dashboard() {
  const [stats, customers, syncs] = await Promise.all([
    getDashboardStats(),
    getCustomers(),
    getRecentSyncRuns(),
  ]);

  const selected = customers[0] ?? null;
  const matches = selected
    ? scoreAll(selected, await getActiveGrants(5000)).slice(0, 8)
    : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Panoramica clienti, opportunità e aggiornamenti delle fonti.</p>
        </div>
        <div className="actions">
          <Link className="btn secondary" href="/fonti">Aggiorna fonti</Link>
          <Link className="btn" href="/clienti">Nuovo cliente</Link>
        </div>
      </div>

      <div className="grid kpis">
        <Kpi label="Clienti" value={stats.customers} />
        <Kpi label="Bandi aperti" value={stats.open_grants} />
        <Kpi label="In arrivo" value={stats.forthcoming_grants} />
        <Kpi label="Ultimo sync" value={formatDate(stats.last_sync)} />
      </div>

      <div style={{ height: 18 }} />

      <div className="grid two">
        <section className="card">
          <div className="card-title">
            <h2>Top match</h2>
            {selected && <Link href={`/clienti/${selected.id}`}>Vedi tutti →</Link>}
          </div>
          {selected ? (
            <>
              <p className="muted small">Cliente: {selected.ragione_sociale}</p>
              <div className="grid">
                {matches.map((match) => (
                  <div key={match.grant.id} style={{ borderTop: "1px solid #e4e7ec", paddingTop: 12 }}>
                    <div className="actions" style={{ justifyContent: "space-between" }}>
                      <strong>{match.grant.title}</strong>
                      <span className="score">{match.score_totale}</span>
                    </div>
                    <div className="actions" style={{ marginTop: 7 }}>
                      <StatusBadge value={match.classe} />
                      <span className="muted small">{match.grant.source}</span>
                      <span className="muted small">Scad. {formatDate(match.grant.deadline)}</span>
                    </div>
                  </div>
                ))}
                {!matches.length && <p className="muted">Nessun match sopra la soglia configurata.</p>}
              </div>
            </>
          ) : (
            <p className="muted">Carica almeno un cliente per vedere i match.</p>
          )}
        </section>

        <section className="card">
          <div className="card-title">
            <h2>Sincronizzazioni</h2>
            <Link href="/fonti">Dettagli →</Link>
          </div>
          <div className="grid">
            {syncs.slice(0, 6).map((run) => (
              <div key={run.id} className="actions" style={{ justifyContent: "space-between", borderTop: "1px solid #e4e7ec", paddingTop: 12 }}>
                <div>
                  <strong>{run.source === "eu" ? "Funding & Tenders UE" : "Incentivi.gov.it"}</strong>
                  <div className="muted small">{formatDate(run.started_at)} · {run.records} record</div>
                </div>
                <StatusBadge value={run.status} />
              </div>
            ))}
            {!syncs.length && <p className="muted">Non è ancora stata eseguita una sincronizzazione.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
