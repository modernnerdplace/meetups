"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";
import { requireAdmin, requireOrganiser } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import {
  createSession,
  createSponsor,
  createSpeaker,
  createVenue,
  deleteSession,
  deleteSpeaker,
  deleteSponsor,
  deleteVenue,
  moveSession,
  sessionInputSchema,
  setEventSponsors,
  setEventVenue,
  speakerInputSchema,
  sponsorInputSchema,
  updateSession,
  updateSpeaker,
  updateSponsor,
  updateVenue,
  venueInputSchema,
} from "@/lib/admin/programme";
import type { ActionState } from "./actions";

// Net als in actions.ts: elke actie controleert de rol opnieuw, want een server
// action is een endpoint op zichzelf.

function toState(error: unknown): ActionState {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) fieldErrors[issue.path.join(".") || "_"] ??= issue.message;
    return { ok: false, error: "Kijk de gemarkeerde velden na.", fieldErrors };
  }
  if (error instanceof HttpError) return { ok: false, error: error.message };
  console.error("[admin] programme action failed", error);
  return { ok: false, error: "Er ging iets mis. Er is niets gewijzigd." };
}

const id = z.string().min(1).max(64);

function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") out[key] = value;
  return out;
}

function refreshEvent(eventId: string) {
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/events");
}

// ------------------------------------------------------------------ sessies

export async function saveSessionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const actor = await requireOrganiser();
    const eventId = id.parse(form.get("eventId"));
    const sessionId = form.get("sessionId");
    const input = sessionInputSchema.parse(formToObject(form));
    if (typeof sessionId === "string" && sessionId.length > 0) {
      await updateSession(sessionId, input, actor.id);
    } else {
      await createSession(eventId, input, actor.id);
    }
    refreshEvent(eventId);
    return { ok: true, message: "Programma bijgewerkt." };
  } catch (error) {
    return toState(error);
  }
}

export async function sessionRowAction(input: {
  sessionId: string;
  eventId: string;
  action: "delete" | "up" | "down";
}): Promise<ActionState> {
  try {
    const actor = await requireOrganiser();
    const sessionId = id.parse(input.sessionId);
    const eventId = id.parse(input.eventId);
    if (input.action === "delete") await deleteSession(sessionId, actor.id);
    else await moveSession(sessionId, input.action, actor.id);
    refreshEvent(eventId);
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

// ---------------------------------------------------------------- locatie

export async function setEventVenueAction(form: FormData): Promise<ActionState> {
  try {
    const actor = await requireOrganiser();
    const eventId = id.parse(form.get("eventId"));
    const raw = form.get("venueId");
    const venueId = typeof raw === "string" && raw.length > 0 ? raw : null;
    await setEventVenue(eventId, venueId, actor.id);
    refreshEvent(eventId);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function saveVenueAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const actor = await requireOrganiser();
    const venueId = form.get("venueId");
    const input = venueInputSchema.parse(formToObject(form));
    if (typeof venueId === "string" && venueId.length > 0) await updateVenue(venueId, input, actor.id);
    else await createVenue(input, actor.id);
    revalidatePath("/admin/venues");
    return { ok: true, message: "Opgeslagen." };
  } catch (error) {
    return toState(error);
  }
}

export async function deleteVenueAction(venueId: string): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    await deleteVenue(id.parse(venueId), actor.id);
    revalidatePath("/admin/venues");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

// ---------------------------------------------------------------- sprekers

export async function saveSpeakerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const actor = await requireOrganiser();
    const speakerId = form.get("speakerId");
    const input = speakerInputSchema.parse(formToObject(form));
    if (typeof speakerId === "string" && speakerId.length > 0) await updateSpeaker(speakerId, input, actor.id);
    else await createSpeaker(input, actor.id);
    revalidatePath("/admin/speakers");
    revalidatePath("/", "layout");
    return { ok: true, message: "Opgeslagen." };
  } catch (error) {
    return toState(error);
  }
}

export async function deleteSpeakerAction(speakerId: string): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    await deleteSpeaker(id.parse(speakerId), actor.id);
    revalidatePath("/admin/speakers");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

// ---------------------------------------------------------------- sponsors

export async function saveSponsorAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const actor = await requireOrganiser();
    const sponsorId = form.get("sponsorId");
    const input = sponsorInputSchema.parse(formToObject(form));
    if (typeof sponsorId === "string" && sponsorId.length > 0) await updateSponsor(sponsorId, input, actor.id);
    else await createSponsor(input, actor.id);
    revalidatePath("/admin/sponsors");
    return { ok: true, message: "Opgeslagen." };
  } catch (error) {
    return toState(error);
  }
}

export async function deleteSponsorAction(sponsorId: string): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    await deleteSponsor(id.parse(sponsorId), actor.id);
    revalidatePath("/admin/sponsors");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

const sponsorRows = z.array(z.object({ sponsorId: id, role: z.string().trim().max(60).nullable() })).max(20);

export async function setEventSponsorsAction(input: {
  eventId: string;
  sponsors: { sponsorId: string; role: string | null }[];
}): Promise<ActionState> {
  try {
    const actor = await requireOrganiser();
    const eventId = id.parse(input.eventId);
    await setEventSponsors(eventId, sponsorRows.parse(input.sponsors), actor.id);
    refreshEvent(eventId);
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}
