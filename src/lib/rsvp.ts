import { EventStatus, Prisma, RsvpStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, notFound } from "@/lib/http";

export const rsvpInputSchema = z.object({
  note: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type RsvpInput = z.infer<typeof rsvpInputSchema>;

/** Wat er publiek over een aanmelding terug mag. `note` staat er bewust niet in:
 *  dat veld kan een dieetwens bevatten en is alleen voor organisatoren. */
export type RsvpState = {
  status: RsvpStatus;
  waitlistPosition: number | null;
  checkedIn: boolean;
  event: {
    slug: string;
    capacity: number | null;
    goingCount: number;
    waitlistCount: number;
    spotsLeft: number | null;
    full: boolean;
  };
};

export type LeaveResult = RsvpState & { promotedMemberIds: string[] };

type Tx = Prisma.TransactionClient;

const SERIALIZABLE = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 15_000,
} as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Serializable transacties kunnen afgebroken worden als twee aanmeldingen elkaar
 *  raken. Dat is precies de bedoeling: we proberen het dan opnieuw. */
async function inSerializableTransaction<T>(
  run: (tx: Tx) => Promise<T>,
  attempts = 5,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await prisma.$transaction(run, SERIALIZABLE);
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002");
      if (!retryable) throw error;
      lastError = error;
      await sleep(20 * (attempt + 1) + Math.floor(Math.random() * 20));
    }
  }
  throw lastError;
}

async function counts(tx: Tx, eventId: string) {
  const [goingCount, waitlistCount] = await Promise.all([
    tx.rsvp.count({ where: { eventId, status: RsvpStatus.GOING } }),
    tx.rsvp.count({ where: { eventId, status: RsvpStatus.WAITLIST } }),
  ]);
  return { goingCount, waitlistCount };
}

function eventSummary(
  event: { slug: string; capacity: number | null },
  goingCount: number,
  waitlistCount: number,
) {
  const spotsLeft = event.capacity === null ? null : Math.max(0, event.capacity - goingCount);
  return {
    slug: event.slug,
    capacity: event.capacity,
    goingCount,
    waitlistCount,
    spotsLeft,
    full: event.capacity !== null && goingCount >= event.capacity,
  };
}

async function loadEvent(tx: Tx, slug: string) {
  const event = await tx.event.findUnique({ where: { slug } });
  if (!event) throw notFound("That event does not exist.");
  return event;
}

function assertOpen(event: { status: EventStatus; startsAt: Date }) {
  if (event.status === EventStatus.DRAFT) {
    throw badRequest("This event is not open yet.", "event_not_published");
  }
  if (event.status === EventStatus.CANCELLED) {
    throw badRequest("This event was cancelled.", "event_cancelled");
  }
  if (event.startsAt.getTime() <= Date.now()) {
    throw badRequest("This event has already started.", "event_started");
  }
}

/** Zet de wachtlijst weer op 1, 2, 3 ... in de volgorde waarin mensen erop kwamen. */
async function renumberWaitlist(tx: Tx, eventId: string): Promise<void> {
  const waiting = await tx.rsvp.findMany({
    where: { eventId, status: RsvpStatus.WAITLIST },
    orderBy: [{ waitlistPosition: "asc" }, { createdAt: "asc" }],
    select: { id: true, waitlistPosition: true },
  });
  for (const [index, rsvp] of waiting.entries()) {
    const position = index + 1;
    if (rsvp.waitlistPosition !== position) {
      await tx.rsvp.update({ where: { id: rsvp.id }, data: { waitlistPosition: position } });
    }
  }
}

/** Schuift zoveel mensen van de wachtlijst door als er plek is. */
async function promoteFromWaitlist(
  tx: Tx,
  event: { id: string; capacity: number | null },
): Promise<string[]> {
  if (event.capacity === null) return [];
  const promoted: string[] = [];
  let going = await tx.rsvp.count({
    where: { eventId: event.id, status: RsvpStatus.GOING },
  });
  while (going < event.capacity) {
    const next = await tx.rsvp.findFirst({
      where: { eventId: event.id, status: RsvpStatus.WAITLIST },
      orderBy: [{ waitlistPosition: "asc" }, { createdAt: "asc" }],
    });
    if (!next) break;
    await tx.rsvp.update({
      where: { id: next.id },
      data: { status: RsvpStatus.GOING, waitlistPosition: null },
    });
    promoted.push(next.memberId);
    going += 1;
  }
  return promoted;
}

/** Aanmelden. Past er nog iemand bij, dan GOING, anders WAITLIST met de
 *  eerstvolgende positie. Zonder capacity is er geen limiet. */
export async function joinEvent(params: {
  slug: string;
  memberId: string;
  note?: string | null;
}): Promise<RsvpState> {
  return inSerializableTransaction(async (tx) => {
    const event = await loadEvent(tx, params.slug);
    assertOpen(event);

    const existing = await tx.rsvp.findUnique({
      where: { eventId_memberId: { eventId: event.id, memberId: params.memberId } },
    });

    // Al aangemeld of al op de wachtlijst: alleen de opmerking bijwerken.
    if (existing && existing.status !== RsvpStatus.CANCELLED) {
      const updated =
        params.note === undefined
          ? existing
          : await tx.rsvp.update({
              where: { id: existing.id },
              data: { note: params.note },
            });
      const { goingCount, waitlistCount } = await counts(tx, event.id);
      return {
        status: updated.status,
        waitlistPosition: updated.waitlistPosition,
        checkedIn: updated.checkedInAt !== null,
        event: eventSummary(event, goingCount, waitlistCount),
      };
    }

    const goingCount = await tx.rsvp.count({
      where: { eventId: event.id, status: RsvpStatus.GOING },
    });
    const hasRoom = event.capacity === null || goingCount < event.capacity;

    let status: RsvpStatus = RsvpStatus.GOING;
    let waitlistPosition: number | null = null;
    if (!hasRoom) {
      status = RsvpStatus.WAITLIST;
      const last = await tx.rsvp.findFirst({
        where: { eventId: event.id, status: RsvpStatus.WAITLIST },
        orderBy: { waitlistPosition: "desc" },
        select: { waitlistPosition: true },
      });
      waitlistPosition = (last?.waitlistPosition ?? 0) + 1;
    }

    // @@unique([eventId, memberId]): opnieuw aanmelden na afmelden is een update,
    // geen tweede rij.
    const saved = await tx.rsvp.upsert({
      where: { eventId_memberId: { eventId: event.id, memberId: params.memberId } },
      create: {
        eventId: event.id,
        memberId: params.memberId,
        status,
        waitlistPosition,
        note: params.note ?? null,
      },
      update: {
        status,
        waitlistPosition,
        checkedInAt: null,
        ...(params.note === undefined ? {} : { note: params.note }),
      },
    });

    const after = await counts(tx, event.id);
    return {
      status: saved.status,
      waitlistPosition: saved.waitlistPosition,
      checkedIn: saved.checkedInAt !== null,
      event: eventSummary(event, after.goingCount, after.waitlistCount),
    };
  });
}

/** Afmelden. De eerste van de wachtlijst schuift door naar GOING en daarna
 *  worden de posities opnieuw genummerd, alles in dezelfde transactie. */
export async function leaveEvent(params: {
  slug: string;
  memberId: string;
}): Promise<LeaveResult> {
  return inSerializableTransaction(async (tx) => {
    const event = await loadEvent(tx, params.slug);

    const existing = await tx.rsvp.findUnique({
      where: { eventId_memberId: { eventId: event.id, memberId: params.memberId } },
    });
    if (!existing) throw notFound("You are not signed up for this event.");

    let promotedMemberIds: string[] = [];
    let current = existing;

    if (existing.status !== RsvpStatus.CANCELLED) {
      current = await tx.rsvp.update({
        where: { id: existing.id },
        data: { status: RsvpStatus.CANCELLED, waitlistPosition: null, checkedInAt: null },
      });
      promotedMemberIds = await promoteFromWaitlist(tx, event);
      await renumberWaitlist(tx, event.id);
    }

    const { goingCount, waitlistCount } = await counts(tx, event.id);
    return {
      status: current.status,
      waitlistPosition: null,
      checkedIn: false,
      event: eventSummary(event, goingCount, waitlistCount),
      promotedMemberIds,
    };
  });
}

/** De stand van zaken voor één lid, zonder de opmerking. */
export async function getRsvpState(slug: string, memberId: string): Promise<RsvpState | null> {
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) return null;
  const [rsvp, { goingCount, waitlistCount }] = await Promise.all([
    prisma.rsvp.findUnique({
      where: { eventId_memberId: { eventId: event.id, memberId } },
    }),
    counts(prisma, event.id),
  ]);
  if (!rsvp) return null;
  return {
    status: rsvp.status,
    waitlistPosition: rsvp.waitlistPosition,
    checkedIn: rsvp.checkedInAt !== null,
    event: eventSummary(event, goingCount, waitlistCount),
  };
}

/** Check-in door een organisator. Alleen wie GOING is kan binnenlopen. */
export async function checkInMember(params: {
  slug: string;
  memberId: string;
  at?: Date;
}): Promise<{ memberId: string; checkedInAt: Date }> {
  const event = await prisma.event.findUnique({ where: { slug: params.slug } });
  if (!event) throw notFound("That event does not exist.");

  const rsvp = await prisma.rsvp.findUnique({
    where: { eventId_memberId: { eventId: event.id, memberId: params.memberId } },
  });
  if (!rsvp) throw notFound("This member is not signed up for this event.");
  if (rsvp.status !== RsvpStatus.GOING) {
    throw badRequest("This member is not on the going list.", "not_going");
  }
  if (rsvp.checkedInAt) {
    return { memberId: params.memberId, checkedInAt: rsvp.checkedInAt };
  }

  const checkedInAt = params.at ?? new Date();
  await prisma.rsvp.update({ where: { id: rsvp.id }, data: { checkedInAt } });
  return { memberId: params.memberId, checkedInAt };
}
