import { cache } from "react";
import { MemberRole, type Member } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forbidden, unauthorized } from "@/lib/http";
import { memberForToken, readSessionToken } from "@/lib/session";

/** Het ingelogde lid, of null. Veilig in server components en route handlers.
 *  Binnen één render wordt het resultaat hergebruikt. */
export const getCurrentMember = cache(async (): Promise<Member | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  try {
    return await memberForToken(token);
  } catch (error) {
    console.error("[auth] session lookup failed", error);
    return null;
  }
});

export async function requireMember(): Promise<Member> {
  const member = await getCurrentMember();
  if (!member) throw unauthorized();
  return member;
}

export function isOrganiser(member: Member | null): boolean {
  return member?.role === MemberRole.ORGANISER;
}

/** Dwingt af dat er een organisator ingelogd is. Gooit 401 of 403. */
export async function requireOrganiser(): Promise<Member> {
  const member = await requireMember();
  if (!isOrganiser(member)) throw forbidden();
  return member;
}

/** Wat een lid over zichzelf mag zien. Bewust zonder `notes`: dat veld kan een
 *  dieetwens bevatten en is alleen voor organisatoren. */
export type PublicMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: MemberRole;
  email: string | null;
};

export function toPublicMember(member: Member): PublicMember {
  return {
    id: member.id,
    name: member.name,
    avatarUrl: member.avatarUrl,
    role: member.role,
    email: member.email,
  };
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Koppelt een Discord-account aan een Member: eerst op discordId, daarna op een
 *  bevestigd e-mailadres, anders een nieuw lid. */
export async function upsertMemberFromDiscord(input: {
  discordId: string;
  name: string;
  email?: string | null;
  emailVerified?: boolean;
  avatarUrl?: string | null;
}): Promise<Member> {
  const email = input.email ? normaliseEmail(input.email) : null;

  const byDiscord = await prisma.member.findUnique({
    where: { discordId: input.discordId },
  });
  if (byDiscord) {
    // Een bestaand e-mailadres overschrijven we niet vanuit Discord, en we nemen
    // het adres alleen over als geen ander lid het al heeft.
    let adoptEmail = false;
    if (!byDiscord.email && email && input.emailVerified) {
      const taken = await prisma.member.findUnique({ where: { email } });
      adoptEmail = !taken;
    }
    return prisma.member.update({
      where: { id: byDiscord.id },
      data: {
        name: input.name || byDiscord.name,
        avatarUrl: input.avatarUrl ?? byDiscord.avatarUrl,
        ...(adoptEmail ? { email, emailVerified: byDiscord.emailVerified ?? new Date() } : {}),
      },
    });
  }

  let claimEmail = Boolean(email) && input.emailVerified === true;
  if (email && claimEmail) {
    const byEmail = await prisma.member.findUnique({ where: { email } });
    if (byEmail && !byEmail.discordId) {
      return prisma.member.update({
        where: { id: byEmail.id },
        data: {
          discordId: input.discordId,
          avatarUrl: byEmail.avatarUrl ?? input.avatarUrl ?? null,
          emailVerified: byEmail.emailVerified ?? new Date(),
        },
      });
    }
    // Het adres hoort al bij een ander Discord-account: dan laten we het leeg.
    if (byEmail) claimEmail = false;
  }

  return prisma.member.create({
    data: {
      discordId: input.discordId,
      name: input.name,
      avatarUrl: input.avatarUrl ?? null,
      email: claimEmail ? email : null,
      emailVerified: claimEmail ? new Date() : null,
    },
  });
}

/** Zoekt of maakt een lid op e-mailadres, na het inwisselen van een inlogcode. */
export async function upsertMemberFromEmail(rawEmail: string): Promise<Member> {
  const email = normaliseEmail(rawEmail);
  const existing = await prisma.member.findUnique({ where: { email } });
  if (existing) {
    return existing.emailVerified
      ? existing
      : prisma.member.update({
          where: { id: existing.id },
          data: { emailVerified: new Date() },
        });
  }
  return prisma.member.create({
    data: {
      email,
      emailVerified: new Date(),
      name: email.split("@")[0] ?? "Nerd",
    },
  });
}
