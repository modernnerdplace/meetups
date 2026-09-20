"use server";

import { EventStatus, MemberRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError, z } from "zod";
import { requireAdmin, requireOrganiser } from "@/lib/auth";
import {
  createEvent,
  deleteEvent,
  eventInputSchema,
  formToObject,
  setEventStatus,
  updateEvent,
} from "@/lib/admin/events";
import { setMemberRole } from "@/lib/admin/members";
import {
  cancelRsvpAsOrganiser,
  checkInRsvp,
  promoteRsvp,
  undoCheckIn,
} from "@/lib/admin/rsvps";
import { HttpError } from "@/lib/http";

// Elke actie controleert zelf de rol. Een server action is een los aan te roepen
// endpoint, dus de check in de layout is niet genoeg.

export type ActionState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
};

function toState(error: unknown): ActionState {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "_";
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Kijk de gemarkeerde velden na.", fieldErrors };
  }
  if (error instanceof HttpError) return { ok: false, error: error.message };
  console.error("[admin] action failed", error);
  return { ok: false, error: "Er ging iets mis. Er is niets gewijzigd." };
}

const id = z.string().min(1).max(64);

// De publieke pagina's zijn force-dynamic en hoeven dus niet opnieuw gevalideerd te
// worden.
function revalidateEvent(eventId: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/events/${eventId}`);
}

export async function createEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let eventId: string;
  try {
    const actor = await requireOrganiser();
    const input = eventInputSchema.parse(formToObject(form));
    const event = await createEvent(input, actor.id);
    eventId = event.id;
  } catch (error) {
    return toState(error);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/events/${eventId}?created=1`);
}

export async function updateEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const actor = await requireOrganiser();
    const eventId = id.parse(form.get("eventId"));
    const input = eventInputSchema.parse(formToObject(form));
    const { promotedMemberIds } = await updateEvent(eventId, input, actor.id);
    revalidateEvent(eventId);
    return {
      ok: true,
      message:
        promotedMemberIds.length > 0
          ? `Opgeslagen. ${promotedMemberIds.length} doorgeschoven van de wachtlijst.`
          : "Opgeslagen.",
    };
  } catch (error) {
    return toState(error);
  }
}

const statusSchema = z.nativeEnum(EventStatus);

export async function setEventStatusAction(form: FormData): Promise<ActionState> {
  try {
    const actor = await requireOrganiser();
    const eventId = id.parse(form.get("eventId"));
    const status = statusSchema.parse(form.get("status"));
    await setEventStatus(eventId, status, actor.id);
    revalidateEvent(eventId);
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function deleteEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const eventId = id.parse(form.get("eventId"));
    const confirm = z.string().parse(form.get("confirmTitle") ?? "");
    await deleteEvent(eventId, confirm, actor.id);
    // Bewust geen revalidatePath en geen redirect(): dan ververst Next eerst de
    // huidige pagina, die bestaat niet meer, en de 404 slokt de navigatie op. De
    // client navigeert zelf; alle beheerpagina's zijn dynamisch en dus vers.
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

const rsvpAction = z.enum(["cancel", "promote", "checkin", "admit", "undo"]);

/** Knoppen in de aanmeldlijst en op het check-inscherm. */
export async function rsvpActionAction(input: {
  rsvpId: string;
  eventId: string;
  action: z.infer<typeof rsvpAction>;
}): Promise<ActionState & { checkedInAt?: string | null }> {
  try {
    const actor = await requireOrganiser();
    const rsvpId = id.parse(input.rsvpId);
    const eventId = id.parse(input.eventId);
    const action = rsvpAction.parse(input.action);

    let checkedInAt: string | null | undefined;
    switch (action) {
      case "cancel":
        await cancelRsvpAsOrganiser(rsvpId, actor.id);
        break;
      case "promote":
        await promoteRsvp(rsvpId, actor.id);
        break;
      case "checkin":
      case "admit": {
        const result = await checkInRsvp(rsvpId, actor.id, {
          admitFromWaitlist: action === "admit",
        });
        checkedInAt = result.checkedInAt.toISOString();
        break;
      }
      case "undo":
        await undoCheckIn(rsvpId, actor.id);
        checkedInAt = null;
        break;
    }
    revalidateEvent(eventId);
    return { ok: true, checkedInAt };
  } catch (error) {
    return toState(error);
  }
}

export async function setMemberRoleAction(form: FormData): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const memberId = id.parse(form.get("memberId"));
    const role = z.nativeEnum(MemberRole).parse(form.get("role"));
    await setMemberRole(memberId, role, actor.id);
    revalidatePath("/admin/members");
    revalidatePath("/admin/audit");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}
