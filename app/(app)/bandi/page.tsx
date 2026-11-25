import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { getCustomers, getGrantRegions, getGrants } from "@/lib/data";
import { datiMancanti } from "@/lib/questionario";
import { scoreGrant } from "@/lib/scoring";
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
  const customerId = typeof params.customer === "string" ? params.customer : "";

  const mostraEsclusi = params.esclusi === "mostra";

  const [all, regions, customers] = await Promise.all([
    getGrants({ search: q, source, status, region, limit: 5000 }),
    getGrantRegions(),
    getCustomers(),
  ]);
  const customer = customers.find((c) => c.id === customerId);
  const scored = all.map((grant) => ({ grant, match: customer && scoreGrant(customer, grant) }));
  const adatti = scored.filter((s) => !s.match || (!s.match.esclusioni.length && s.match.motivi.length));
  const esclusi = scored.length - adatti.length;
  const shown = mostraEsclusi ? scored : adatti;
  const codiceAteco = customer && (customer.ateco || customer.anagrafica?.ateco);
  const mancanti = customer ? datiMancanti(customer) : [];
  const esclusiHref = `/bandi?${new URLSearchParams({
    q, region, source, status, customer: customerId, ...(mostraEsclusi ? {} : { esclusi: "mostra" }),
  })}`;
  const filtered = Boolean(q || source || status || region || customerId);

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
        <div className="field">
          <label htmlFor="customer">Verifica match per cliente</label>
          <select id="customer" name="customer" defaultValue={customerId}>
            <option value="">Nessuno</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.ragione_sociale}</option>)}
          </select>
        </div>
        <div className="actions">
          <button className="btn">Filtra</button>
          {filtered && <Link className="btn ghost" href="/bandi">Azzera</Link>}
        </div>
      </form>

      <p className="result-count">
        <strong>{shown.length}</strong> {shown.length === 1 ? "bando" : "bandi"}
        {region && <> per <strong>{region}</strong> (inclusi i bandi nazionali)</>}
        {customer && <> · match calcolato per <Link href={`/clienti/${customer.id}`}><strong>{customer.ragione_sociale}</strong></Link></>}
        {codiceAteco && <> · ATECO {codiceAteco}</>}
        {esclusi > 0 && (
          <>
            {" · "}{esclusi} non adatti {mostraEsclusi ? "in elenco" : "nascosti"}{" "}
            (<Link className="title-link" href={esclusiHref}>{mostraEsclusi ? "nascondi" : "mostra"}</Link>)
          </>
        )}
      </p>
      {mancanti.length > 0 && (
        <div className="notice" style={{ marginBottom: 12 }}>
          <b>Per trovare i bandi giusti per questo cliente servono: {mancanti.join(", ")}.</b>{" "}
          <Link className="title-link" href={`/clienti/${customerId}#dati-mancanti`}>Rispondi alle domande</Link>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {customer && <th>Si adatta?</th>}
              <th>Stato</th>
              <th>Titolo</th>
              <th>Territorio</th>
              <th>Fonte</th>
              <th>Scadenza</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ grant, match }) => {
              const places = territory(grant.regions);
              return (
              <tr key={grant.id}>
                {match && (
                  <td className="small">
                    {match.esclusioni.length
                      ? <><span className="badge low">No</span> {match.esclusioni.join(", ")}</>
                      : match.motivi.length
                      ? <><span className="badge high">Sì</span> {match.motivi.join(", ")}</>
                      : <><span className="badge">Generico</span> nessun legame con il cliente</>}
                  </td>
                )}
                <td><StatusBadge value={grant.status} /></td>
                <td className="title-cell">
                  {grant.url
                    ? <a className="title-link" href={grant.url} target="_blank" rel="noreferrer">{grant.title}<ArrowUpRight size={15} strokeWidth={1.75} className="ext" aria-hidden="true" /></a>
                    : <strong>{grant.title}</strong>}
                  <div className="muted small">{grant.ente || "—"}</div>
                  {grant.topics.length > 0 && (
                    <div className="muted small">Temi: {grant.topics.slice(0, 4).join(" · ")}</div>
                  )}
                </td>
                <td>
                  <div className="chips">
                    {places.slice(0, 3).map((r) => <span key={r} className="chip">{r}</span>)}
                    {places.length > 3 && <span className="chip muted" title={places.slice(3).join(", ")}>+{places.length - 3}</span>}
                  </div>
                </td>
                <td className="small">{grant.source}</td>
                <td className="nowrap">{date(grant.deadline)}</td>
              </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={customer ? 6 : 5} className="muted empty">Nessun bando trovato con questi filtri.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
