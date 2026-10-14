import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync";
import { isSyncSource } from "@/lib/sync-sources";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const source = body.source;

    if (!isSyncSource(source)) {
      return NextResponse.json(
        { error: "Fonte non valida." },
        { status: 400 }
      );
    }

    const result = await runSync(source);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
