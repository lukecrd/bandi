import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { Client } from "@/lib/types";
import { clientInputSchema } from "@/lib/validation";

export async function GET() {
  try {
    const clients = db.prepare("SELECT * FROM clients ORDER BY created_at DESC").all() as Client[];
    return NextResponse.json({ clients });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = clientInputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO clients (id, ragione_sociale, partita_iva, citta, codici_ateco, settore, regione, taglia_aziendale, requisiti, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, body.ragione_sociale, body.partita_iva, body.citta, body.codici_ateco, body.settore, body.regione, body.taglia_aziendale, body.requisiti, body.note, now, now);

    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as Client;
    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
