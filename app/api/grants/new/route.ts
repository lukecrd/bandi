import { NextResponse } from "next/server";
import { getNewGrants } from "@/lib/data";

export async function GET(request: Request) {
  const since = new URL(request.url).searchParams.get("since") ?? "";
  if (Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "Parametro since non valido." }, { status: 400 });
  }

  try {
    return NextResponse.json(await getNewGrants(new Date(since).toISOString()));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
