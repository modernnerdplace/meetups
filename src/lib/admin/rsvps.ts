import { RsvpStatus } from "@prisma/client";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { badRequest, notFound } from "@/lib/http";
import {
  inSerializableTransaction,
  promoteFromWaitlist,
  renumberWaitlist,
  type Tx,
} from "@/lib/rsvp";

// Acties van organisatoren op een aanmelding. Alles gaat op rsvp-id, zodat een
// QR-code later alleen dat id (of een token dat ernaar wijst) hoeft te dragen en
// dezelfde functies kan aanroepen.

async function loadRsvp(tx: Tx, rsvpId: string) {
  const rsvp = await tx.rsvp.findUnique({
    where: { id: rsvpId },
    include: {
      event: { select: { id: true, title: true, capacity: true } },
      member: { select: { name: true } },
    },
  });
  if (!rsvp) throw notFound("Die aanmelding bestaat niet.");
  return rsvp;
}

/** Een organisator meldt iemand af. De wachtlijst schuift door, net als wanneer
 *  het lid het zelf doet. */
export async function cancelRsvpAsOrganiser(rsvpId: string, actorId: string) {
  return inSerializableTransaction(async (tx) => {
    const rsvp = await loadRsvp(tx, rsvpId);
    if (rsvp.status === RsvpStatus.CANCELLED) return { promotedMemberIds: [] as string[] };

    await tx.rsvp.update({
      where: { id: rsvp.id },
      data: { status: RsvpStatus.CANCELLED, waitlistPosition: null, checkedInAt: null },
    });
    const promotedMemberIds = await promoteFromWaitlist(tx, rsvp.event);
    await renumberWaitlist(tx, rsvp.eventId);

    await recordAudit(tx, {
      actorId,
      action: "rsvp.cancel",
      entityType: "rsvp",
      entityId: rsvp.id,
      summary:
        `${rsvp.member.name} afgemeld voor "${rsvp.event.title}"` +
        (promotedMemberIds.length > 0 ? `, ${promotedMemberIds.length} doorgeschoven` : ""),
      data: { eventId: rsvp.eventId, memberId: rsvp.memberId, promotedMemberIds },
    });
    return { promotedMemberIds };
  });
}

/** Iemand van de wachtlijst halen en toelaten, ook als het event vol is. Dat is
 *  een bewuste keuze van de organisator, bijvoorbeeld een spreker of een extra stoel. */
export async function promoteRsvp(rsvpId: string, actorId: string) {
  return inSerializableTransaction(async (tx) => {
    const rsvp = await loadRsvp(tx, rsvpId);
    if (rsvp.status !== RsvpStatus.WAITLIST) {
      throw badRequest("Alleen wie op de wachtlijst staat kan doorschuiven.", "not_waitlisted");
    }
    await tx.rsvp.update({
      where: { id: rsvp.id },
      data: { status: RsvpStatus.GOING, waitlistPosition: null },
    });
    await renumberWaitlist(tx, rsvp.eventId);
    await recordAudit(tx, {
      actorId,
      action: "rsvp.promote",
      entityType: "rsvp",
      entityId: rsvp.id,
      summary: `${rsvp.member.name} van de wachtlijst toegelaten tot "${rsvp.event.title}"`,
      data: { eventId: rsvp.eventId, memberId: rsvp.memberId },
    });
  });
}

/** Een tik bij de deur. Staat iemand op de wachtlijst en loopt toch binnen, dan
 *  mag dat alleen met `admitFromWaitlist`, zodat het een bewuste keuze is. */
export async function checkInRsvp(
  rsvpId: string,
  actorId: string,
  options: { admitFromWaitlist?: boolean } = {},
) {
  return inSerializableTransaction(async (tx) => {
    const rsvp = await loadRsvp(tx, rsvpId);
    if (rsvp.checkedInAt) return { checkedInAt: rsvp.checkedInAt };

    if (rsvp.status === RsvpStatus.CANCELLED) {
      throw badRequest("Deze aanmelding is geannuleerd.", "cancelled");
    }
    if (rsvp.status === RsvpStatus.WAITLIST && !options.admitFromWaitlist) {
      throw badRequest("Deze persoon staat op de wachtlijst.", "waitlisted");
    }

    const checkedInAt = new Date();
    await tx.rsvp.update({
      where: { id: rsvp.id },
      data: { status: RsvpStatus.GOING, waitlistPosition: null, checkedInAt },
    });

    if (rsvp.status === RsvpStatus.WAITLIST) {
      await renumberWaitlist(tx, rsvp.eventId);
      await recordAudit(tx, {
        actorId,
        action: "rsvp.admit",
        entityType: "rsvp",
        entityId: rsvp.id,
        summary: `${rsvp.member.name} bij de deur van de wachtlijst binnengelaten bij "${rsvp.event.title}"`,
        data: { eventId: rsvp.eventId, memberId: rsvp.memberId },
      });
    }
    return { checkedInAt };
  });
}

/** Per ongeluk afgevinkt: terugdraaien. Dit loggen we wel, gewone check-ins niet. */
export async function undoCheckIn(rsvpId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const rsvp = await loadRsvp(tx, rsvpId);
    if (!rsvp.checkedInAt) return;
    await tx.rsvp.update({ where: { id: rsvp.id }, data: { checkedInAt: null } });
    await recordAudit(tx, {
      actorId,
      action: "rsvp.checkin_undo",
      entityType: "rsvp",
      entityId: rsvp.id,
      summary: `Check-in van ${rsvp.member.name} teruggedraaid bij "${rsvp.event.title}"`,
      data: { eventId: rsvp.eventId, memberId: rsvp.memberId },
    });
  });
}
