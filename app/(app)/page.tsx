import Link from "next/link";
import { unstable_cache } from "next/cache";
import { Kpi } from "@/components/kpi";
import { StatusBadge } from "@/components/status-badge";
import {
  getActiveGrants,
  getCustomers,
  getDashboardStats,
  getGrant,
  getRecentSyncRuns,
  MATCHES_TAG,
} from "@/lib/data";
import { minMatchScore, scoreGrant, SCORE_WEIGHTS } from "@/lib/scoring";
import { sourceLabel } from "@/lib/sync-sources";
import type { Customer, Grant, MatchResult } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_GRANTS = 10;
const MAX_NAMES = 24;
const DAY = 86_400_000;

const CRITERIA = [
  ["score_regione", "Regione", SCORE_WEIGHTS.regione],
  ["score_dimensione", "Dimensione", SCORE_WEIGHTS.dimensione],
  ["score_ateco", "ATECO", SCORE_WEIGHTS.ateco],
  ["score_temi", "Temi", SCORE_WEIGHTS.temi],
  ["score_investimento", "Investimento", SCORE_WEIGHTS.investimento],
  ["score_tempistica", "Tempistica", SCORE_WEIGHTS.tempistica],
] as const;

type Scored = { customer: Customer; match: MatchResult };
type GrantSummary = Pick<Grant, "id" | "title" | "source" | "regions" | "deadline" | "opening_date" | "status">;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT").format(new Date(value));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

// Giorno di calendario italiano: le date del DB arrivano come mezzanotte locale o UTC a seconda del server.
const ROME_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" });
const romeDay = (value: string | Date) => Date.parse(ROME_DAY.format(new Date(value)));

function daysLeft(deadline: string | null) {
  if (!deadline) return null;
  return Math.round((romeDay(deadline) - romeDay(new Date())) / DAY);
}

/** Timbro della scadenza: rosso entro 7 giorni, ambra entro 30. */
function DeadlineStamp({ grant }: { grant: GrantSummary }) {
  const days = daysLeft(grant.deadline);
  if (grant.status === "In arrivo" && grant.opening_date) {
    return <span className="badge forthcoming stamp">apre {shortDate(grant.opening_date)}</span>;
  }
  if (days === null) return <span className="badge stamp">a sportello</span>;
  const text = days === 0 ? "scade oggi" : days === 1 ? "domani" : days <= 30 ? `${days} gg` : shortDate(grant.deadline!);
  const tone = days <= 7 ? "low" : days <= 30 ? "medium" : "";
  return (
    <span className={`badge stamp ${tone}`} title={`Scadenza ${formatDate(grant.deadline)}`}>
      {text}
    </span>
  );
}

function urgency(grant: GrantSummary) {
  const days = daysLeft(grant.deadline);
  return days === null ? 2 : days <= 7 ? 0 : days <= 30 ? 1 : 2;
}

/**
 * Conteggio dei clienti compatibili per ogni bando attivo: è il calcolo pesante (bandi × clienti),
 * quindi resta in cache finché una sync o una modifica ai clienti non invalida MATCHES_TAG.
 */
const getMatchCounts = unstable_cache(
  async (min: number) => {
    const [grants, customers] = await Promise.all([getActiveGrants(5000), getCustomers()]);
    const rows = grants.flatMap((g) => {
      const matches = customers.map((c) => scoreGrant(c, g)).filter((m) => m.score_totale >= min);
      if (!matches.length) return [];
      const grant: GrantSummary = {
        id: g.id, title: g.title, source: g.source, regions: g.regions,
        deadline: g.deadline, opening_date: g.opening_date, status: g.status,
      };
      return [{ grant, count: matches.length, high: matches.filter((m) => m.classe === "ALTA").length }];
    });
    return { rows, customers: customers.length };
  },
  ["dashboard-match-counts"],
  { tags: [MATCHES_TAG] }
);

type WorkRow = Awaited<ReturnType<typeof getMatchCounts>>["rows"][number];

/** Prima i bandi più urgenti, poi quelli con più clienti: ordinato a ogni richiesta perché i giorni cambiano. */
function workList(rows: WorkRow[]) {
  const keyed = rows.map((row) => ({ row, urgency: urgency(row.grant), days: daysLeft(row.grant.deadline) ?? Infinity }));
  return keyed
    .sort((a, b) => a.urgency - b.urgency || b.row.count - a.row.count || a.days - b.days)
    .map((k) => k.row);
}

/** Clienti con gli stessi punti su ogni criterio sono indistinguibili: li mostriamo come un unico profilo. */
function profiles(scored: Scored[]) {
  const groups = Map.groupBy(scored, ({ match }) => CRITERIA.map(([key]) => match[key]).join("|"));
  return [...groups.values()]
    .map((members) => ({
      match: members[0].match,
      members: members.map((s) => s.customer).sort((a, b) => a.ragione_sociale.localeCompare(b.ragione_sociale, "it")),
    }))
    .sort((a, b) =>
      b.match.score_totale - a.match.score_totale ||
      b.match.score_temi - a.match.score_temi ||
      b.members.length - a.members.length
    );
}

function ClientLinks({ members }: { members: Customer[] }) {
  const link = (c: Customer) => (
    <li key={c.id}><Link className="title-link" href={`/clienti/${c.id}`}>{c.ragione_sociale}</Link></li>
  );
  return (
    <>
      <ul className="name-list">{members.slice(0, MAX_NAMES).map(link)}</ul>
      {members.length > MAX_NAMES && (
        <details className="more-names">
          <summary>Altri {members.length - MAX_NAMES} clienti</summary>
          <ul className="name-list">{members.slice(MAX_NAMES).map(link)}</ul>
        </details>
      )}
    </>
  );
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const bandoId = typeof params.bando === "string" ? params.bando : "";
  const min = minMatchScore();
  const [stats, customers, syncs, counts] = await Promise.all([
    getDashboardStats(),
    getCustomers(),
    getRecentSyncRuns(),
    getMatchCounts(min),
  ]);

  // Un bando compatibile con tutti i clienti non aiuta a scegliere chi chiamare: resta fuori dall'elenco.
  const all = workList(counts.rows);
  const work = all.filter((w) => w.count < counts.customers);
  const generic = all.length - work.length;
  const selectedId = bandoId || work[0]?.grant.id;
  const selected = selectedId ? await getGrant(selectedId) : null;
  const interested = selected
    ? customers
        .map((customer) => ({ customer, match: scoreGrant(customer, selected) }))
        .filter((s) => s.match.score_totale >= min)
    : [];
  const groups = profiles(interested);
  const shown = work.slice(0, MAX_GRANTS);
  // Un bando aperto via ?bando= può non essere tra i primi: lo aggiungiamo in coda.
  if (selected && !shown.some((w) => w.grant.id === selected.id)) {
    const row = all.find((w) => w.grant.id === selected.id);
    if (row) shown.push(row);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Quali bandi lavorare oggi e quali clienti contattare.</p>
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

      <div className="workbench">
        <section className="card" aria-labelledby="bandi-title">
          <div className="card-title">
            <div>
              <h2 id="bandi-title">Bandi da lavorare</h2>
              <p className="muted small">
                Bandi compatibili con una parte dei clienti. Prima quelli in scadenza, poi quelli con più clienti.
              </p>
            </div>
            <Link href="/bandi">Tutti i bandi</Link>
          </div>

          {shown.length ? (
            <ol className="worklist">
              {shown.map(({ grant, count, high }) => {
                const current = grant.id === selected?.id;
                return (
                  <li key={grant.id}>
                    <Link
                      href={`/?bando=${encodeURIComponent(grant.id)}#clienti`}
                      className={current ? "work-row current" : "work-row"}
                      aria-current={current ? "true" : undefined}
                      scroll={false}
                    >
                      <DeadlineStamp grant={grant} />
                      <span className="work-main">
                        <span className="work-title">{grant.title}</span>
                        <span className="muted small">
                          {grant.source} · {grant.regions.includes("ITALIA") ? "Nazionale" : grant.regions.join(", ")}
                        </span>
                      </span>
                      <span className="work-count">
                        <strong>{count}</strong> {count === 1 ? "cliente" : "clienti"}
                        {high > 0 && <span className="small"> · {high} alta</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="muted">
              {generic > 0
                ? "Tutti i bandi attivi sono compatibili con ogni cliente: il punteggio non li distingue."
                : customers.length
                ? `Nessun bando attivo raggiunge il ${min}% di compatibilità con i clienti. Aggiorna le fonti o completa le schede cliente.`
                : "Aggiungi i clienti per vedere quali bandi lavorare."}
            </p>
          )}
          {generic > 0 && shown.length > 0 && (
            <p className="muted small worklist-note">
              Altri {generic} bandi sono compatibili con tutti i {customers.length} clienti e non compaiono qui.{" "}
              <Link className="title-link" href="/bandi">Vedili in Bandi</Link>
            </p>
          )}
        </section>

        <section className="card" id="clienti" aria-labelledby="clienti-title">
          <h2 id="clienti-title">Clienti compatibili</h2>
          {selected ? (
            <>
              <p className="selected-grant">
                {selected.url ? (
                  <a className="title-link" href={selected.url} target="_blank" rel="noreferrer">
                    {selected.title} ↗<span className="sr-only"> (si apre in una nuova scheda)</span>
                  </a>
                ) : (
                  <strong>{selected.title}</strong>
                )}
                <span className="muted small">
                  <DeadlineStamp grant={selected} /> {selected.source} · scadenza {formatDate(selected.deadline)}
                </span>
              </p>
              <p className="result-count">
                <strong>{interested.length}</strong> clienti su {customers.length} con compatibilità ≥ {min}%
                {groups.length > 0 && `, in ${groups.length} ${groups.length === 1 ? "profilo" : "profili"}`}.
              </p>

              {groups.length ? (
                <ul className="profiles">
                  {groups.map(({ match: m, members }) => {
                    const missing = CRITERIA.filter(([key, , max]) => m[key] < max);
                    return (
                      <li key={members[0].id} className="profile">
                        <div className="profile-head">
                          <span className={`badge ${m.classe === "ALTA" ? "high" : "medium"}`}>{m.score_totale}%</span>
                          <span className="profile-bar" aria-hidden="true"><i style={{ width: `${m.score_totale}%` }} /></span>
                          <span className="small">
                            <strong>{members.length}</strong> {members.length === 1 ? "cliente" : "clienti"}
                          </span>
                        </div>
                        <p className="muted small profile-gap">
                          {missing.length
                            ? <>Punti mancanti: {missing.map(([key, label, max]) => `${label} ${m[key]}/${max}`).join(" · ")}</>
                            : "Tutti i criteri soddisfatti."}
                        </p>
                        <ClientLinks members={members} />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="muted">
                  Nessun cliente raggiunge il {min}% su questo bando. Scegli un altro bando dall&apos;elenco.
                </p>
              )}
              <p className="muted small">
                La compatibilità misura quanto il bando è adatto al cliente, non la probabilità di ottenerlo.
              </p>
            </>
          ) : (
            <p className="muted">Scegli un bando dall&apos;elenco per vedere i clienti compatibili.</p>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-title">
          <h2>Sincronizzazioni</h2>
          <Link href="/fonti">Dettagli</Link>
        </div>
        <div className="grid">
          {syncs.slice(0, 6).map((run) => (
            <div key={run.id} className="actions" style={{ justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 12 }}>
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
