import { MemberRole, RsvpStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Alleen voor het beheer. De pagina's hieronder zitten achter requireOrganiser in
// de layout, en elke mutatie controleert de rol opnieuw in actions.ts.

export type RsvpCounts = { going: number; waitlist: number; checkedIn: number };

/** Aantallen per event in drie queries, in plaats van een per event. */
export async function rsvpCountsByEvent(eventIds: string[]): Promise<Map<string, RsvpCounts>> {
  const map = new Map<string, RsvpCounts>();
  for (const id of eventIds) map.set(id, { going: 0, waitlist: 0, checkedIn: 0 });
  if (eventIds.length === 0) return map;

  const [byStatus, checkedIn] = await Promise.all([
    prisma.rsvp.groupBy({
      by: ["eventId", "status"],
      where: { eventId: { in: eventIds }, status: { in: [RsvpStatus.GOING, RsvpStatus.WAITLIST] } },
      _count: { _all: true },
    }),
    prisma.rsvp.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds }, checkedInAt: { not: null } },
      _count: { _all: true },
    }),
  ]);
  for (const row of byStatus) {
    const counts = map.get(row.eventId);
    if (!counts) continue;
    if (row.status === RsvpStatus.GOING) counts.going = row._count._all;
    if (row.status === RsvpStatus.WAITLIST) counts.waitlist = row._count._all;
  }
  for (const row of checkedIn) {
    const counts = map.get(row.eventId);
    if (counts) counts.checkedIn = row._count._all;
  }
  return map;
}

const eventListSelect = {
  id: true,
  slug: true,
  title: true,
  startsAt: true,
  status: true,
  capacity: true,
  venueName: true,
  importedAttendees: true,
  meetupComUrl: true,
} satisfies Prisma.EventSelect;

export async function listEvents(filter: "upcoming" | "past" | "all") {
  const now = new Date();
  const where: Prisma.EventWhereInput =
    filter === "upcoming"
      ? { startsAt: { gte: now } }
      : filter === "past"
        ? { startsAt: { lt: now } }
        : {};
  const events = await prisma.event.findMany({
    where,
    orderBy: { startsAt: filter === "upcoming" ? "asc" : "desc" },
    select: eventListSelect,
  });
  const counts = await rsvpCountsByEvent(events.map((event) => event.id));
  return events.map((event) => ({ ...event, counts: counts.get(event.id)! }));
}

export type AdminEventRow = Awaited<ReturnType<typeof listEvents>>[number];

export async function getDashboard() {
  const now = new Date();
  const [upcoming, members, organisers, totalCheckIns, recentAudit, newMembers] = await Promise.all([
    listEvents("upcoming"),
    prisma.member.count(),
    prisma.member.count({ where: { role: { in: [MemberRole.ORGANISER, MemberRole.ADMIN] } } }),
    prisma.rsvp.count({ where: { checkedInAt: { not: null } } }),
    listAudit({ take: 8 }),
    prisma.member.count({
      where: { createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
    }),
  ]);
  return { upcoming, members, organisers, totalCheckIns, recentAudit, newMembers };
}

export function getEventForEdit(id: string) {
  return prisma.event.findUnique({ where: { id } });
}

/** Aanmeldingen voor het beheer. Hier mag de opmerking wel mee: alleen
 *  organisatoren zien deze pagina. E-mail blijft eruit, die is niet nodig. */
export function listRegistrations(eventId: string) {
  return prisma.rsvp.findMany({
    where: { eventId },
    orderBy: [{ status: "asc" }, { waitlistPosition: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      status: true,
      waitlistPosition: true,
      checkedInAt: true,
      note: true,
      createdAt: true,
      member: { select: { id: true, name: true, company: true, avatarUrl: true } },
    },
  });
}

export type Registration = Awaited<ReturnType<typeof listRegistrations>>[number];

/** E-mailadressen alleen voor admins: organisatoren hebben ze niet nodig om een
 *  avond te draaien, dus die zoeken en zien ze ook niet. */
export async function listMembers(query: string | undefined, options: { withEmail: boolean }) {
  const q = query?.trim();
  const where: Prisma.MemberWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
          ...(options.withEmail ? [{ email: { contains: q, mode: "insensitive" as const } }] : []),
        ],
      }
    : {};
  const members = await prisma.member.findMany({
    where,
    orderBy: [{ role: "desc" }, { name: "asc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      role: true,
      discordId: true,
      avatarUrl: true,
      createdAt: true,
    },
  });
  const ids = members.map((member) => member.id);
  const [registered, attended] = await Promise.all([
    prisma.rsvp.groupBy({
      by: ["memberId"],
      where: { memberId: { in: ids }, status: { not: RsvpStatus.CANCELLED } },
      _count: { _all: true },
    }),
    prisma.rsvp.groupBy({
      by: ["memberId"],
      where: { memberId: { in: ids }, checkedInAt: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const reg = new Map(registered.map((row) => [row.memberId, row._count._all]));
  const att = new Map(attended.map((row) => [row.memberId, row._count._all]));
  return members.map((member) => ({
    ...member,
    email: options.withEmail ? member.email : null,
    registrations: reg.get(member.id) ?? 0,
    attended: att.get(member.id) ?? 0,
  }));
}

/** Met `eventId` alleen de regels over dat event, inclusief de aanmeldingen ervan. */
export function listAudit(options: { take?: number; eventId?: string } = {}) {
  const where: Prisma.AuditLogWhereInput = options.eventId
    ? {
        OR: [
          { entityType: "event", entityId: options.eventId },
          { data: { path: ["eventId"], equals: options.eventId } },
        ],
      }
    : {};
  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options.take ?? 100,
    select: {
      id: true,
      action: true,
      summary: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });
}

export type AuditRow = Awaited<ReturnType<typeof listAudit>>[number];

// ---------------------------------------------------------------- programma

export function getEventProgramme(eventId: string) {
  return prisma.eventSession.findMany({
    where: { eventId },
    orderBy: { position: "asc" },
    include: {
      speakers: {
        orderBy: { position: "asc" },
        include: { speaker: { select: { id: true, name: true, slug: true } } },
      },
    },
  });
}

export type ProgrammeSession = Awaited<ReturnType<typeof getEventProgramme>>[number];

export function listSpeakers() {
  return prisma.speaker.findMany({
    orderBy: { name: "asc" },
    include: {
      member: { select: { id: true, name: true } },
      _count: { select: { sessions: true } },
    },
  });
}

export type SpeakerRow = Awaited<ReturnType<typeof listSpeakers>>[number];

export function listVenues() {
  return prisma.venue.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { events: true } } },
  });
}

export type VenueRow = Awaited<ReturnType<typeof listVenues>>[number];

export function listSponsors() {
  return prisma.sponsor.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { events: true } } },
  });
}

export type SponsorRow = Awaited<ReturnType<typeof listSponsors>>[number];

export function getEventSponsors(eventId: string) {
  return prisma.eventSponsor.findMany({
    where: { eventId },
    orderBy: { position: "asc" },
    include: { sponsor: { select: { id: true, name: true } } },
  });
}

/** Leden die aan een spreker gekoppeld kunnen worden. */
export function listMembersForSpeaker() {
  return prisma.member.findMany({
    orderBy: { name: "asc" },
    take: 300,
    select: { id: true, name: true, speaker: { select: { id: true } } },
  });
}
