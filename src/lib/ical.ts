import ical, { ICalCalendarMethod, type ICalCalendar } from "ical-generator";
import type { Event } from "@prisma/client";
import { siteUrl } from "@/lib/env";

const TIMEZONE = "Europe/Amsterdam";
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

export function eventUrl(slug: string): string {
  return `${siteUrl()}/events/${slug}`;
}

function venueLine(event: Event): string | undefined {
  const parts = [event.venueName, event.venueAddress].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function describe(event: Event): string {
  const lines: string[] = [];
  if (event.summary) lines.push(event.summary);
  else if (event.description) lines.push(event.description);
  lines.push("", eventUrl(event.slug));
  return lines.join("\n");
}

function addEvent(calendar: ICalCalendar, event: Event) {
  calendar.createEvent({
    // Stabiel id, zodat een update in de agenda het bestaande item bijwerkt.
    id: `event-${event.id}@modernnerdplace.nl`,
    start: event.startsAt,
    end: event.endsAt ?? new Date(event.startsAt.getTime() + DEFAULT_DURATION_MS),
    summary: event.title,
    description: describe(event),
    location: venueLine(event),
    url: eventUrl(event.slug),
    timezone: TIMEZONE,
    lastModified: event.updatedAt,
  });
}

function newCalendar(name: string): ICalCalendar {
  const calendar = ical({
    name,
    description: "Meetups van Modern Nerdplace.",
    prodId: { company: "Modern Nerdplace", product: "meetups", language: "NL" },
    timezone: TIMEZONE,
    url: siteUrl(),
  });
  calendar.method(ICalCalendarMethod.PUBLISH);
  return calendar;
}

export function singleEventCalendar(event: Event): string {
  const calendar = newCalendar(event.title);
  addEvent(calendar, event);
  return calendar.toString();
}

export function feedCalendar(events: Event[]): string {
  const calendar = newCalendar("Modern Nerdplace");
  for (const event of events) addEvent(calendar, event);
  return calendar.toString();
}

export function icsResponse(body: string, filename: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
