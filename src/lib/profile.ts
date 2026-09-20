import { Prisma, RsvpStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { conflict } from "@/lib/http";

// Profielen van leden. Een profiel is privé tot het lid het zelf openbaar zet.
// Publieke queries selecteren velden expliciet: e-mail, notities en rol gaan
// nooit mee naar /nerds.

export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

/** Namen die op een route of een rol lijken. */
const RESERVED = new Set([
  "admin", "account", "api", "login", "logout", "new", "edit", "me", "nerds",
  "organizer", "organiser", "moderator", "support", "modernnerdplace", "mnp",
]);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is te lang.`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

/** Alleen https-links, en voor LinkedIn en GitHub ook echt dat domein. */
const optionalUrl = (label: string, hosts?: string[]) =>
  optionalText(300, label).refine((value) => {
    if (value === null) return true;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return false;
      if (!hosts) return true;
      return hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    } catch {
      return false;
    }
  }, hosts ? `${label} moet een https-link naar ${hosts[0]} zijn.` : `${label} moet met https:// beginnen.`);

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
  .transform((value) => value === "on" || value === "true");

export const profileInputSchema = z.object({
  name: z.string({ required_error: "Vul je naam in." }).trim().min(2, "Vul je naam in.").max(80, "Je naam is te lang."),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null))
    .refine(
      (value) => value === null || USERNAME_PATTERN.test(value),
      "3 tot 30 tekens: a t/m z, 0 t/m 9 en streepjes, niet aan het begin of eind.",
    )
    .refine((value) => value === null || !RESERVED.has(value), "Die gebruikersnaam is gereserveerd."),
  company: optionalText(100, "Bedrijf"),
  jobTitle: optionalText(100, "Functie"),
  bio: optionalText(1500, "Bio"),
  websiteUrl: optionalUrl("Website"),
  linkedinUrl: optionalUrl("LinkedIn", ["linkedin.com"]),
  githubUrl: optionalUrl("GitHub", ["github.com"]),
  isMvp: checkbox,
  isMct: checkbox,
  /** Komma-gescheiden in het formulier. */
  interests: z
    .string()
    .optional()
    .transform((value) =>
      Array.from(
        new Set(
          (value ?? "")
            .split(",")
            .map((tag) => tag.trim().replace(/\s+/g, " "))
            .filter((tag) => tag.length > 0),
        ),
      ),
    )
    .refine((tags) => tags.length <= 12, "Maximaal 12 interesses.")
    .refine((tags) => tags.every((tag) => tag.length <= 30), "Een interesse is maximaal 30 tekens."),
  profilePublic: checkbox,
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

export async function updateProfile(memberId: string, input: ProfileInput) {
  // Openbaar zonder gebruikersnaam kan niet: dan is er geen url.
  if (input.profilePublic && !input.username) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["username"],
        message: "Kies een gebruikersnaam om je profiel openbaar te maken.",
      },
    ]);
  }
  const current = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { profilePublic: true, profilePublicAt: true },
  });
  try {
    return await prisma.member.update({
      where: { id: memberId },
      data: {
        ...input,
        profilePublicAt: input.profilePublic
          ? current.profilePublic
            ? current.profilePublicAt
            : new Date()
          : null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("Die gebruikersnaam is al bezet.", "username_taken");
    }
    throw error;
  }
}

const publicSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  company: true,
  jobTitle: true,
  bio: true,
  websiteUrl: true,
  linkedinUrl: true,
  githubUrl: true,
  isMvp: true,
  isMct: true,
  interests: true,
  createdAt: true,
  speaker: { select: { slug: true } },
} satisfies Prisma.MemberSelect;

const publicWhere = { profilePublic: true, username: { not: null } } satisfies Prisma.MemberWhereInput;

export type PublicProfile = Prisma.MemberGetPayload<{ select: typeof publicSelect }>;

/** Events waar iemand bij was: ingecheckt, of aangemeld voor een event dat al
 *  geweest is (niet elke avond werd er ingecheckt). */
function attendedWhere(now = new Date()): Prisma.RsvpWhereInput {
  return {
    status: RsvpStatus.GOING,
    event: { status: "PUBLISHED", startsAt: { lt: now } },
  };
}

export async function listPublicProfiles(options: { q?: string; interest?: string } = {}) {
  const q = options.q?.trim();
  const where: Prisma.MemberWhereInput = {
    ...publicWhere,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { jobTitle: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(options.interest ? { interests: { has: options.interest } } : {}),
  };
  const members = await prisma.member.findMany({
    where,
    orderBy: [{ isMvp: "desc" }, { name: "asc" }],
    take: 300,
    select: publicSelect,
  });
  const counts = await prisma.rsvp.groupBy({
    by: ["memberId"],
    where: { memberId: { in: members.map((m) => m.id) }, ...attendedWhere() },
    _count: { _all: true },
  });
  const byId = new Map(counts.map((row) => [row.memberId, row._count._all]));
  return members.map((member) => ({ ...member, attended: byId.get(member.id) ?? 0 }));
}

/** Alle interesses van publieke profielen, met hoe vaak ze voorkomen. */
export async function publicInterests(): Promise<{ tag: string; count: number }[]> {
  const rows = await prisma.$queryRaw<{ tag: string; count: bigint }[]>`
    SELECT tag, COUNT(*) AS count
    FROM "Member", unnest("interests") AS tag
    WHERE "profilePublic" = true AND "username" IS NOT NULL
    GROUP BY tag
    ORDER BY count DESC, tag ASC
    LIMIT 40`;
  return rows.map((row) => ({ tag: row.tag, count: Number(row.count) }));
}

export async function getPublicProfile(username: string) {
  const member = await prisma.member.findFirst({
    where: { ...publicWhere, username: username.toLowerCase() },
    select: publicSelect,
  });
  if (!member) return null;
  const attended = await prisma.rsvp.findMany({
    where: { memberId: member.id, ...attendedWhere() },
    orderBy: { event: { startsAt: "desc" } },
    select: { event: { select: { slug: true, title: true, startsAt: true, venueName: true } } },
  });
  return { ...member, attended: attended.map((row) => row.event) };
}

/** Wat het lid over zichzelf ziet op /account. */
export async function getOwnAccount(memberId: string) {
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
  const rsvps = await prisma.rsvp.findMany({
    where: { memberId, status: { not: RsvpStatus.CANCELLED } },
    orderBy: { event: { startsAt: "desc" } },
    select: {
      status: true,
      waitlistPosition: true,
      checkedInAt: true,
      event: { select: { slug: true, title: true, startsAt: true } },
    },
  });
  return { member, rsvps };
}

/** Voorstel voor een gebruikersnaam op basis van de naam. */
export function suggestUsername(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}
