import { EventStatus, RsvpStatus } from "@prisma/client";

import { db } from "./db";

/** Alleen gepubliceerde events zijn publiek zichtbaar. Geannuleerde tonen we wel,
 *  met een label, zodat een gedeelde link niet ineens doodloopt. */
const visibleStatus = { in: [EventStatus.PUBLISHED, EventStatus.CANCELLED] };

const listSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  startsAt: true,
  endsAt: true,
  status: true,
  venueName: true,
  coverImageUrl: true,
  recordingUrl: true,
  meetupComUrl: true,
  importedAttendees: true,
} as const;

export type EventListItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  startsAt: Date;
  endsAt: Date | null;
  status: EventStatus;
  venueName: string | null;
  coverImageUrl: string | null;
  recordingUrl: string | null;
  meetupComUrl: string | null;
  importedAttendees: number | null;
};

export function getUpcomingEvents(limit?: number) {
  return db.event.findMany({
    where: { status: visibleStatus, startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    take: limit,
    select: listSelect,
  });
}

export function getPastEvents(limit?: number) {
  return db.event.findMany({
    where: { status: visibleStatus, startsAt: { lt: new Date() } },
    orderBy: { startsAt: "desc" },
    take: limit,
    select: listSelect,
  });
}

export async function getNextEvent() {
  const [next] = await getUpcomingEvents(1);
  return next ?? null;
}

export function getEventBySlug(slug: string) {
  return db.event.findFirst({
    where: { slug, status: visibleStatus },
    include: {
      venue: true,
      sponsors: {
        orderBy: { position: "asc" },
        include: { sponsor: true },
      },
      sessions: {
        orderBy: { position: "asc" },
        include: {
          speakers: {
            orderBy: { position: "asc" },
            include: { speaker: { select: { slug: true, name: true, avatarUrl: true } } },
          },
        },
      },
    },
  });
}

export function countGoing(eventId: string) {
  return db.rsvp.count({ where: { eventId, status: RsvpStatus.GOING } });
}

export function getSpeakerBySlug(slug: string) {
  return db.speaker.findUnique({
    where: { slug },
    include: {
      sessions: {
        include: {
          session: {
            include: {
              event: {
                select: { slug: true, title: true, startsAt: true, status: true, recordingUrl: true },
              },
            },
          },
        },
      },
    },
  });
}

export function getEventSlugs() {
  return db.event.findMany({
    where: { status: visibleStatus },
    select: { slug: true },
  });
}

export function getSpeakerSlugs() {
  return db.speaker.findMany({ select: { slug: true } });
}

/** Links die in Speaker.links staan, als een net lijstje. */
export function normaliseSpeakerLinks(links: unknown): { label: string; url: string }[] {
  if (!links || typeof links !== "object" || Array.isArray(links)) return [];
  const labels: Record<string, string> = {
    website: "Website",
    linkedin: "LinkedIn",
    mastodon: "Mastodon",
    bluesky: "Bluesky",
    github: "GitHub",
    x: "X",
    twitter: "X",
    youtube: "YouTube",
    blog: "Blog",
  };
  return Object.entries(links as Record<string, unknown>)
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .map(([key, value]) => ({
      label: labels[key.toLowerCase()] ?? key,
      url: String(value).trim(),
    }))
    .filter((link) => /^https?:\/\//i.test(link.url) || link.url.startsWith("mailto:"));
}

/** Het jaar van de oudste meetup, voor de regel "sinds ...". */
export async function getFirstEventYear() {
  const first = await db.event.findFirst({
    where: { status: visibleStatus },
    orderBy: { startsAt: "asc" },
    select: { startsAt: true },
  });
  return first ? first.startsAt : null;
}
