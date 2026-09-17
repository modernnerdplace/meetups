import { EventStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { errorResponse, notFound } from "@/lib/http";
import { icsResponse, singleEventCalendar } from "@/lib/ical";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

/** Los agenda-item voor één meetup. */
export async function GET(_request: Request, context: Context) {
  try {
    const { slug } = await context.params;
    const event = await prisma.event.findUnique({ where: { slug } });
    if (!event || event.status !== EventStatus.PUBLISHED) {
      throw notFound("That event does not exist.");
    }
    return icsResponse(singleEventCalendar(event), `${event.slug}.ics`);
  } catch (error) {
    return errorResponse(error);
  }
}
