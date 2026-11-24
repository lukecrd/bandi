import { NextResponse } from "next/server";
import { runDeMinimisSync } from "@/lib/de-minimis-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    return NextResponse.json(await runDeMinimisSync());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
