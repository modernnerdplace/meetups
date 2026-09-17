import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { Member } from "@prisma/client";
import { schedulePurge } from "@/lib/cleanup";
import { prisma } from "@/lib/db";
import { isProduction } from "@/lib/env";

export const SESSION_COOKIE = "mnp_session";
export const SESSION_DAYS = 60;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

/** In de database staat alleen de hash. De cookie draagt het ruwe token en nooit
 *  het lid-id, zodat een gelekte database geen sessies oplevert. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(memberId: string) {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  await prisma.authSession.create({
    data: { token: hashToken(token), memberId, expiresAt },
  });
  // Meteen ook de verlopen sessies en gebruikte inlogcodes opruimen.
  schedulePurge();
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_MAX_AGE,
  });
}

export async function startSession(memberId: string) {
  const { token, expiresAt } = await createSession(memberId);
  await setSessionCookie(token, expiresAt);
  return { expiresAt };
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function memberForToken(token: string): Promise<Member | null> {
  const session = await prisma.authSession.findUnique({
    where: { token: hashToken(token) },
    include: { member: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.authSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session.member;
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function endSession() {
  const token = await readSessionToken();
  if (token) {
    await prisma.authSession
      .deleteMany({ where: { token: hashToken(token) } })
      .catch(() => undefined);
  }
  await clearSessionCookie();
}

/** Vergelijking zonder timingverschil, voor codes uit een e-mail. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Zelfde cookie, maar direct op een response gezet. Handig bij een redirect. */
export function applySessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_MAX_AGE,
  });
}
