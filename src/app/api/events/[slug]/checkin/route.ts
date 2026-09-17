import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireOrganiser } from "@/lib/auth";
import { errorResponse, json, readJson } from "@/lib/http";
import { checkInMember } from "@/lib/rsvp";

export const dynamic = "force-dynamic";

const schema = z.object({ memberId: z.string().min(1, "Which member?") });

type Context = { params: Promise<{ slug: string }> };

/** Iemand bij de deur afvinken. Alleen organisatoren. */
export async function POST(request: NextRequest, context: Context) {
  try {
    const { slug } = await context.params;
    await requireOrganiser();
    const input = schema.parse(await readJson(request));
    const result = await checkInMember({ slug, memberId: input.memberId });
    return json({
      ok: true,
      memberId: result.memberId,
      checkedInAt: result.checkedInAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
