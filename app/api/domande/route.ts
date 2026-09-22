import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { Domanda, DomandaInput } from "@/lib/types";
import { domandaCreateSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") || "";
    const bandId = searchParams.get("bandId") || "";

    let query = `SELECT d.*, c.ragione_sociale AS client_name, b.titolo AS band_title, b.ente, b.regione, b.settore, b.importo, b.scadenza, b.source FROM domande d LEFT JOIN clients c ON d.client_id = c.id LEFT JOIN bands b ON d.band_id = b.id WHERE 1=1`;
    const params: any[] = [];

    if (clientId) {
      query += " AND d.client_id = ?";
      params.push(clientId);
    }
    if (bandId) {
      query += " AND d.band_id = ?";
      params.push(bandId);
    }

    query += " ORDER BY d.created_at DESC";
    const domande = db.prepare(query).all(...params) as (Domanda & { client_name?: string; band_title?: string })[];
    return NextResponse.json({ domande });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = domandaCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { client_id, band_id, note } = parsed.data;
    const now = new Date().toISOString();

    const existing = db.prepare("SELECT id FROM domande WHERE client_id = ? AND band_id = ?").get(client_id, band_id);
    if (existing) {
      return NextResponse.json({ error: "Domanda già esistente per questo cliente e bando" }, { status: 409 });
    }

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO domande (id, client_id, band_id, stato, note, created_at, updated_at)
      VALUES (?, ?, ?, 'bozza', ?, ?, ?)
    `).run(id, client_id, band_id, note, now, now);

    const templateModuli = [
      { tipo: "domanda_bando" },
      { tipo: "delega_bando" },
      { tipo: "allegato_a" },
      { tipo: "dichiarazione_inps" },
    ];
    for (const t of templateModuli) {
      db.prepare(`
        INSERT INTO moduli (id, domanda_id, tipo, stato, dati, created_at, updated_at)
        VALUES (?, ?, ?, 'vuoto', ?, ?, ?)
      `).run(crypto.randomUUID(), id, t.tipo, "{}", now, now);
    }

    const domanda = db.prepare("SELECT * FROM domande WHERE id = ?").get(id) as Domanda;
    return NextResponse.json({ domanda }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
