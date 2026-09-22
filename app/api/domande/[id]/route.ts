import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { Domanda, Documento, DocumentoInput } from "@/lib/types";
import { documentoCreateSchema } from "@/lib/validation";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const domanda = db.prepare("SELECT * FROM domande WHERE id = ?").get(id) as Domanda | undefined;
    if (!domanda) {
      return NextResponse.json({ error: "Domanda non trovata" }, { status: 404 });
    }

    const client = db.prepare("SELECT id, ragione_sociale AS client_name FROM clients WHERE id = ?").get(domanda.client_id);
    const band = db.prepare("SELECT id, titolo AS band_title, ente FROM bands WHERE id = ?").get(domanda.band_id);

    const documenti = db.prepare("SELECT * FROM documenti WHERE domanda_id = ? ORDER BY created_at DESC").all(id) as Documento[];

    const rawModuli = db.prepare("SELECT * FROM moduli WHERE domanda_id = ? ORDER BY tipo").all(id) as Array<{
      id: string;
      domanda_id: string;
      tipo: string;
      stato: string;
      dati: string;
      created_at: string;
      updated_at: string;
    }>;
    const moduli = rawModuli.map((m) => {
      const parsed: Record<string, any> = {};
      try {
        const d = JSON.parse(m.dati || "{}");
        for (const [k, v] of Object.entries(d)) {
          parsed[k] = v;
        }
      } catch {
        // empty
      }
      return { ...m, dati: parsed };
    });

    return NextResponse.json({ domanda: { ...domanda, ...(client as Record<string, any> || {}), ...(band as Record<string, any> || {}) }, documenti, moduli });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { note, stato } = body;

    const existing = db.prepare("SELECT id FROM domande WHERE id = ?").get(id);
    if (!existing) {
      return NextResponse.json({ error: "Domanda non trovata" }, { status: 404 });
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE domande SET note = COALESCE(?, note), stato = COALESCE(?, stato), updated_at = ? WHERE id = ?")
      .run(note, stato, now, id);

    const domanda = db.prepare("SELECT * FROM domande WHERE id = ?").get(id) as Domanda;
    return NextResponse.json({ domanda });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = db.prepare("SELECT id FROM domande WHERE id = ?").get(id);
    if (!existing) {
      return NextResponse.json({ error: "Domanda non trovata" }, { status: 404 });
    }

    db.prepare("DELETE FROM documenti WHERE domanda_id = ?").run(id);
    db.prepare("DELETE FROM moduli WHERE domanda_id = ?").run(id);
    db.prepare("DELETE FROM domande WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
