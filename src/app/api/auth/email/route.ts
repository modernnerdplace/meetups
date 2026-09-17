import { type NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, json, readJson, safeRedirectPath } from "@/lib/http";
import { issueLoginToken, TOKEN_TTL_MINUTES } from "@/lib/login-token";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().email("That does not look like an email address."),
  next: z.string().optional(),
});

/** Vraagt een eenmalige inlogcode aan. Het antwoord verklapt niet of het adres
 *  al bestaat. */
export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await readJson(request));
    const next = safeRedirectPath(input.next ?? null);

    if (!rateLimit(clientKey(request, "login-email"), 8, 15 * 60 * 1000)) {
      return json(
        { error: "Too many requests. Try again in a few minutes.", code: "rate_limited" },
        { status: 429 },
      );
    }
    if (!rateLimit(`login-email:${input.email.toLowerCase()}`, 4, 15 * 60 * 1000)) {
      return json(
        { error: "Too many requests. Try again in a few minutes.", code: "rate_limited" },
        { status: 429 },
      );
    }

    const result = await issueLoginToken(input.email, next);
    return json({
      sent: true,
      delivered: result.delivered,
      expiresAt: result.expiresAt.toISOString(),
      expiresInMinutes: TOKEN_TTL_MINUTES,
      message: result.delivered
        ? "Check your inbox for the code."
        : "Mail is not set up here, so the code and the link are printed in the server console.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
