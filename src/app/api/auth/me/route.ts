import { getCurrentMember, toPublicMember } from "@/lib/auth";
import { errorResponse, json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Wie ben ik? Zonder sessie gewoon null, geen 401. */
export async function GET() {
  try {
    const member = await getCurrentMember();
    return json({ member: member ? toPublicMember(member) : null });
  } catch (error) {
    return errorResponse(error);
  }
}
