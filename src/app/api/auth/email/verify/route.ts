import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { toPublicMember, upsertMemberFromEmail } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { errorResponse, json, readJson, safeRedirectPath } from "@/lib/http";
import { consumeLoginToken } from "@/lib/login-token";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { applySessionCookie, createSession, startSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().min(4).max(32),
  next: z.string().optional(),
});

function tooMany() {
  return json(
    { error: "Too many attempts. Try again in a few minutes.", code: "rate_limited" },
    { status: 429 },
  );
}

/** Code inwisselen vanuit het formulier. */
export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(clientKey(request, "verify-email"), 20, 15 * 60 * 1000)) return tooMany();
    const input = schema.parse(await readJson(request));
    const email = await consumeLoginToken(input.email, input.code);
    const member = await upsertMemberFromEmail(email);
    await startSession(member.id);
    return json({
      ok: true,
      member: toPublicMember(member),
      redirect: safeRedirectPath(input.next ?? null),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Code inwisselen via de link uit de mail. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeRedirectPath(params.get("next"));
  const fail = (reason: string) => {
    const url = new URL(`${siteUrl()}/login`);
    url.searchParams.set("error", reason);
    return NextResponse.redirect(url.toString());
  };

  if (!rateLimit(clientKey(request, "verify-email"), 20, 15 * 60 * 1000)) {
    return fail("rate_limited");
  }

  const email = params.get("email");
  const code = params.get("code");
  if (!email || !code) return fail("invalid_link");

  try {
    const verified = await consumeLoginToken(email, code);
    const member = await upsertMemberFromEmail(verified);
    const session = await createSession(member.id);
    const response = NextResponse.redirect(new URL(next, siteUrl()).toString());
    applySessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    console.info("[auth] email link rejected", error instanceof Error ? error.message : error);
    return fail("invalid_code");
  }
}
