import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { badRequest } from "@/lib/http";
import { sendMail, type MailResult } from "@/lib/mail";

/** Zonder klinkers en zonder 0/O en 1/I, want mensen typen deze code over. */
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const CODE_LENGTH = 8;
export const TOKEN_TTL_MINUTES = 15;

export function newLoginCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return code;
}

export function normaliseCode(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function loginLink(email: string, code: string, next: string): string {
  const url = new URL(`${siteUrl()}/api/auth/email/verify`);
  url.searchParams.set("email", email);
  url.searchParams.set("code", code);
  if (next && next !== "/") url.searchParams.set("next", next);
  return url.toString();
}

/** Maakt een eenmalige code, zet oudere codes van dit adres op gebruikt en mailt
 *  de code plus een directe link. */
export async function issueLoginToken(
  rawEmail: string,
  next = "/",
): Promise<MailResult & { expiresAt: Date }> {
  const email = normaliseEmail(rawEmail);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.loginToken.updateMany({
    where: { email, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });

  const code = newLoginCode();
  await prisma.loginToken.create({ data: { email, token: code, expiresAt } });

  const link = loginLink(email, code, next);
  const result = await sendMail({
    to: email,
    subject: `Your Modern Nerdplace login code: ${code}`,
    text: [
      "Here is your login code for Modern Nerdplace:",
      "",
      `    ${code}`,
      "",
      `Or open this link: ${link}`,
      "",
      `The code works once and expires in ${TOKEN_TTL_MINUTES} minutes.`,
      "Did you not ask for this? Then ignore this mail.",
    ].join("\n"),
  });

  return { ...result, expiresAt };
}

/** Wisselt een code in. Gooit als hij niet klopt, verlopen of al gebruikt is. */
export async function consumeLoginToken(rawEmail: string, rawCode: string): Promise<string> {
  const email = normaliseEmail(rawEmail);
  const code = normaliseCode(rawCode);
  const invalid = badRequest("That code is not valid any more. Ask for a new one.", "invalid_code");

  const token = await prisma.loginToken.findUnique({ where: { token: code } });
  if (!token || token.email !== email) throw invalid;
  if (token.usedAt) throw invalid;
  if (token.expiresAt.getTime() <= Date.now()) throw invalid;

  // Eenmalig: alleen de update die usedAt van null naar nu zet, telt.
  const claimed = await prisma.loginToken.updateMany({
    where: { id: token.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) throw invalid;

  // Andere openstaande codes van dit adres zijn nu ook niet meer nodig.
  await prisma.loginToken.updateMany({
    where: { email, usedAt: null },
    data: { usedAt: new Date() },
  });

  return email;
}
