import { getActiveGrants, getCustomer } from "@/lib/data";
import { scoreAll } from "@/lib/scoring";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("customerId");
  if (!id) return new Response("customerId mancante", { status: 400 });

  const customer = await getCustomer(id);
  if (!customer) return new Response("Cliente non trovato", { status: 404 });

  const matches = scoreAll(customer, await getActiveGrants(10000));

  const rows = [
    [
      "ID cliente","Cliente","Score","Classe","ID bando","Titolo","Ente",
      "Fonte","Stato","Scadenza","URL","Regione","Dimensione","ATECO",
      "Temi","Investimento","Tempistica"
    ],
    ...matches.map((m) => [
      customer.external_id,
      customer.ragione_sociale,
      m.score_totale,
      m.classe,
      m.grant.id,
      m.grant.title,
      m.grant.ente,
      m.grant.source,
      m.grant.status,
      m.grant.deadline,
      m.grant.url,
      m.score_regione,
      m.score_dimensione,
      m.score_ateco,
      m.score_temi,
      m.score_investimento,
      m.score_tempistica,
    ]),
  ];

  const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  const safeName = customer.external_id.replace(/[^a-zA-Z0-9_-]/g, "_");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="match_${safeName}.csv"`,
    },
  });
}
