import Link from "next/link";
import { CustomerForm } from "@/components/customer-form";
import { ImportCustomers } from "@/components/import-customers";
import { getCustomers } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const customers = await getCustomers(q);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clienti</h1>
          <p>Anagrafica e profilo utilizzato dal motore di matching.</p>
        </div>
      </div>

      <div className="grid two">
        <section className="card">
          <h2>Nuovo cliente</h2>
          <CustomerForm />
        </section>
        <section className="card">
          <h2>Importa da Excel / CSV</h2>
          <ImportCustomers />
          <div className="notice" style={{ marginTop: 14 }}>
            Puoi riutilizzare il foglio CLIENTI del modello Excel: l'ID cliente viene usato per aggiornare record già esistenti.
          </div>
        </section>
      </div>

      <div style={{ height: 18 }} />

      <form className="actions" method="get">
        <input className="search" style={{ maxWidth: 420 }} name="q" defaultValue={q} placeholder="Cerca cliente, regione, ATECO…" />
        <button className="btn secondary">Cerca</button>
      </form>

      <div style={{ height: 12 }} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Ragione sociale</th>
              <th>Regione</th>
              <th>ATECO</th>
              <th>Dimensione</th>
              <th>Investimento</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="mono">{customer.external_id}</td>
                <td><strong>{customer.ragione_sociale}</strong></td>
                <td>{customer.regione || "—"}</td>
                <td>{customer.ateco || "—"}</td>
                <td>{customer.dimensione}</td>
                <td>
                  {customer.investimento_previsto_eur !== null
                    ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(customer.investimento_previsto_eur)
                    : "—"}
                </td>
                <td><Link className="btn secondary" href={`/clienti/${customer.id}`}>Apri</Link></td>
              </tr>
            ))}
            {!customers.length && (
              <tr><td colSpan={7} className="muted">Nessun cliente trovato.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
