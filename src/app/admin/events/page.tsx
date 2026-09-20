import Link from "next/link";

import { formatMediumDate, formatTime } from "@/app/(public)/_lib/format";
import { Container } from "@/components/container";
import { CapacityIndicator } from "../_components/capacity-indicator";
import { PageHeader } from "../_components/page-header";
import { EventStatusBadge } from "../_components/status-badge";
import { TerminalBadge } from "../_components/terminal-badge";
import { listEvents, type AdminEventRow } from "../_lib/queries";

export const metadata = { title: "Events" };

function EventTable({ rows, empty }: { rows: AdminEventRow[]; empty: string }) {
  if (rows.length === 0) return <p className="py-6 text-paper-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-ink-700">
      {rows.map((event) => (
        <li key={event.id}>
          <Link
            href={`/admin/events/${event.id}`}
            className="grid gap-3 px-1 py-4 transition-colors hover:bg-ink-800/50 sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:gap-6 sm:px-3"
          >
            <span className="font-mono text-sm text-paper-muted">
              {formatMediumDate(event.startsAt)}
              <span className="block text-xs text-paper-faint">{formatTime(event.startsAt)}</span>
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{event.title}</span>
                <EventStatusBadge status={event.status} />
                {event.meetupComUrl ? <TerminalBadge>import</TerminalBadge> : null}
              </span>
              {event.venueName ? (
                <span className="mt-0.5 block text-sm text-paper-faint">{event.venueName}</span>
              ) : null}
            </span>
            {event.importedAttendees !== null && event.counts.going === 0 ? (
              <span className="font-mono text-xs text-paper-faint">
                {event.importedAttendees} via meetup.com
              </span>
            ) : (
              <CapacityIndicator
                going={event.counts.going}
                capacity={event.capacity}
                waitlist={event.counts.waitlist}
              />
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const [{ deleted }, upcoming, past] = await Promise.all([
    searchParams,
    listEvents("upcoming"),
    listEvents("past"),
  ]);

  return (
    <>
      <PageHeader
        kicker={`${upcoming.length + past.length} events`}
        title="Events"
        actions={
          <Link href="/admin/events/new" className="btn-primary">
            Nieuw event
          </Link>
        }
      />
      <Container className="mt-8 space-y-10">
        {deleted ? (
          <p role="status" className="panel px-4 py-3 text-sm">
            <TerminalBadge tone="ok">ok</TerminalBadge> <span className="ml-2">Event verwijderd.</span>
          </p>
        ) : null}
        <section aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="kicker">
            Gepland
          </h2>
          <div className="panel mt-3 px-3 sm:px-4">
            <EventTable rows={upcoming} empty="Niets gepland." />
          </div>
        </section>
        <section aria-labelledby="past-heading">
          <h2 id="past-heading" className="kicker">
            Geweest
          </h2>
          <div className="panel mt-3 px-3 sm:px-4">
            <EventTable rows={past} empty="Nog geen events gehouden." />
          </div>
        </section>
      </Container>
    </>
  );
}
