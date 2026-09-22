import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { Modulo } from "@/lib/types";
import { getModuloTemplate, getApplicableDocuments, documentFieldMappings } from "@/lib/document-mapper";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { tipo } = body;

    const domandaRow = db.prepare("SELECT * FROM domande WHERE id = ?").get(id) as { id: string; client_id: string } | undefined;
    if (!domandaRow) {
      return NextResponse.json({ error: "Domanda non trovata" }, { status: 404 });
    }

    const template = getModuloTemplate(tipo as any);
    if (!template) {
      return NextResponse.json({ error: `Tipo modulo ${tipo} non supportato` }, { status: 400 });
    }

    const documenti = db.prepare("SELECT * FROM documenti WHERE domanda_id = ?").all(id) as Array<{ id: string; tipo: string; nome: string }>;
    const docParams = documenti.map((d) => ({ tipo: d.tipo as any }));
    const applicableDocs = getApplicableDocuments(tipo as any, docParams);

    const now = new Date().toISOString();

    const existing = db.prepare("SELECT id FROM moduli WHERE domanda_id = ? AND tipo = ?").get(id, tipo) as { id: string } | undefined;
    const moduloId = existing?.id || crypto.randomUUID();

    const dati: Record<string, { valore: string; fonte: string; compilato: boolean }> = {};
    let campiCompilati = 0;

    for (const campo of template) {
      let valore = "";
      let fonte = "";
      let compilato = false;

      if (campo.documento_fonte && campo.documento_fonte.length > 0) {
        for (const docType of campo.documento_fonte) {
          const doc = documenti.find((d) => d.tipo === docType);
          if (doc) {
            const mapping = documentFieldMappings.find((m) => m.documentType === docType);
            if (mapping) {
              const fieldMapping = mapping.fields.find((f) => f.campo === campo.nome);
              if (fieldMapping) {
                valore = `[Auto] Da: ${doc.nome}`;
                fonte = docType;
                compilato = true;
                campiCompilati++;
                break;
              }
            }
          }
        }
      }

      if (!compilato && campo.dato_fonte) {
        const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(domandaRow.client_id) as Record<string, any> | undefined;
        if (client && client[campo.dato_fonte]) {
          valore = String(client[campo.dato_fonte] || "");
          fonte = "cliente";
          compilato = !!valore;
          if (compilato) campiCompilati++;
        }
      }

      dati[campo.nome] = { valore, fonte, compilato };
    }

    const stato = campiCompilati >= template.length ? "completo" : campiCompilati > 0 ? "parziale" : "vuoto";

    const moduloObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(dati)) {
      moduloObj[k] = v;
    }

    if (existing) {
      db.prepare("UPDATE moduli SET stato = ?, dati = ?, updated_at = ? WHERE id = ?").run(stato, JSON.stringify(moduloObj), now, moduloId);
    } else {
      db.prepare(`
        INSERT INTO moduli (id, domanda_id, tipo, stato, dati, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(moduloId, id, tipo, stato, JSON.stringify(moduloObj), now, now);
    }

    const modulo = db.prepare("SELECT * FROM moduli WHERE id = ?").get(moduloId) as Modulo;
    const rawDati = typeof modulo.dati === "string" ? modulo.dati : JSON.stringify(modulo.dati);
    const parsedDati: Record<string, any> = {};
    try {
      const parsed = JSON.parse(rawDati || "{}");
      for (const [k, v] of Object.entries(parsed)) {
        parsedDati[k] = v;
      }
    } catch {
      // keep empty
    }

    return NextResponse.json({ modulo: { ...modulo, dati: parsedDati }, applicabili: applicableDocs, documenti });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
