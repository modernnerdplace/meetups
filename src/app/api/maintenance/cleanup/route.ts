import { type NextRequest } from "next/server";
import { getCurrentMember, isOrganiser } from "@/lib/auth";
import { purgeExpiredAuthData } from "@/lib/cleanup";
import { errorResponse, forbidden, json, unauthorized } from "@/lib/http";
import { safeEqual } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Handmatig of vanuit cron opruimen. Toegang via een ingelogde organisator of
 *  via `Authorization: Bearer <CRON_SECRET>`. */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET?.trim();
    const header = request.headers.get("authorization") ?? "";
    const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
    const viaCron = Boolean(secret) && presented.length > 0 && safeEqual(secret as string, presented);

    if (!viaCron) {
      const member = await getCurrentMember();
      if (!member) throw unauthorized();
      if (!isOrganiser(member)) throw forbidden();
    }

    const result = await purgeExpiredAuthData();
    return json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
