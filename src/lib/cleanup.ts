import { prisma } from "@/lib/db";

/**
 * Opruimen van inloggegevens die niets meer doen.
 *
 * Bewaartermijnen, zie docs/avg.md:
 * - `AuthSession`: weg zodra `expiresAt` voorbij is. Een verlopen token kan
 *   niemand meer gebruiken, dus er is geen reden om de rij te bewaren. In de
 *   praktijk is dat uiterlijk 60 dagen na de laatste keer inloggen.
 * - `LoginToken`: weg 24 uur nadat de code gebruikt of verlopen is. De rij bevat
 *   een e-mailadres, dus hoe korter hoe beter. Die ene dag speling is er zodat
 *   een vraag als "mijn code werkte niet" dezelfde dag nog na te kijken is.
 */
export const LOGIN_TOKEN_GRACE_MS = 24 * 60 * 60 * 1000;

/** Hoe vaak het opruimen vanzelf mag draaien bij een nieuwe sessie. */
const AUTO_PURGE_INTERVAL_MS = 60 * 60 * 1000;

export type PurgeResult = { sessions: number; loginTokens: number };

export async function purgeExpiredAuthData(now = new Date()): Promise<PurgeResult> {
  const tokenCutoff = new Date(now.getTime() - LOGIN_TOKEN_GRACE_MS);

  const [sessions, loginTokens] = await Promise.all([
    prisma.authSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.loginToken.deleteMany({
      where: {
        OR: [{ usedAt: { lt: tokenCutoff } }, { expiresAt: { lt: tokenCutoff } }],
      },
    }),
  ]);

  return { sessions: sessions.count, loginTokens: loginTokens.count };
}

// Op globalThis, anders vergeet hot reload wanneer we voor het laatst opruimden.
const globalForPurge = globalThis as unknown as { lastAuthPurge?: number };

/** Ruimt hooguit één keer per uur op, op de achtergrond. Zo gebeurt het ook
 *  zonder cron, en wacht niemand erop tijdens het inloggen. */
export function schedulePurge(): void {
  const now = Date.now();
  if (globalForPurge.lastAuthPurge && now - globalForPurge.lastAuthPurge < AUTO_PURGE_INTERVAL_MS) {
    return;
  }
  globalForPurge.lastAuthPurge = now;
  void purgeExpiredAuthData()
    .then((result) => {
      if (result.sessions > 0 || result.loginTokens > 0) {
        console.info(
          `[cleanup] removed ${result.sessions} expired sessions and ${result.loginTokens} login codes`,
        );
      }
    })
    .catch((error) => {
      // Opruimen mag nooit een inlog laten mislukken.
      console.error("[cleanup] purge failed", error);
    });
}
