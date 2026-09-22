import { Prisma } from "@prisma/client";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/lib/http";
import { amsterdamLocalToUtc } from "@/lib/time";

// Het programma van een avond: sessies met sprekers, de locatie en de sponsors.
// Alles wat hier schrijft wordt aangeroepen vanuit een server action die eerst
// de rol controleert.

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is te lang.`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const optionalUrl = (label: string) =>
  optionalText(500, label).refine(
    (value) => value === null || /^https?:\/\/\S+$/i.test(value),
    `${label} moet beginnen met http:// of https://.`,
  );

const localDateTime = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const date = amsterdamLocalToUtc(value);
      if (!date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is geen geldige tijd.` });
        return z.NEVER;
      }
      return date;
    });

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Maakt van een naam een vrije slug: bij botsing komt er -2, -3 achter. */
async function freeSlug(table: "venue" | "sponsor" | "speaker", name: string, skipId?: string) {
  const base = slugify(name) || table;
  for (let i = 0; i < 50; i += 1) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const existing =
      table === "venue"
        ? await prisma.venue.findUnique({ where: { slug }, select: { id: true } })
        : table === "sponsor"
          ? await prisma.sponsor.findUnique({ where: { slug }, select: { id: true } })
          : await prisma.speaker.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === skipId) return slug;
  }
  throw conflict("Kies een andere naam, deze levert geen vrije url op.", "slug_taken");
}

// ---------------------------------------------------------------- sessies

export const sessionInputSchema = z
  .object({
    title: z.string({ required_error: "Geef de sessie een titel." }).trim().min(2, "Geef de sessie een titel.").max(160, "De titel is te lang."),
    abstract: optionalText(4000, "Omschrijving"),
    startsAt: localDateTime("Begintijd"),
    endsAt: localDateTime("Eindtijd"),
    room: optionalText(80, "Zaal"),
    slidesUrl: optionalUrl("Slides"),
    recordingUrl: optionalUrl("Opname"),
    /** Komma-gescheiden lijst met speaker-ids uit het formulier. */
    speakerIds: z
      .string()
      .optional()
      .transform((value) =>
        Array.from(new Set((value ?? "").split(",").map((id) => id.trim()).filter(Boolean))),
      )
      .refine((ids) => ids.length <= 6, "Maximaal 6 sprekers per sessie."),
  })
  .superRefine((value, ctx) => {
    if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "De eindtijd moet na de begintijd liggen." });
    }
  });

export type SessionInput = z.infer<typeof sessionInputSchema>;

function speakerRows(speakerIds: string[]) {
  return speakerIds.map((speakerId, position) => ({ speakerId, position }));
}

export async function createSession(eventId: string, input: SessionInput, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId }, select: { id: true, title: true } });
    if (!event) throw notFound("Dat event bestaat niet.");
    const last = await tx.eventSession.findFirst({
      where: { eventId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const session = await tx.eventSession.create({
      data: {
        eventId,
        title: input.title,
        abstract: input.abstract,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        room: input.room,
        slidesUrl: input.slidesUrl,
        recordingUrl: input.recordingUrl,
        position: (last?.position ?? -1) + 1,
        speakers: { create: speakerRows(input.speakerIds) },
      },
    });
    await recordAudit(tx, {
      actorId,
      action: "session.create",
      entityType: "event",
      entityId: session.id,
      summary: `Sessie "${session.title}" toegevoegd aan "${event.title}"`,
      data: { eventId, speakers: input.speakerIds.length },
    });
    return session;
  });
}

export async function updateSession(sessionId: string, input: SessionInput, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.eventSession.findUnique({
      where: { id: sessionId },
      include: { event: { select: { id: true, title: true } } },
    });
    if (!before) throw notFound("Die sessie bestaat niet.");
    const session = await tx.eventSession.update({
      where: { id: sessionId },
      data: {
        title: input.title,
        abstract: input.abstract,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        room: input.room,
        slidesUrl: input.slidesUrl,
        recordingUrl: input.recordingUrl,
        // Sprekers opnieuw zetten: simpeler dan diffen, en de tabel is klein.
        speakers: { deleteMany: {}, create: speakerRows(input.speakerIds) },
      },
    });
    await recordAudit(tx, {
      actorId,
      action: "session.update",
      entityType: "event",
      entityId: session.id,
      summary: `Sessie "${session.title}" gewijzigd in "${before.event.title}"`,
      data: { eventId: before.eventId },
    });
    return session;
  });
}

export async function deleteSession(sessionId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.eventSession.findUnique({
      where: { id: sessionId },
      include: { event: { select: { id: true, title: true } } },
    });
    if (!session) throw notFound("Die sessie bestaat niet.");
    await tx.eventSession.delete({ where: { id: sessionId } });
    await recordAudit(tx, {
      actorId,
      action: "session.delete",
      entityType: "event",
      entityId: session.id,
      summary: `Sessie "${session.title}" verwijderd uit "${session.event.title}"`,
      data: { eventId: session.eventId },
    });
    return session.eventId;
  });
}

/** Een sessie een plek omhoog of omlaag in het programma. */
export async function moveSession(sessionId: string, direction: "up" | "down", actorId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.eventSession.findUnique({ where: { id: sessionId } });
    if (!session) throw notFound("Die sessie bestaat niet.");
    const neighbour = await tx.eventSession.findFirst({
      where:
        direction === "up"
          ? { eventId: session.eventId, position: { lt: session.position } }
          : { eventId: session.eventId, position: { gt: session.position } },
      orderBy: { position: direction === "up" ? "desc" : "asc" },
    });
    if (!neighbour) return session.eventId;
    await tx.eventSession.update({ where: { id: session.id }, data: { position: neighbour.position } });
    await tx.eventSession.update({ where: { id: neighbour.id }, data: { position: session.position } });
    await recordAudit(tx, {
      actorId,
      action: "session.move",
      entityType: "event",
      entityId: session.id,
      summary: `Sessie "${session.title}" verplaatst in het programma`,
      data: { eventId: session.eventId, direction },
    });
    return session.eventId;
  });
}

// ---------------------------------------------------------------- sprekers

export const speakerInputSchema = z.object({
  name: z.string({ required_error: "Vul een naam in." }).trim().min(2, "Vul een naam in.").max(80, "De naam is te lang."),
  bio: optionalText(4000, "Bio"),
  avatarUrl: optionalUrl("Foto"),
  website: optionalUrl("Website"),
  linkedin: optionalUrl("LinkedIn"),
  mastodon: optionalUrl("Mastodon"),
  /** Optioneel gekoppeld aan een lid, zodat het profiel en de spreker samenvallen. */
  memberId: optionalText(64, "Lid"),
});

export type SpeakerInput = z.infer<typeof speakerInputSchema>;

function linksJson(input: SpeakerInput): Prisma.InputJsonValue {
  const links: Record<string, string> = {};
  if (input.website) links.website = input.website;
  if (input.linkedin) links.linkedin = input.linkedin;
  if (input.mastodon) links.mastodon = input.mastodon;
  return links;
}

export async function createSpeaker(input: SpeakerInput, actorId: string) {
  const slug = await freeSlug("speaker", input.name);
  return prisma.$transaction(async (tx) => {
    const speaker = await tx.speaker.create({
      data: {
        slug,
        name: input.name,
        bio: input.bio,
        avatarUrl: input.avatarUrl,
        links: linksJson(input),
        memberId: input.memberId,
      },
    });
    await recordAudit(tx, {
      actorId,
      action: "speaker.create",
      entityType: "member",
      entityId: speaker.id,
      summary: `Spreker ${speaker.name} aangemaakt`,
      data: { slug },
    });
    return speaker;
  });
}

export async function updateSpeaker(speakerId: string, input: SpeakerInput, actorId: string) {
  const before = await prisma.speaker.findUnique({ where: { id: speakerId } });
  if (!before) throw notFound("Die spreker bestaat niet.");
  const slug = before.name === input.name ? before.slug : await freeSlug("speaker", input.name, speakerId);
  return prisma.$transaction(async (tx) => {
    const speaker = await tx.speaker.update({
      where: { id: speakerId },
      data: {
        slug,
        name: input.name,
        bio: input.bio,
        avatarUrl: input.avatarUrl,
        links: linksJson(input),
        memberId: input.memberId,
      },
    });
    await recordAudit(tx, {
      actorId,
      action: "speaker.update",
      entityType: "member",
      entityId: speaker.id,
      summary: `Spreker ${speaker.name} gewijzigd`,
    });
    return speaker;
  });
}

export async function deleteSpeaker(speakerId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const speaker = await tx.speaker.findUnique({
      where: { id: speakerId },
      include: { _count: { select: { sessions: true } } },
    });
    if (!speaker) throw notFound("Die spreker bestaat niet.");
    if (speaker._count.sessions > 0) {
      throw badRequest("Deze spreker staat nog bij een sessie. Haal hem daar eerst weg.", "speaker_in_use");
    }
    await tx.speaker.delete({ where: { id: speakerId } });
    await recordAudit(tx, {
      actorId,
      action: "speaker.delete",
      entityType: "member",
      entityId: speaker.id,
      summary: `Spreker ${speaker.name} verwijderd`,
    });
  });
}

// ---------------------------------------------------------------- locaties

export const venueInputSchema = z.object({
  name: z.string({ required_error: "Vul een naam in." }).trim().min(2, "Vul een naam in.").max(120, "De naam is te lang."),
  address: optionalText(300, "Adres"),
  city: optionalText(80, "Plaats"),
  url: optionalUrl("Website"),
  notes: optionalText(2000, "Notities"),
});

export type VenueInput = z.infer<typeof venueInputSchema>;

export async function createVenue(input: VenueInput, actorId: string) {
  const slug = await freeSlug("venue", input.name);
  return prisma.$transaction(async (tx) => {
    const venue = await tx.venue.create({ data: { slug, ...input } });
    await recordAudit(tx, {
      actorId,
      action: "venue.create",
      entityType: "event",
      entityId: venue.id,
      summary: `Locatie ${venue.name} aangemaakt`,
      data: { slug },
    });
    return venue;
  });
}

export async function updateVenue(venueId: string, input: VenueInput, actorId: string) {
  const before = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!before) throw notFound("Die locatie bestaat niet.");
  const slug = before.name === input.name ? before.slug : await freeSlug("venue", input.name, venueId);
  return prisma.$transaction(async (tx) => {
    const venue = await tx.venue.update({ where: { id: venueId }, data: { slug, ...input } });
    await recordAudit(tx, {
      actorId,
      action: "venue.update",
      entityType: "event",
      entityId: venue.id,
      summary: `Locatie ${venue.name} gewijzigd`,
    });
    return venue;
  });
}

export async function deleteVenue(venueId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const venue = await tx.venue.findUnique({
      where: { id: venueId },
      include: { _count: { select: { events: true } } },
    });
    if (!venue) throw notFound("Die locatie bestaat niet.");
    if (venue._count.events > 0) {
      throw badRequest("Deze locatie hangt nog aan een event.", "venue_in_use");
    }
    await tx.venue.delete({ where: { id: venueId } });
    await recordAudit(tx, {
      actorId,
      action: "venue.delete",
      entityType: "event",
      entityId: venue.id,
      summary: `Locatie ${venue.name} verwijderd`,
    });
  });
}

/** Koppelt een event aan een locatie (of maakt de koppeling los met null). */
export async function setEventVenue(eventId: string, venueId: string | null, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId }, select: { title: true } });
    if (!event) throw notFound("Dat event bestaat niet.");
    const venue = venueId
      ? await tx.venue.findUnique({ where: { id: venueId } })
      : null;
    if (venueId && !venue) throw notFound("Die locatie bestaat niet.");
    await tx.event.update({
      where: { id: eventId },
      data: {
        venueId: venue?.id ?? null,
        // De vrije tekstvelden blijven leidend voor wat er op de site staat.
        venueName: venue?.name ?? null,
        venueAddress: venue?.address ?? null,
        venueUrl: venue?.url ?? null,
      },
    });
    await recordAudit(tx, {
      actorId,
      action: "event.venue",
      entityType: "event",
      entityId: eventId,
      summary: venue ? `"${event.title}" is bij ${venue.name}` : `Locatie losgekoppeld van "${event.title}"`,
      data: { eventId, venueId: venue?.id ?? null },
    });
  });
}

// ---------------------------------------------------------------- sponsors

export const sponsorInputSchema = z.object({
  name: z.string({ required_error: "Vul een naam in." }).trim().min(2, "Vul een naam in.").max(120, "De naam is te lang."),
  url: optionalUrl("Website"),
  logoUrl: optionalUrl("Logo"),
  description: optionalText(1000, "Omschrijving"),
});

export type SponsorInput = z.infer<typeof sponsorInputSchema>;

export async function createSponsor(input: SponsorInput, actorId: string) {
  const slug = await freeSlug("sponsor", input.name);
  return prisma.$transaction(async (tx) => {
    const sponsor = await tx.sponsor.create({ data: { slug, ...input } });
    await recordAudit(tx, {
      actorId,
      action: "sponsor.create",
      entityType: "event",
      entityId: sponsor.id,
      summary: `Sponsor ${sponsor.name} aangemaakt`,
      data: { slug },
    });
    return sponsor;
  });
}

export async function updateSponsor(sponsorId: string, input: SponsorInput, actorId: string) {
  const before = await prisma.sponsor.findUnique({ where: { id: sponsorId } });
  if (!before) throw notFound("Die sponsor bestaat niet.");
  const slug = before.name === input.name ? before.slug : await freeSlug("sponsor", input.name, sponsorId);
  return prisma.$transaction(async (tx) => {
    const sponsor = await tx.sponsor.update({ where: { id: sponsorId }, data: { slug, ...input } });
    await recordAudit(tx, {
      actorId,
      action: "sponsor.update",
      entityType: "event",
      entityId: sponsor.id,
      summary: `Sponsor ${sponsor.name} gewijzigd`,
    });
    return sponsor;
  });
}

export async function deleteSponsor(sponsorId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const sponsor = await tx.sponsor.findUnique({ where: { id: sponsorId } });
    if (!sponsor) throw notFound("Die sponsor bestaat niet.");
    await tx.sponsor.delete({ where: { id: sponsorId } });
    await recordAudit(tx, {
      actorId,
      action: "sponsor.delete",
      entityType: "event",
      entityId: sponsor.id,
      summary: `Sponsor ${sponsor.name} verwijderd`,
    });
  });
}

export async function setEventSponsors(
  eventId: string,
  sponsors: { sponsorId: string; role: string | null }[],
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId }, select: { title: true } });
    if (!event) throw notFound("Dat event bestaat niet.");
    await tx.eventSponsor.deleteMany({ where: { eventId } });
    if (sponsors.length > 0) {
      await tx.eventSponsor.createMany({
        data: sponsors.map((row, position) => ({
          eventId,
          sponsorId: row.sponsorId,
          role: row.role,
          position,
        })),
      });
    }
    await recordAudit(tx, {
      actorId,
      action: "event.sponsors",
      entityType: "event",
      entityId: eventId,
      summary: `Sponsors van "${event.title}" bijgewerkt (${sponsors.length})`,
      data: { eventId, sponsorIds: sponsors.map((s) => s.sponsorId) },
    });
  });
}
