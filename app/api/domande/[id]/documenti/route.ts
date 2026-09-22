import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { Documento, DocumentoInput } from "@/lib/types";
import { documentoCreateSchema } from "@/lib/validation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = db.prepare("SELECT id FROM domande WHERE id = ?").get(id);
    if (!existing) {
      return NextResponse.json({ error: "Domanda non trovata" }, { status: 404 });
    }

    const parsed = documentoCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { nome, tipo, size, path } = parsed.data;
    const docId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO documenti (id, domanda_id, nome, tipo, size, path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(docId, id, nome, tipo, size || 0, path || "", now);

    const documento = db.prepare("SELECT * FROM documenti WHERE id = ?").get(docId) as Documento;
    return NextResponse.json({ documento }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const documenti = db.prepare("SELECT * FROM documenti WHERE domanda_id = ? ORDER BY created_at DESC").all(id) as Documento[];
    return NextResponse.json({ documenti });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { docId } = await req.json();
    const existing = db.prepare("SELECT id FROM documenti WHERE id = ? AND domanda_id = ?").get(docId, id);
    if (!existing) {
      return NextResponse.json({ error: "Documento non trovato" }, { status: 404 });
    }

    db.prepare("DELETE FROM documenti WHERE id = ? AND domanda_id = ?").run(docId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
