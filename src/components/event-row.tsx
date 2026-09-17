import Link from "next/link";

import type { EventListItem } from "@/app/(public)/_lib/queries";
import { formatTime } from "@/app/(public)/_lib/format";
import { DateBlock } from "@/components/date-block";

/** Een regel in een lijst met meetups. Datum links, titel groot, de rest rustig. */
export function EventRow({ event, showYear = true }: { event: EventListItem; showYear?: boolean }) {
  const cancelled = event.status === "CANCELLED";

  return (
    <li className="hairline first:border-t-0">
      <Link
        href={`/events/${event.slug}`}
        className="group flex items-start gap-5 py-6 transition-colors hover:bg-ink-850/50 sm:gap-7 sm:px-2"
      >
        <DateBlock date={event.startsAt} size="sm" showYear={showYear} className="w-16 pt-1" />

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-bold leading-snug text-paper group-hover:text-rocket-300 sm:text-2xl">
            {event.title}
          </h3>

          {event.summary ? (
            <p className="mt-1.5 line-clamp-2 text-paper-muted">{event.summary}</p>
          ) : null}

          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-paper-faint">
            <span>{formatTime(event.startsAt)}</span>
            {event.venueName ? (
              <>
                <span aria-hidden="true">/</span>
                <span className="truncate">{event.venueName}</span>
              </>
            ) : null}
            {typeof event.importedAttendees === "number" ? (
              <>
                <span aria-hidden="true">/</span>
                <span className="text-mint">{event.importedAttendees} aanwezig</span>
              </>
            ) : null}
            {event.recordingUrl ? (
              <>
                <span aria-hidden="true">/</span>
                <span className="text-trace-300">opname</span>
              </>
            ) : null}
            {cancelled ? (
              <>
                <span aria-hidden="true">/</span>
                <span className="text-rocket-300">afgelast</span>
              </>
            ) : null}
          </p>
        </div>
      </Link>
    </li>
  );
}

export function EventList({
  events,
  showYear = true,
}: {
  events: EventListItem[];
  showYear?: boolean;
}) {
  return (
    <ul className="-mx-2">
      {events.map((event) => (
        <EventRow key={event.id} event={event} showYear={showYear} />
      ))}
    </ul>
  );
}
