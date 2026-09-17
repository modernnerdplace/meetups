import { errorResponse, json } from "@/lib/http";
import { endSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await endSession();
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
