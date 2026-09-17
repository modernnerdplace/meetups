import { NextResponse, type NextRequest } from "next/server";
import { upsertMemberFromDiscord } from "@/lib/auth";
import { discordConfig, siteUrl } from "@/lib/env";
import { errorResponse, safeRedirectPath, unavailable } from "@/lib/http";
import { OAUTH_STATE_COOKIE } from "@/lib/oauth";
import { applySessionCookie, createSession, safeEqual } from "@/lib/session";

export const dynamic = "force-dynamic";

const API = "https://discord.com/api/v10";

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  email?: string | null;
  verified?: boolean;
};

function loginError(reason: string) {
  const url = new URL(`${siteUrl()}/login`);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url.toString());
}

function avatarUrl(user: DiscordUser): string | null {
  if (!user.avatar) return null;
  const extension = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=256`;
}

/** Wisselt de code in voor een token, haalt het profiel op en logt in. */
export async function GET(request: NextRequest) {
  const config = discordConfig();
  if (!config) {
    return errorResponse(
      unavailable("Discord login is not set up.", "discord_not_configured"),
    );
  }

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return loginError("discord_denied");

  const code = params.get("code");
  const state = params.get("state");
  const cookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !cookie) return loginError("discord_state");

  const separator = cookie.indexOf(".");
  const expectedState = separator === -1 ? cookie : cookie.slice(0, separator);
  const next = safeRedirectPath(
    separator === -1 ? "/" : decodeURIComponent(cookie.slice(separator + 1)),
  );
  if (!safeEqual(expectedState, state)) return loginError("discord_state");

  try {
    const tokenResponse = await fetch(`${API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) {
      console.error("[discord] token exchange failed", tokenResponse.status);
      return loginError("discord_token");
    }
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) return loginError("discord_token");

    const userResponse = await fetch(`${API}/users/@me`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    if (!userResponse.ok) {
      console.error("[discord] profile fetch failed", userResponse.status);
      return loginError("discord_profile");
    }
    const user = (await userResponse.json()) as DiscordUser;
    if (!user.id) return loginError("discord_profile");

    const member = await upsertMemberFromDiscord({
      discordId: user.id,
      name: user.global_name?.trim() || user.username,
      email: user.email ?? null,
      emailVerified: Boolean(user.verified && user.email),
      avatarUrl: avatarUrl(user),
    });

    const session = await createSession(member.id);
    const response = NextResponse.redirect(new URL(next, siteUrl()).toString());
    applySessionCookie(response, session.token, session.expiresAt);
    response.cookies.set({ name: OAUTH_STATE_COOKIE, value: "", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("[discord] callback failed", error);
    return loginError("discord_failed");
  }
}
