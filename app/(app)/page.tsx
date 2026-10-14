import Link from "next/link";
import { Kpi } from "@/components/kpi";
import { MatchChart } from "@/components/match-chart";
import { StatusBadge } from "@/components/status-badge";
import {
  getActiveGrants,
  getCustomers,
  getDashboardStats,
  getRecentSyncRuns,
} from "@/lib/data";
import { scoreAll } from "@/lib/scoring";
import { sourceLabel } from "@/lib/sync-sources";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT").format(new Date(value));
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const clienteId = typeof params.cliente === "string" ? params.cliente : "";
  const [stats, customers, syncs] = await Promise.all([
    getDashboardStats(),
    getCustomers(),
    getRecentSyncRuns(),
  ]);

  const selected = customers.find((c) => c.id === clienteId) ?? customers[0] ?? null;
  const matches = selected
    ? scoreAll(selected, await getActiveGrants(5000)).slice(0, 10)
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

      <section className="card">
        <div className="card-title">
          <div>
            <h2>Compatibilità bandi per cliente</h2>
            <p className="muted small">
              Punteggio 0–100 su regione, dimensione, ATECO, temi, investimento e tempistica:
              indica quanto il bando è adatto al cliente, non la probabilità di ottenerlo.
            </p>
          </div>
          {selected && (
            <form method="get" className="actions">
              <label htmlFor="cliente" className="sr-only">Cliente</label>
              <select id="cliente" name="cliente" defaultValue={selected.id} className="search client-select">
                {customers.map((c) => <option key={c.id} value={c.id}>{c.ragione_sociale}</option>)}
              </select>
              <button className="btn secondary">Mostra</button>
            </form>
          )}
        </div>
        {selected ? (
          <>
            <MatchChart matches={matches} />
            <p className="small">
              <Link className="title-link" href={`/clienti/${selected.id}`}>
                Tutti i match di {selected.ragione_sociale} →
              </Link>
            </p>
          </>
        ) : (
          <p className="muted">Carica almeno un cliente per vedere i match.</p>
        )}
      </section>

      <div style={{ height: 18 }} />

      <section className="card">
        <div className="card-title">
          <h2>Sincronizzazioni</h2>
          <Link href="/fonti">Dettagli →</Link>
        </div>
        <div className="grid">
          {syncs.slice(0, 6).map((run) => (
            <div key={run.id} className="actions" style={{ justifyContent: "space-between", borderTop: "1px solid #e4e7ec", paddingTop: 12 }}>
              <div>
                <strong>{sourceLabel(run.source)}</strong>
                <div className="muted small">{formatDate(run.started_at)} · {run.records} record</div>
              </div>
              <StatusBadge value={run.status} />
            </div>
          ))}
          {!syncs.length && <p className="muted">Non è ancora stata eseguita una sincronizzazione.</p>}
        </div>
      </section>
    </>
  );
}
