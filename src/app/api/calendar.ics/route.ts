import { EventStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { feedCalendar, icsResponse } from "@/lib/ical";

export const dynamic = "force-dynamic";

/** Abonneerbare feed met alle gepubliceerde komende meetups. */
export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: { status: EventStatus.PUBLISHED, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 200,
    });
    return icsResponse(feedCalendar(events), "modernnerdplace.ics");
  } catch (error) {
    return errorResponse(error);
  }
}
