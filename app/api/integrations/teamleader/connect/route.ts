import { NextResponse } from "next/server";
import { getTeamleaderAuthorizationUrl } from "@/lib/integrations/teamleader";

export const runtime = "nodejs";

export async function GET() {
  try {
    const state = crypto.randomUUID();
    const authorizeUrl = getTeamleaderAuthorizationUrl(state);

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set("teamleader_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minuti: tempo più che sufficiente per completare il consenso
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
