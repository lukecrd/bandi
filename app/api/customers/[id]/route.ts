import { NextResponse } from "next/server";
import { deleteCustomer, updateCustomer } from "@/lib/data";
import type { CustomerInput } from "@/lib/types";

function nullableNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asBool(value: unknown) {
  return value === true || value === "true" || value === "1" || value === "on";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.external_id || !body.ragione_sociale || !body.regione) {
      return NextResponse.json(
        { error: "ID cliente, ragione sociale e regione sono obbligatori." },
        { status: 400 }
      );
    }

    const input: CustomerInput = {
      external_id: String(body.external_id).trim(),
      ragione_sociale: String(body.ragione_sociale).trim(),
      regione: String(body.regione).trim(),
      provincia: body.provincia ? String(body.provincia).trim() : null,
      ateco: body.ateco ? String(body.ateco).trim() : null,
      dimensione: String(body.dimensione || "Micro"),
      dipendenti: nullableNumber(body.dipendenti),
      fatturato_eur: nullableNumber(body.fatturato_eur),
      investimento_previsto_eur: nullableNumber(body.investimento_previsto_eur),
      digitale: asBool(body.digitale),
      green: asBool(body.green),
      ricerca_sviluppo: asBool(body.ricerca_sviluppo),
      cloud_cyber: asBool(body.cloud_cyber),
      investimenti_beni: asBool(body.investimenti_beni),
      export: asBool(body.export),
      formazione: asBool(body.formazione),
      note: body.note ? String(body.note).trim() : null,
    };

    const customer = await updateCustomer(id, input);
    if (!customer) {
      return NextResponse.json({ error: "Cliente non trovato." }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore";
    const duplicate = message.includes("customers_external_id") || message.includes("unique");
    return NextResponse.json(
      { error: duplicate ? "ID cliente già esistente." : message },
      { status: duplicate ? 409 : 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteCustomer(id);
  return NextResponse.json({ ok: true });
}
