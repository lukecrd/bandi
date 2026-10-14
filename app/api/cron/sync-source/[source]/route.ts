import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync";
import { isSyncSource } from "@/lib/sync-sources";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

// Cron generico per le fonti aggiunte dopo le prime tre: /api/cron/sync-source/<fonte>
export async function GET(
  request: Request,
  { params }: { params: Promise<{ source: string }> }
) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { source } = await params;
  if (!isSyncSource(source)) {
    return NextResponse.json({ error: "Fonte non valida." }, { status: 404 });
  }

  try {
    return NextResponse.json(await runSync(source));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
