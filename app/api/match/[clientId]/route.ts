import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { Client, Band, Match } from "@/lib/types";
import { matchComputeSchema } from "@/lib/validation";
import { computeMatchScore } from "@/lib/matching";

export async function POST(req: NextRequest) {
  try {
    const parsed = matchComputeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { clientId } = parsed.data;

    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId) as Client | undefined;
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const bands = db.prepare("SELECT * FROM bands").all() as Band[];

    const upsert = db.prepare(`
      INSERT INTO matches (id, client_id, band_id, score, motivazione, created_at)
      VALUES (@id, @clientId, @bandId, @score, @motivazione, @now)
      ON CONFLICT(client_id, band_id) DO UPDATE SET score = @score, motivazione = @motivazione
    `);
    const upsertAll = db.transaction((bandsToMatch: Band[]) => {
      const now = new Date().toISOString();
      for (const band of bandsToMatch) {
        const { score, motivazione } = computeMatchScore(client, band);
        upsert.run({ id: crypto.randomUUID(), clientId, bandId: band.id, score, motivazione, now });
      }
    });
    upsertAll(bands);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  try {
    const { clientId } = await params;

    const matches = db.prepare(`
      SELECT m.*, b.titolo AS band_title, b.ente, b.regione, b.settore, b.importo, b.scadenza, b.source
      FROM matches m LEFT JOIN bands b ON m.band_id = b.id
      WHERE m.client_id = ? ORDER BY m.score DESC
    `).all(clientId) as (Match & { band_title?: string; ente?: string; regione?: string; settore?: string; importo?: string; scadenza?: string; source?: string })[];
    return NextResponse.json({ matches });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
