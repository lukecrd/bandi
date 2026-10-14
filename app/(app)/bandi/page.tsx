import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { getGrantRegions, getGrants } from "@/lib/data";
import { SYNC_SOURCES } from "@/lib/sync-sources";

export const dynamic = "force-dynamic";

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT").format(new Date(value));
}

function territory(regions: string[]) {
  if (regions.includes("ITALIA")) return ["Nazionale"];
  return regions;
}

export default async function GrantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const source = typeof params.source === "string" ? params.source : "";
  const status = typeof params.status === "string" ? params.status : "";
  const region = typeof params.region === "string" ? params.region : "";

  const [grants, regions] = await Promise.all([
    getGrants({ search: q, source, status, region, limit: 5000 }),
    getGrantRegions(),
  ]);
  const filtered = Boolean(q || source || status || region);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bandi</h1>
          <p>Catalogo normalizzato delle opportunità provenienti dalle fonti ufficiali.</p>
        </div>
      </div>

      <form className="card filters" method="get">
        <div className="field grow">
          <label htmlFor="q">Ricerca</label>
          <input id="q" name="q" defaultValue={q} placeholder="Titolo o ente…" />
        </div>
        <div className="field">
          <label htmlFor="region">Regione</label>
          <select id="region" name="region" defaultValue={region}>
            <option value="">Tutte</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="source">Fonte</label>
          <select id="source" name="source" defaultValue={source}>
            <option value="">Tutte</option>
            {Object.values(SYNC_SOURCES).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="status">Stato</label>
          <select id="status" name="status" defaultValue={status}>
            <option value="">Tutti</option>
            <option>Aperto</option>
            <option>In arrivo</option>
            <option>Chiuso</option>
          </select>
        </div>
        <div className="actions">
          <button className="btn">Filtra</button>
          {filtered && <Link className="btn ghost" href="/bandi">Azzera</Link>}
        </div>
      </form>

      <p className="result-count">
        <strong>{grants.length}</strong> {grants.length === 1 ? "bando" : "bandi"}
        {region && <> per <strong>{region}</strong> (inclusi i bandi nazionali)</>}
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Stato</th>
              <th>Titolo</th>
              <th>Territorio</th>
              <th>Fonte</th>
              <th>Scadenza</th>
              <th>Temi</th>
            </tr>
          </thead>
          <tbody>
            {grants.map((grant) => (
              <tr key={grant.id}>
                <td><StatusBadge value={grant.status} /></td>
                <td className="title-cell">
                  {grant.url
                    ? <a className="title-link" href={grant.url} target="_blank" rel="noreferrer">{grant.title} ↗</a>
                    : <strong>{grant.title}</strong>}
                  <div className="muted small">{grant.ente || "—"}</div>
                </td>
                <td>
                  <div className="chips">
                    {territory(grant.regions).slice(0, 3).map((r) => <span key={r} className="chip">{r}</span>)}
                    {territory(grant.regions).length > 3 && <span className="chip muted">+{grant.regions.length - 3}</span>}
                  </div>
                </td>
                <td className="small">{grant.source}</td>
                <td className="nowrap">{date(grant.deadline)}</td>
                <td className="small muted">{grant.topics.slice(0, 4).join(" · ") || "—"}</td>
              </tr>
            ))}
            {!grants.length && <tr><td colSpan={6} className="muted empty">Nessun bando trovato con questi filtri.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
