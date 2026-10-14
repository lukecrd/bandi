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
import { minMatchScore, scoreGrant } from "@/lib/scoring";
import { sourceLabel } from "@/lib/sync-sources";
import type { Customer, Grant } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_CLIENTS = 15;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT").format(new Date(value));
}

function scoreClients(grant: Grant, customers: Customer[]) {
  return customers
    .map((customer) => ({ customer, match: scoreGrant(customer, grant) }))
    .sort((a, b) =>
      b.match.score_totale - a.match.score_totale ||
      a.customer.ragione_sociale.localeCompare(b.customer.ragione_sociale, "it")
    );
}

/** Bando predefinito: quello regionale/locale con più clienti compatibili (sui nazionali i clienti si distinguono poco). */
function defaultGrant(grants: Grant[], customers: Customer[], min: number) {
  const local = grants.filter((g) => !g.regions.includes("ITALIA"));
  let best: Grant | null = null;
  let bestCount = -1;
  for (const grant of local.length ? local : grants) {
    const count = customers.filter((c) => scoreGrant(c, grant).score_totale >= min).length;
    if (count > bestCount) [best, bestCount] = [grant, count];
  }
  return best;
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const bandoId = typeof params.bando === "string" ? params.bando : "";
  const [stats, customers, syncs, grants] = await Promise.all([
    getDashboardStats(),
    getCustomers(),
    getRecentSyncRuns(),
    getActiveGrants(5000),
  ]);

  const min = minMatchScore();
  const selected = customers.length
    ? grants.find((g) => g.id === bandoId) ?? defaultGrant(grants, customers, min)
    : null;
  const ranked = selected ? scoreClients(selected, customers) : [];
  const interested = ranked.filter((r) => r.match.score_totale >= min);
  const grantsBySource = Map.groupBy(grants, (g) => g.source);

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
            <h2>Clienti interessati al bando</h2>
            <p className="muted small">
              Compatibilità 0–100 di ogni cliente con il bando scelto (regione, dimensione, ATECO, temi,
              investimento, tempistica): indica quanto il bando è adatto, non la probabilità di ottenerlo.
            </p>
          </div>
          {selected && (
            <form method="get" className="actions">
              <label htmlFor="bando" className="sr-only">Bando</label>
              <select id="bando" name="bando" defaultValue={selected.id} className="search client-select">
                {[...grantsBySource].map(([source, list]) => (
                  <optgroup key={source} label={source}>
                    {list.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </optgroup>
                ))}
              </select>
              <button className="btn secondary">Mostra</button>
            </form>
          )}
        </div>

        {selected ? (
          <>
            <p className="small">
              {selected.url
                ? <a className="title-link" href={selected.url} target="_blank" rel="noreferrer">{selected.title} ↗</a>
                : <strong>{selected.title}</strong>}
              <span className="muted">
                {" "}· {selected.source} · {selected.regions.includes("ITALIA") ? "Nazionale" : selected.regions.join(", ")}
                {" "}· scad. {formatDate(selected.deadline)}
              </span>
            </p>
            <p className="result-count">
              <strong>{interested.length}</strong> clienti su {customers.length} con compatibilità ≥ {min}%
              {interested.length > MAX_CLIENTS && ` · mostrati i primi ${MAX_CLIENTS}`}
            </p>
            <MatchChart
              labelHeader="Cliente"
              items={interested.slice(0, MAX_CLIENTS).map(({ customer: c, match }) => ({
                id: c.id,
                label: c.ragione_sociale,
                detail: [c.regione || "regione mancante", c.dimensione, c.ateco && `ATECO ${c.ateco}`]
                  .filter(Boolean).join(" · "),
                href: `/clienti/${c.id}`,
                match,
              }))}
            />
          </>
        ) : (
          <p className="muted">Servono almeno un cliente e un bando attivo per calcolare la compatibilità.</p>
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
