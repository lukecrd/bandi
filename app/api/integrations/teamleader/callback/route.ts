import { NextRequest, NextResponse } from "next/server";
import { exchangeTeamleaderCode } from "@/lib/integrations/teamleader";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const settingsUrl = new URL("/impostazioni", url.origin);
  const expectedState = request.cookies.get("teamleader_oauth_state")?.value;

  function redirectWith(status: "connected" | "error", message?: string) {
    settingsUrl.searchParams.set("teamleader", status);
    if (message) settingsUrl.searchParams.set("teamleader_message", message);
    const response = NextResponse.redirect(settingsUrl);
    response.cookies.set("teamleader_oauth_state", "", { path: "/", maxAge: 0 });
    return response;
  }

  if (oauthError) {
    return redirectWith("error", oauthError);
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWith("error", "Verifica di sicurezza fallita (state non valido). Riprova.");
  }

  try {
    await exchangeTeamleaderCode(code);
    return redirectWith("connected");
  } catch (error) {
    return redirectWith("error", error instanceof Error ? error.message : String(error));
  }
}
