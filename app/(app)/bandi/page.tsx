import { StatusBadge } from "@/components/status-badge";
import { getGrants } from "@/lib/data";

export const dynamic = "force-dynamic";

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT").format(new Date(value));
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

  const grants = await getGrants({ search: q, source, status, limit: 5000 });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bandi</h1>
          <p>Catalogo normalizzato delle opportunità provenienti dalle fonti ufficiali.</p>
        </div>
      </div>

      <form className="card form-grid" method="get">
        <div className="field">
          <label>Ricerca</label>
          <input name="q" defaultValue={q} placeholder="Titolo o ente…" />
        </div>
        <div className="field">
          <label>Fonte</label>
          <select name="source" defaultValue={source}>
            <option value="">Tutte</option>
            <option value="Incentivi.gov.it">Incentivi.gov.it</option>
            <option value="EU Funding & Tenders">EU Funding & Tenders</option>
          </select>
        </div>
        <div className="field">
          <label>Stato</label>
          <select name="status" defaultValue={status}>
            <option value="">Tutti</option>
            <option>Aperto</option>
            <option>In arrivo</option>
            <option>Chiuso</option>
          </select>
        </div>
        <div className="actions field full">
          <button className="btn">Filtra</button>
        </div>
      </form>

      <div style={{ height: 18 }} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Stato</th>
              <th>Titolo</th>
              <th>Ente</th>
              <th>Livello</th>
              <th>Fonte</th>
              <th>Scadenza</th>
              <th>Temi</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {grants.map((grant) => (
              <tr key={grant.id}>
                <td><StatusBadge value={grant.status} /></td>
                <td>
                  <strong>{grant.title}</strong>
                  <div className="muted small mono">{grant.id}</div>
                </td>
                <td>{grant.ente || "—"}</td>
                <td>{grant.level || "—"}</td>
                <td>{grant.source}</td>
                <td>{date(grant.deadline)}</td>
                <td className="small">{grant.topics.slice(0, 6).join(" · ") || "—"}</td>
                <td>
                  {grant.url ? <a className="btn secondary" href={grant.url} target="_blank" rel="noreferrer">Apri</a> : "—"}
                </td>
              </tr>
            ))}
            {!grants.length && <tr><td colSpan={8} className="muted">Nessun bando trovato.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
