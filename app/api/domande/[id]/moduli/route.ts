import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { Modulo } from "@/lib/types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const moduli = db.prepare("SELECT * FROM moduli WHERE domanda_id = ? ORDER BY tipo").all(id) as Modulo[];
    const parsed = moduli.map((m) => ({ ...m, dati: JSON.parse((m.dati as unknown as string) || "{}") }));
    return NextResponse.json({ moduli: parsed });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
