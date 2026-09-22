import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { Band } from "@/lib/types";
import { bandInputSchema } from "@/lib/validation";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const band = db.prepare("SELECT * FROM bands WHERE id = ?").get(id) as Band | undefined;
    if (!band) return NextResponse.json({ error: "Band not found" }, { status: 404 });
    return NextResponse.json({ band });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = bandInputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;
    db.prepare(`
      UPDATE bands SET titolo=?, ente=?, regione=?, settore=?, importo=?, scadenza=?, requisiti=?, descrizione=?, link=?, source=?
      WHERE id=?
    `).run(body.titolo, body.ente, body.regione, body.settore, body.importo, body.scadenza, body.requisiti, body.descrizione, body.link, body.source, id);

    const band = db.prepare("SELECT * FROM bands WHERE id = ?").get(id) as Band;
    return NextResponse.json({ band });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = db.prepare("SELECT * FROM bands WHERE id = ?").get(id);
    if (!existing) return NextResponse.json({ error: "Band not found" }, { status: 404 });

    db.prepare("DELETE FROM matches WHERE band_id = ?").run(id);
    db.prepare("DELETE FROM bands WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
