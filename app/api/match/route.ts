import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { Match } from "@/lib/types";
import { matchCreateSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const parsed = matchCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { clientId, bandId, score, motivazione } = parsed.data;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO matches (id, client_id, band_id, score, motivazione, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_id, band_id) DO UPDATE SET score = excluded.score, motivazione = excluded.motivazione
    `).run(id, clientId, bandId, score, motivazione, now);

    const match = db.prepare("SELECT * FROM matches WHERE client_id = ? AND band_id = ?").get(clientId, bandId) as Match;
    return NextResponse.json({ match }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") || "";
    const bandId = searchParams.get("bandId") || "";

    let query = "SELECT m.*, c.ragione_sociale AS client_name, b.titolo AS band_title, b.ente, b.regione, b.settore, b.importo, b.scadenza, b.source FROM matches m LEFT JOIN clients c ON m.client_id = c.id LEFT JOIN bands b ON m.band_id = b.id WHERE 1=1";
    const params: any[] = [];

    if (clientId) {
      query += " AND m.client_id = ?";
      params.push(clientId);
    }
    if (bandId) {
      query += " AND m.band_id = ?";
      params.push(bandId);
    }

    query += " ORDER BY m.score DESC";
    const matches = db.prepare(query).all(...params) as (Match & { client_name?: string; band_title?: string; ente?: string; regione?: string; settore?: string; importo?: string; scadenza?: string; source?: string })[];
    return NextResponse.json({ matches });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
