import { NextResponse } from "next/server";
import { createSessionToken, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(request: Request) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "APP_PASSWORD non configurata" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  if (body.password !== expected) {
    return NextResponse.json({ error: "Password non valida" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("bandi_session", await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
