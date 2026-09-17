import type { Metadata } from "next";
import Link from "next/link";

import { getUpcomingEvents } from "../_lib/queries";
import { site } from "../_lib/site";
import { Container, Kicker } from "@/components/container";
import { EventList } from "@/components/event-row";
import { EventPoster } from "@/components/event-poster";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agenda",
  description: "De meetups van Modern Nerdplace die eraan komen.",
  openGraph: {
    title: `Agenda | ${site.name}`,
    description: "De meetups van Modern Nerdplace die eraan komen.",
    url: "/events",
  },
  alternates: { canonical: "/events" },
};

export default async function EventsPage() {
  const events = await getUpcomingEvents();
  const [next, ...rest] = events;

  return (
    <Container className="py-14 sm:py-20">
      <Kicker>Agenda</Kicker>
      <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        Wat eraan komt
      </h1>

      {next ? (
        <>
          <div className="mt-10">
            <EventPoster event={next} />
          </div>

          {rest.length > 0 ? (
            <section className="mt-16">
              <h2 className="font-display text-2xl font-bold">Daarna</h2>
              <div className="mt-6">
                <EventList events={rest} />
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <div className="mt-10 rounded-xl border border-dashed border-ink-600 p-8 sm:p-10">
          <p className="max-w-xl text-lg text-paper-muted">
            Er staat nu niks in de agenda. We plannen meestal een paar weken vooruit, dus kijk
            binnenkort nog eens. Op Discord hoor je het als eerste.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={site.discordUrl} className="btn-primary" rel="noopener noreferrer">
              Naar Discord
            </a>
            <Link href="/archive" className="btn-ghost">
              Bekijk het archief
            </Link>
          </div>
        </div>
      )}
    </Container>
  );
}
