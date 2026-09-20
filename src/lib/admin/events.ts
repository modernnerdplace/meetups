import { EventStatus, Prisma, type Event } from "@prisma/client";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/lib/http";
import {
  inSerializableTransaction,
  promoteFromWaitlist,
  renumberWaitlist,
} from "@/lib/rsvp";
import { amsterdamDateStamp, amsterdamLocalToUtc } from "@/lib/time";

/** Lege formuliervelden worden null, zodat een veld ook weer leeg te maken is. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is te lang.`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const optionalUrl = (label: string) =>
  optionalText(2000, label).refine(
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
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is geen geldige datum.` });
        return z.NEVER;
      }
      return date;
    });

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const eventInputSchema = z
  .object({
    title: z
      .string({ required_error: "Geef het event een titel." })
      .trim()
      .min(3, "Geef het event een titel.")
      .max(160, "De titel is te lang."),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(120, "De slug is te lang.")
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null))
      .refine(
        (value) => value === null || SLUG_PATTERN.test(value),
        "Een slug bestaat alleen uit a t/m z, 0 t/m 9 en losse streepjes.",
      ),
    summary: optionalText(300, "Samenvatting"),
    description: optionalText(20_000, "Beschrijving"),
    startsAt: localDateTime("Begin"),
    endsAt: localDateTime("Einde"),
    venueName: optionalText(160, "Locatie"),
    venueAddress: optionalText(300, "Adres"),
    venueUrl: optionalUrl("Link naar de locatie"),
    capacity: z
      .string()
      .trim()
      .optional()
      .transform((value, ctx) => {
        if (!value) return null;
        const number = Number(value);
        if (!Number.isInteger(number) || number < 1 || number > 10_000) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Capaciteit is een heel getal van 1 tot 10000, of leeg.",
          });
          return z.NEVER;
        }
        return number;
      }),
    coverImageUrl: optionalUrl("Omslagafbeelding"),
    recordingUrl: optionalUrl("Opname"),
  })
  .superRefine((value, ctx) => {
    if (value.startsAt === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startsAt"], message: "Kies een begintijd." });
    }
    if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "Het einde moet na het begin liggen.",
      });
    }
  });

export type EventInput = z.infer<typeof eventInputSchema>;

/** FormData naar een gewoon object met alleen string-waarden. */
export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/modern nerdplace/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Zelfde vorm als de geimporteerde events: 2025-10-29-meetup-cloudspace-365. */
function defaultSlug(title: string, startsAt: Date): string {
  const base = slugify(title) || "meetup";
  return `${amsterdamDateStamp(startsAt)}-${base}`;
}

function eventData(input: EventInput, slug: string) {
  return {
    slug,
    title: input.title,
    summary: input.summary,
    description: input.description,
    // superRefine garandeert dat startsAt er is.
    startsAt: input.startsAt as Date,
    endsAt: input.endsAt,
    venueName: input.venueName,
    venueAddress: input.venueAddress,
    venueUrl: input.venueUrl,
    capacity: input.capacity,
    coverImageUrl: input.coverImageUrl,
    recordingUrl: input.recordingUrl,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Welke velden zijn veranderd, zonder de lange beschrijving zelf te loggen. */
function changedFields(before: Event, after: ReturnType<typeof eventData>): string[] {
  const changed: string[] = [];
  for (const [key, value] of Object.entries(after)) {
    const old = before[key as keyof Event];
    const same =
      value instanceof Date && old instanceof Date
        ? value.getTime() === old.getTime()
        : (old ?? null) === (value ?? null);
    if (!same) changed.push(key);
  }
  return changed;
}

export async function createEvent(input: EventInput, actorId: string): Promise<Event> {
  const slug = input.slug ?? defaultSlug(input.title, input.startsAt as Date);
  try {
    return await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: { ...eventData(input, slug), status: EventStatus.DRAFT },
      });
      await recordAudit(tx, {
        actorId,
        action: "event.create",
        entityType: "event",
        entityId: event.id,
        summary: `"${event.title}" aangemaakt als concept`,
        data: { slug },
      });
      return event;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(`De slug "${slug}" is al in gebruik.`, "slug_taken");
    throw error;
  }
}

/** Wijzigt een event. Gaat de capaciteit omhoog, dan schuift de wachtlijst in
 *  dezelfde transactie door. Omlaag haalt niemand eraf: wie er staat, blijft staan. */
export async function updateEvent(
  eventId: string,
  input: EventInput,
  actorId: string,
): Promise<{ event: Event; promotedMemberIds: string[] }> {
  try {
    return await inSerializableTransaction(async (tx) => {
      const before = await tx.event.findUnique({ where: { id: eventId } });
      if (!before) throw notFound("Dat event bestaat niet.");

      const data = eventData(input, input.slug ?? before.slug);
      const changed = changedFields(before, data);
      const event = await tx.event.update({ where: { id: eventId }, data });

      let promotedMemberIds: string[] = [];
      if (changed.includes("capacity")) {
        promotedMemberIds = await promoteFromWaitlist(tx, event);
        await renumberWaitlist(tx, event.id);
      }

      if (changed.length > 0) {
        await recordAudit(tx, {
          actorId,
          action: "event.update",
          entityType: "event",
          entityId: event.id,
          summary:
            `"${event.title}" gewijzigd (${changed.join(", ")})` +
            (promotedMemberIds.length > 0
              ? `, ${promotedMemberIds.length} doorgeschoven van de wachtlijst`
              : ""),
          data: { changed, promotedMemberIds },
        });
      }
      return { event, promotedMemberIds };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("Die slug is al in gebruik.", "slug_taken");
    throw error;
  }
}

const STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "Offline gehaald",
  PUBLISHED: "Gepubliceerd",
  CANCELLED: "Geannuleerd",
};

export async function setEventStatus(
  eventId: string,
  status: EventStatus,
  actorId: string,
): Promise<Event> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.event.findUnique({ where: { id: eventId } });
    if (!before) throw notFound("Dat event bestaat niet.");
    if (before.status === status) return before;
    const event = await tx.event.update({ where: { id: eventId }, data: { status } });
    await recordAudit(tx, {
      actorId,
      action: `event.status`,
      entityType: "event",
      entityId: event.id,
      summary: `${STATUS_LABEL[status]}: "${event.title}"`,
      data: { from: before.status, to: status },
    });
    return event;
  });
}

/** Verwijderen haalt ook alle aanmeldingen weg. Daarom alleen met de titel als
 *  bevestiging, en alleen voor admins (dat dwingt de aanroeper af). */
export async function deleteEvent(eventId: string, confirmTitle: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: { _count: { select: { rsvps: true } } },
    });
    if (!event) throw notFound("Dat event bestaat niet.");
    if (confirmTitle.trim() !== event.title.trim()) {
      throw badRequest("Typ de titel precies over om te bevestigen.", "confirm_mismatch");
    }
    await tx.event.delete({ where: { id: eventId } });
    await recordAudit(tx, {
      actorId,
      action: "event.delete",
      entityType: "event",
      entityId: event.id,
      summary: `"${event.title}" verwijderd, met ${event._count.rsvps} aanmeldingen`,
      data: { slug: event.slug, rsvps: event._count.rsvps },
    });
  });
}
