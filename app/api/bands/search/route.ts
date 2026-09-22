import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { Band } from "@/lib/types";
import { fetchEUDeals, fetchItalianBands, fetchRNABands, generateMockBands, upsertBands } from "@/lib/band-sources";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source") || "all";

    const allBands: Partial<Band>[] = [];

    if (source === "all" || source === "eu") {
      allBands.push(...(await fetchEUDeals()));
    }

    if (source === "all" || source === "italy") {
      allBands.push(...(await fetchItalianBands()));
    }

    if (source === "all" || source === "rna") {
      allBands.push(...(await fetchRNABands()));
    }

    if (allBands.length === 0) {
      const mock = generateMockBands();
      allBands.push(...mock);

      if (source === "all" || source === "eu") {
        allBands.push(...generateMockBands().slice(0, 2));
      }

      if (source === "all" || source === "rna") {
        const rnaMock = generateMockBands().slice(0, 3);
        rnaMock.forEach((b) => { b.source = "RNA"; });
        allBands.push(...rnaMock);
      }
    }

    upsertBands(allBands);

    let resultBands = db.prepare("SELECT * FROM bands ORDER BY created_at DESC").all() as Band[];

    if (source !== "all") {
      resultBands = resultBands.filter((b) => b.source.toLowerCase() === source.toLowerCase());
    }

    return NextResponse.json({ bands: resultBands });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
