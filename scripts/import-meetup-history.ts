/**
 * Import of the Modern Nerdplace history from meetup.com.
 *
 * Bron van waarheid is `data/meetup-history.json`. Dat bestand is een keer
 * opgehaald van de publieke groepspagina, zodat de import niet elke keer hoeft
 * te scrapen. Wat meetup.com niet publiceert (samenvatting, website van de
 * locatie, capaciteit, talks, sprekers, opnames) blijft leeg.
 *
 * Idempotent: elk event gaat via een upsert op `Event.meetupComUrl`, dus
 * opnieuw draaien levert geen dubbele rijen op.
 *
 * Draaien: `npm run import:meetup`
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { EventStatus, PrismaClient } from "@prisma/client";

export type MeetupHistoryVenue = {
  name: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
};

export type MeetupHistoryEvent = {
  meetupComId: string;
  meetupComUrl: string;
  title: string;
  /** Local time as meetup.com shows it, including the UTC offset. */
  startsAtLocal: string;
  endsAtLocal: string | null;
  startsAtUtc: string;
  endsAtUtc: string | null;
  description: string | null;
  venue: MeetupHistoryVenue | null;
  attendees: number | null;
};

export type MeetupHistoryFile = {
  source: Record<string, string>;
  group: {
    name: string;
    urlname: string;
    timezone: string;
    memberCount: number;
    organiser: string;
    pastEventCount: number;
  };
  events: MeetupHistoryEvent[];
};

export type ImportResult = {
  created: number;
  updated: number;
  total: number;
  importedAt: Date;
};

const DATA_FILE = path.join("data", "meetup-history.json");

/** Zoekt het JSON-bestand vanaf de huidige map omhoog, zodat het ook werkt
 *  wanneer de import vanuit een submap wordt gestart. */
export function resolveHistoryFile(explicitPath?: string): string {
  if (explicitPath) return path.resolve(explicitPath);

  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, DATA_FILE);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    `Could not find ${DATA_FILE}. Run the import from the project root.`,
  );
}

export function loadHistory(explicitPath?: string): MeetupHistoryFile {
  const file = resolveHistoryFile(explicitPath);
  const parsed = JSON.parse(readFileSync(file, "utf8")) as MeetupHistoryFile;

  if (!Array.isArray(parsed.events) || parsed.events.length === 0) {
    throw new Error(`${file} contains no events.`);
  }

  return parsed;
}

/**
 * Zet een datum met expliciete offset om naar UTC. De offset staat in de data
 * (+01:00 in de winter, +02:00 in de zomer), dus de zomertijd klopt vanzelf.
 * Een datum zonder offset weigeren we: die zouden we maar moeten raden.
 */
export function toUtc(value: string, field: string): Date {
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    throw new Error(
      `${field} "${value}" has no UTC offset, so the time zone would be a guess.`,
    );
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} "${value}" is not a valid date.`);
  }

  return date;
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slug uit datum en titel, bijvoorbeeld `2025-10-29-meetup-cloudspace-365`.
 * De groepsnaam valt weg, want die staat al in elke titel.
 */
export function baseSlug(event: MeetupHistoryEvent, groupName: string): string {
  const day = event.startsAtLocal.slice(0, 10);
  const prefix = groupName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const title = event.title.replace(new RegExp(`^${prefix}\\s+`, "i"), "");
  const titlePart = slugify(title) || slugify(event.title) || event.meetupComId;
  return `${day}-${titlePart}`;
}

export async function importMeetupHistory(
  prisma: PrismaClient,
  options: { file?: string; log?: (message: string) => void } = {},
): Promise<ImportResult> {
  const log = options.log ?? (() => {});
  const history = loadHistory(options.file);
  const importedAt = new Date();

  let created = 0;
  let updated = 0;
  const usedSlugs = new Set<string>();

  const events = [...history.events].sort((a, b) =>
    a.startsAtUtc.localeCompare(b.startsAtUtc),
  );

  for (const event of events) {
    const startsAt = toUtc(event.startsAtLocal, `${event.meetupComId} startsAt`);
    const endsAt = event.endsAtLocal
      ? toUtc(event.endsAtLocal, `${event.meetupComId} endsAt`)
      : null;

    const existing = await prisma.event.findUnique({
      where: { meetupComUrl: event.meetupComUrl },
      select: { id: true, slug: true },
    });

    // Slug blijft bij een update staan: publieke URL's moeten niet verspringen.
    const slug =
      existing?.slug ??
      (await uniqueSlug(
        prisma,
        baseSlug(event, history.group.name),
        event.meetupComUrl,
        usedSlugs,
      ));

    // Alleen velden die van meetup.com komen. De rest (summary, venueUrl,
    // capacity, cover, opname) blijft van de redactie in de app zelf.
    const fromMeetup = {
      title: event.title,
      description: event.description,
      startsAt,
      endsAt,
      status: EventStatus.PUBLISHED,
      venueName: event.venue?.name ?? null,
      venueAddress: event.venue?.address ?? null,
      importedAttendees: event.attendees,
      importedAt,
    };

    await prisma.event.upsert({
      where: { meetupComUrl: event.meetupComUrl },
      create: { slug, meetupComUrl: event.meetupComUrl, ...fromMeetup },
      update: fromMeetup,
    });

    if (existing) {
      updated++;
      log(`updated  ${startsAt.toISOString()}  ${event.title}`);
    } else {
      created++;
      usedSlugs.add(slug);
      log(`imported ${startsAt.toISOString()}  ${slug}`);
    }
  }

  return { created, updated, total: events.length, importedAt };
}

/** Houdt de slug uniek, ook als twee events dezelfde titel op dezelfde dag hebben. */
async function uniqueSlug(
  prisma: PrismaClient,
  base: string,
  meetupComUrl: string,
  usedSlugs: Set<string>,
): Promise<string> {
  let candidate = base;

  for (let suffix = 2; suffix < 50; suffix++) {
    const clash = usedSlugs.has(candidate)
      ? true
      : await prisma.event
          .findUnique({ where: { slug: candidate }, select: { meetupComUrl: true } })
          .then((row) => row !== null && row.meetupComUrl !== meetupComUrl);

    if (!clash) return candidate;
    candidate = `${base}-${suffix}`;
  }

  throw new Error(`Could not find a free slug for ${base}.`);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    const result = await importMeetupHistory(prisma, {
      log: (message) => console.log(message),
    });
    console.log(
      `\nDone. ${result.total} events from meetup.com: ${result.created} new, ${result.updated} updated.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedFile.endsWith(path.join("scripts", "import-meetup-history.ts"))) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
