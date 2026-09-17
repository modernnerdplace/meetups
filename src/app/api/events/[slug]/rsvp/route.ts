import { type NextRequest } from "next/server";
import { requireMember } from "@/lib/auth";
import { errorResponse, json, readJsonOrEmpty } from "@/lib/http";
import { getRsvpState, joinEvent, leaveEvent, rsvpInputSchema } from "@/lib/rsvp";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

/** Aanmelden. Zit het vol, dan kom je op de wachtlijst. */
export async function POST(request: NextRequest, context: Context) {
  try {
    const { slug } = await context.params;
    const member = await requireMember();
    const input = rsvpInputSchema.parse(await readJsonOrEmpty(request));
    // `note` gaat er wel in, maar komt nooit terug in de response.
    const state = await joinEvent({ slug, memberId: member.id, note: input.note });
    return json(state, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Afmelden. De eerste van de wachtlijst schuift door. */
export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { slug } = await context.params;
    const member = await requireMember();
    const { promotedMemberIds, ...state } = await leaveEvent({ slug, memberId: member.id });
    return json({ ...state, promoted: promotedMemberIds.length });
  } catch (error) {
    return errorResponse(error);
  }
}

/** De eigen stand van zaken voor dit event. */
export async function GET(_request: NextRequest, context: Context) {
  try {
    const { slug } = await context.params;
    const member = await requireMember();
    const state = await getRsvpState(slug, member.id);
    return json(state ?? { status: null });
  } catch (error) {
    return errorResponse(error);
  }
}
