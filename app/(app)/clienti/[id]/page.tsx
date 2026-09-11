import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteCustomerButton } from "@/components/delete-customer";
import { CustomerEditForm } from "@/components/customer-edit-form";
import { StatusBadge } from "@/components/status-badge";
import { getActiveGrants, getCustomer } from "@/lib/data";
import { scoreAll } from "@/lib/scoring";

export const dynamic = "force-dynamic";

function money(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT").format(new Date(value));
}

export default async function CustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const matches = scoreAll(customer, await getActiveGrants(10000));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="muted small mono">{customer.external_id}</div>
          <h1>{customer.ragione_sociale}</h1>
          <p>{customer.regione} · ATECO {customer.ateco || "non indicato"} · {customer.dimensione}</p>
        </div>
        <div className="actions">
          <Link className="btn secondary" href={`/api/export/matches?customerId=${customer.id}`}>Esporta match CSV</Link>
          <DeleteCustomerButton id={customer.id} />
        </div>
      </div>

      <div className="grid kpis">
        <div className="kpi"><div className="label">Investimento previsto</div><div className="value">{money(customer.investimento_previsto_eur)}</div></div>
        <div className="kpi"><div className="label">Match ALTA</div><div className="value">{matches.filter((m) => m.classe === "ALTA").length}</div></div>
        <div className="kpi"><div className="label">Match MEDIA</div><div className="value">{matches.filter((m) => m.classe === "MEDIA").length}</div></div>
        <div className="kpi"><div className="label">Opportunità mostrate</div><div className="value">{matches.length}</div></div>
      </div>

      <div style={{ height: 18 }} />

      <details className="card">
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>Modifica anagrafica cliente</summary>
        <div style={{ height: 14 }} />
        <CustomerEditForm customer={customer} />
      </details>

      <div style={{ height: 18 }} />

      <section className="card">
        <h2>Profilo di interesse</h2>
        <div className="actions">
          {[
            ["Digitale", customer.digitale],
            ["Green", customer.green],
            ["R&S", customer.ricerca_sviluppo],
            ["Cloud/Cyber", customer.cloud_cyber],
            ["Beni", customer.investimenti_beni],
            ["Export", customer.export],
            ["Formazione", customer.formazione],
          ].filter(([, active]) => active).map(([label]) => (
            <span className="badge open" key={String(label)}>{label}</span>
          ))}
          {![
            customer.digitale, customer.green, customer.ricerca_sviluppo,
            customer.cloud_cyber, customer.investimenti_beni, customer.export,
            customer.formazione
          ].some(Boolean) && <span className="muted">Nessun tema selezionato.</span>}
        </div>
      </section>

      <div style={{ height: 18 }} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Score</th>
              <th>Classe</th>
              <th>Bando</th>
              <th>Fonte</th>
              <th>Stato</th>
              <th>Scadenza</th>
              <th>Dettaglio score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {matches.slice(0, 250).map((match) => (
              <tr key={match.grant.id}>
                <td><span className="score">{match.score_totale}</span>/100</td>
                <td><StatusBadge value={match.classe} /></td>
                <td>
                  <strong>{match.grant.title}</strong>
                  <div className="muted small">{match.grant.ente}</div>
                </td>
                <td>{match.grant.source}</td>
                <td><StatusBadge value={match.grant.status} /></td>
                <td>{date(match.grant.deadline)}</td>
                <td className="small">
                  R {match.score_regione} · D {match.score_dimensione} · A {match.score_ateco} ·
                  T {match.score_temi} · I {match.score_investimento} · C {match.score_tempistica}
                </td>
                <td>
                  {match.grant.url ? (
                    <a className="btn secondary" href={match.grant.url} target="_blank" rel="noreferrer">Fonte</a>
                  ) : "—"}
                </td>
              </tr>
            ))}
            {!matches.length && <tr><td colSpan={8} className="muted">Nessuna opportunità sopra la soglia.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
