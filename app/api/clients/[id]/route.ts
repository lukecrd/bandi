import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { Client } from "@/lib/types";
import { clientInputSchema } from "@/lib/validation";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as Client | undefined;
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    return NextResponse.json({ client });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = clientInputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE clients SET ragione_sociale=?, partita_iva=?, citta=?, codici_ateco=?, settore=?, regione=?, taglia_aziendale=?, requisiti=?, note=?, updated_at=?
      WHERE id=?
    `).run(body.ragione_sociale, body.partita_iva, body.citta, body.codici_ateco, body.settore, body.regione, body.taglia_aziendale, body.requisiti, body.note, now, id);

    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as Client;
    return NextResponse.json({ client });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
    if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    db.prepare("DELETE FROM matches WHERE client_id = ?").run(id);
    db.prepare("DELETE FROM clients WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
