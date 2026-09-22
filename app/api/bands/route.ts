import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { Band } from "@/lib/types";
import { fetchAllExternalBands, generateMockBands, upsertBands } from "@/lib/band-sources";
import { bandInputSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const settore = searchParams.get("settore") || "";
    const regione = searchParams.get("regione") || "";
    const source = searchParams.get("source") || "";
    const refresh = searchParams.get("refresh") || "false";

    if (refresh === "true") {
      const allBands = await fetchAllExternalBands();
      if (allBands.length === 0) {
        allBands.push(...generateMockBands());
        allBands.push(...generateMockBands().slice(0, 2));
      }
      upsertBands(allBands);
    }

    let query = "SELECT * FROM bands WHERE 1=1";
    const params: any[] = [];

    if (search) {
      query += " AND (titolo LIKE ? OR descrizione LIKE ? OR ente LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (settore) {
      query += " AND settore = ?";
      params.push(settore);
    }
    if (regione) {
      query += " AND regione = ?";
      params.push(regione);
    }
    if (source) {
      query += " AND source = ?";
      params.push(source);
    }

    query += " ORDER BY created_at DESC";
    let bands = db.prepare(query).all(...params) as Band[];

    if (bands.length === 0 || refresh === "true") {
      const allBands = await fetchAllExternalBands();
      allBands.push(...generateMockBands());
      upsertBands(allBands);
      bands = db.prepare(query).all(...params) as Band[];
    }

    return NextResponse.json({ bands });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = bandInputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO bands (id, titolo, ente, regione, settore, importo, scadenza, requisiti, descrizione, link, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      body.titolo,
      body.ente,
      body.regione,
      body.settore,
      body.importo,
      body.scadenza,
      body.requisiti,
      body.descrizione,
      body.link,
      body.source,
      now
    );

    const band = db.prepare("SELECT * FROM bands WHERE id = ?").get(id) as Band;
    return NextResponse.json({ band }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
