import { NextResponse } from "next/server";
import { deleteIntegrationToken } from "@/lib/data";

export const runtime = "nodejs";

export async function POST() {
  try {
    await deleteIntegrationToken("teamleader");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
