import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { Modulo } from "@/lib/types";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; moduloId: string }> }) {
  try {
    const { id, moduloId } = await params;
    const body = await req.json();
    const { dati, stato } = body;

    const existing = db.prepare("SELECT id FROM moduli WHERE id = ? AND domanda_id = ?").get(moduloId, id);
    if (!existing) {
      return NextResponse.json({ error: "Modulo non trovato" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const datiToStore: Record<string, any> = {};
    for (const [k, v] of Object.entries(dati || {})) {
      datiToStore[k] = typeof v === "object" && v !== null ? v : { valore: String(v), fonte: "", compilato: !!v };
    }

    db.prepare("UPDATE moduli SET dati = COALESCE(?, dati), stato = COALESCE(?, stato), updated_at = ? WHERE id = ? AND domanda_id = ?")
      .run(JSON.stringify(datiToStore) as any, stato as any, now, moduloId, id);

    const modulo = db.prepare("SELECT * FROM moduli WHERE id = ?").get(moduloId) as Modulo;
    const parsedDati: Record<string, any> = {};
    const rawDati = JSON.parse((modulo.dati as unknown as string) || "{}");
    for (const [k, v] of Object.entries(rawDati)) {
      parsedDati[k] = v;
    }

    return NextResponse.json({ modulo: { ...modulo, dati: parsedDati } });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
