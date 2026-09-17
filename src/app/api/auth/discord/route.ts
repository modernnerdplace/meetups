import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { discordConfig, isProduction } from "@/lib/env";
import { errorResponse, safeRedirectPath, unavailable } from "@/lib/http";
import { OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** Start de Discord-flow. Zonder client id of secret geven we een 503 in plaats
 *  van een lege redirect, zodat de rest van de site blijft werken. */
export async function GET(request: NextRequest) {
  const config = discordConfig();
  if (!config) {
    return errorResponse(
      unavailable(
        "Discord login is not set up. Add DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET to the environment, or sign in with your email.",
        "discord_not_configured",
      ),
    );
  }

  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));
  const state = randomBytes(16).toString("base64url");

  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", config.redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "identify email");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("prompt", "none");

  const response = NextResponse.redirect(authorize.toString());
  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: `${state}.${encodeURIComponent(next)}`,
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });
  return response;
}
