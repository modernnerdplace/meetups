import type { Metadata } from "next";
import Link from "next/link";

import { amsterdamYear } from "../_lib/format";
import { getPastEvents, type EventListItem } from "../_lib/queries";
import { site } from "../_lib/site";
import { Container, Kicker } from "@/components/container";
import { EventList } from "@/components/event-row";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Archief",
  description:
    "Alle meetups die Modern Nerdplace heeft gehouden, met datum, onderwerp en opkomst.",
  openGraph: {
    title: `Archief | ${site.name}`,
    description: "Alle meetups die Modern Nerdplace heeft gehouden.",
    url: "/archive",
  },
  alternates: { canonical: "/archive" },
};

function groupByYear(events: EventListItem[]) {
  const years = new Map<number, EventListItem[]>();
  for (const event of events) {
    const year = amsterdamYear(event.startsAt);
    const bucket = years.get(year);
    if (bucket) bucket.push(event);
    else years.set(year, [event]);
  }
  return [...years.entries()].sort((a, b) => b[0] - a[0]);
}

export default async function ArchivePage() {
  const events = await getPastEvents();
  const years = groupByYear(events);

  const attendeeTotal = events.reduce((sum, event) => sum + (event.importedAttendees ?? 0), 0);

  return (
    <Container className="py-14 sm:py-20">
      <Kicker>Archief</Kicker>
      <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        Alles wat we hebben gehouden
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-paper-muted">
        {events.length > 0 ? (
          <>
            {events.length} meetups sinds {years[years.length - 1][0]}
            {attendeeTotal > 0 ? `, samen goed voor ${attendeeTotal} bezoekers` : ""}. De oudste
            stonden op meetup.com en staan nu hier.
          </>
        ) : (
          <>Zodra de eerste meetup geweest is, komt hij hier te staan.</>
        )}
      </p>

      {years.length > 0 ? (
        <div className="mt-14 space-y-16">
          {years.map(([year, yearEvents]) => (
            <section key={year} className="md:grid md:grid-cols-[7rem_1fr] md:gap-8">
              <h2 className="font-display text-5xl font-bold leading-none tabular-nums text-paper-faint md:sticky md:top-8 md:self-start md:text-right">
                {year}
              </h2>
              <div className="mt-5 border-t border-ink-700 md:mt-0 md:border-t-0">
                <EventList events={yearEvents} showYear={false} />
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-xl border border-dashed border-ink-600 p-8">
          <p className="text-paper-muted">
            Het archief is nog leeg. Kijk in de{" "}
            <Link href="/events" className="link-underline">
              agenda
            </Link>{" "}
            wat eraan komt.
          </p>
        </div>
      )}
    </Container>
  );
}
