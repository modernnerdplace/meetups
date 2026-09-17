import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { site } from "./_lib/site";
import { getFirstEventYear, getNextEvent, getPastEvents } from "./_lib/queries";
import { amsterdamYear } from "./_lib/format";
import { Container, Kicker } from "@/components/container";
import { EventList } from "@/components/event-row";
import { EventPoster } from "@/components/event-poster";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${site.name}, meetups in ${site.city}`,
  description:
    "Modern Nerdplace is een meetup in Breda voor iedereen die met IT werkt. Twee of drie praatjes, pizza, en daarna napraten.",
  openGraph: {
    title: `${site.name}, meetups in ${site.city}`,
    description: "Een meetup in Breda voor iedereen die met IT werkt.",
    url: "/",
  },
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [nextEvent, past, firstEvent] = await Promise.all([
    getNextEvent(),
    getPastEvents(4),
    getFirstEventYear(),
  ]);

  return (
    <>
      <Container className="py-14 sm:py-20">
        <div className="grid items-center gap-10 sm:gap-14 md:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <Kicker>
              Meetup in {site.city}
              {firstEvent ? ` / sinds ${amsterdamYear(firstEvent)}` : null}
            </Kicker>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Nerds uit {site.city} die te lang over werk praten.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-paper-muted">
              Modern Nerdplace is een avond voor iedereen die met IT werkt. Beheerders, developers,
              security, en mensen die er net bij komen kijken. Twee of drie praatjes over wat er
              echt gebeurt in het veld, daarna pizza en napraten tot iemand de lichten uitdoet.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-paper-muted">
              Gratis, geen verkooppraatjes, en je hoeft niks te weten om mee te doen. Wil je zelf
              een keer iets vertellen? Zeg het op{" "}
              <a href={site.discordUrl} className="link-underline" rel="noopener noreferrer">
                Discord
              </a>
              .
            </p>
          </div>

          <Image
            src="/logo.png"
            alt="Het logo van Modern Nerdplace: een raket op een printplaat"
            width={280}
            height={305}
            priority
            className="mx-auto w-40 md:w-64"
          />
        </div>
      </Container>

      <Container className="pb-16">
        {nextEvent ? (
          <EventPoster event={nextEvent} />
        ) : (
          <div className="rounded-xl border border-dashed border-ink-600 p-8 sm:p-10">
            <p className="kicker">Agenda</p>
            <h2 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">
              Er staat nog geen nieuwe meetup gepland.
            </h2>
            <p className="mt-4 max-w-xl text-lg text-paper-muted">
              We zijn aan het puzzelen met een datum en een zaal. Zodra het rond is staat het hier.
              Wil je het als eerste weten of heb je een goed onderwerp? Kom op Discord.
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

      {past.length > 0 ? (
        <Container className="pb-8">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Laatst gehouden</h2>
            <Link href="/archive" className="shrink-0 text-sm text-paper-muted hover:text-paper">
              Alles in het archief
            </Link>
          </div>
          <div className="mt-6">
            <EventList events={past} />
          </div>
        </Container>
      ) : null}
    </>
  );
}
