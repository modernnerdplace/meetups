import Link from "next/link";

import { formatLongDate, formatTimeRange, isoDate } from "@/app/(public)/_lib/format";
import type { EventListItem } from "@/app/(public)/_lib/queries";

/** De eerstvolgende meetup, als affiche. Datum groot, titel groot, de rest rustig. */
export function EventPoster({ event }: { event: EventListItem }) {
  const cancelled = event.status === "CANCELLED";

  return (
    <article className="relative overflow-hidden rounded-xl border border-ink-700 bg-ink-850/80 p-7 sm:p-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-rocket via-spark to-trace"
      />

      <p className="kicker">Eerstvolgende meetup</p>

      <time
        dateTime={isoDate(event.startsAt)}
        className="mt-5 block font-display text-3xl font-bold leading-none tracking-tight text-rocket-400 sm:text-4xl"
      >
        {formatLongDate(event.startsAt)}
      </time>

      <h2 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
        {event.title}
      </h2>

      {event.summary ? (
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-paper-muted">{event.summary}</p>
      ) : null}

      <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4 font-mono text-sm">
        <div>
          <dt className="kicker text-[0.625rem]">Tijd</dt>
          <dd className="mt-1 text-paper">{formatTimeRange(event.startsAt, event.endsAt)}</dd>
        </div>
        {event.venueName ? (
          <div>
            <dt className="kicker text-[0.625rem]">Locatie</dt>
            <dd className="mt-1 text-paper">{event.venueName}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href={`/events/${event.slug}`} className="btn-primary">
          {cancelled ? "Bekijk de meetup" : "Meld je aan"}
        </Link>
        {cancelled ? (
          <span className="font-mono text-sm text-rocket-300">Deze avond gaat niet door.</span>
        ) : null}
      </div>
    </article>
  );
}
