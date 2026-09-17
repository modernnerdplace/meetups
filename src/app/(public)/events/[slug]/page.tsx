import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentMember } from "@/lib/auth";
import { getRsvpState } from "@/lib/rsvp";

import { formatLongDate, formatTimeRange, isoDate } from "../../_lib/format";
import { markdownToText } from "../../_lib/markdown";
import { countGoing, getEventBySlug } from "../../_lib/queries";
import { site } from "../../_lib/site";
import { Container, Kicker } from "@/components/container";
import { Markdown } from "@/components/markdown";
import { RsvpForm, type RsvpSnapshot } from "@/components/rsvp-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Meetup niet gevonden" };

  const description =
    event.summary ??
    (event.description ? markdownToText(event.description) : `Meetup van ${site.name}.`);

  return {
    title: event.title,
    description,
    openGraph: {
      type: "article",
      title: `${event.title} | ${site.name}`,
      description,
      url: `/events/${event.slug}`,
      images: event.coverImageUrl ? [{ url: event.coverImageUrl }] : undefined,
    },
    alternates: { canonical: `/events/${event.slug}` },
  };
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const isPast = event.startsAt.getTime() < Date.now();
  const isImported = Boolean(event.meetupComUrl);
  const cancelled = event.status === "CANCELLED";
  const open = !isPast && !isImported && !cancelled;

  const member = open ? await getCurrentMember() : null;
  const rsvpState = member ? await getRsvpState(event.slug, member.id) : null;
  const goingCount = rsvpState?.event.goingCount ?? (open ? await countGoing(event.id) : 0);
  const spotsLeft = event.capacity === null ? null : Math.max(event.capacity - goingCount, 0);
  const snapshot: RsvpSnapshot = {
    status: rsvpState?.status ?? null,
    waitlistPosition: rsvpState?.waitlistPosition ?? null,
    goingCount,
    waitlistCount: rsvpState?.event.waitlistCount ?? 0,
    capacity: event.capacity,
    spotsLeft,
    full: event.capacity !== null && goingCount >= event.capacity,
  };

  return (
    <Container className="py-12 sm:py-16">
      <Link href={isPast ? "/archive" : "/events"} className="kicker hover:text-paper">
        &larr; {isPast ? "Archief" : "Agenda"}
      </Link>

      <header className="mt-6 border-b border-ink-700 pb-10">
        <p className="font-display text-xl font-bold tracking-tight text-rocket-400 sm:text-2xl">
          <time dateTime={isoDate(event.startsAt)}>{formatLongDate(event.startsAt)}</time>
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          {event.title}
        </h1>
        {event.summary ? (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-paper-muted">{event.summary}</p>
        ) : null}
        {cancelled ? (
          <p className="mt-5 inline-block rounded border border-rocket/50 px-3 py-1.5 font-mono text-sm text-rocket-300">
            Afgelast
          </p>
        ) : null}
      </header>

      <div className="mt-12 gap-14 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {event.description ? <Markdown source={event.description} /> : null}

          {event.talks.length > 0 ? (
            <section className="mt-14">
              <h2 className="font-display text-2xl font-bold">Programma</h2>
              <ol className="mt-6 space-y-8">
                {event.talks.map((talk, index) => (
                  <li key={talk.id} className="flex gap-5">
                    <span className="mt-1 w-6 shrink-0 font-mono text-sm text-paper-faint tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-bold leading-snug sm:text-xl">
                        {talk.title}
                      </h3>
                      {talk.speaker ? (
                        <p className="mt-1 text-paper-muted">
                          <Link
                            href={`/speakers/${talk.speaker.slug}`}
                            className="link-underline text-paper"
                          >
                            {talk.speaker.name}
                          </Link>
                        </p>
                      ) : null}
                      {talk.abstract ? (
                        <p className="mt-2.5 leading-relaxed text-paper-muted">{talk.abstract}</p>
                      ) : null}
                      {talk.slidesUrl || talk.recordingUrl ? (
                        <p className="mt-3 flex flex-wrap gap-x-4 font-mono text-xs">
                          {talk.slidesUrl ? (
                            <a
                              href={talk.slidesUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-trace-300 hover:underline"
                            >
                              Slides
                            </a>
                          ) : null}
                          {talk.recordingUrl ? (
                            <a
                              href={talk.recordingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-trace-300 hover:underline"
                            >
                              Opname
                            </a>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <aside className="mt-12 space-y-8 lg:mt-0">
          {isImported ? (
            <div className="panel p-6">
              <h2 className="font-display text-lg font-bold">Gehouden via meetup.com</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-muted">
                Deze avond organiseerden we nog op meetup.com.
                {typeof event.importedAttendees === "number"
                  ? ` Er kwamen ${event.importedAttendees} mensen langs.`
                  : ""}
              </p>
              {event.meetupComUrl ? (
                <a
                  href={event.meetupComUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline mt-3 inline-block text-sm text-trace-300"
                >
                  Het origineel op meetup.com
                </a>
              ) : null}
            </div>
          ) : isPast ? (
            <div className="panel p-6">
              <h2 className="font-display text-lg font-bold">Deze meetup is geweest</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-muted">
                Aanmelden kan niet meer. Kijk in de{" "}
                <Link href="/events" className="link-underline">
                  agenda
                </Link>{" "}
                wat eraan komt.
              </p>
            </div>
          ) : cancelled ? (
            <div className="panel p-6">
              <h2 className="font-display text-lg font-bold">Gaat niet door</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-muted">
                We hebben deze avond afgezegd. Op{" "}
                <a href={site.discordUrl} className="link-underline" rel="noopener noreferrer">
                  Discord
                </a>{" "}
                lees je waarom en wanneer we het inhalen.
              </p>
            </div>
          ) : (
            <RsvpForm
              slug={event.slug}
              signedIn={member !== null}
              memberName={member?.name ?? null}
              initial={snapshot}
            />
          )}

          <div className="panel p-6">
            <h2 className="kicker">Praktisch</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-paper-faint">Wanneer</dt>
                <dd className="mt-1 text-paper">
                  {formatLongDate(event.startsAt)}
                  <br />
                  {formatTimeRange(event.startsAt, event.endsAt)}
                </dd>
              </div>
              {event.venueName ? (
                <div>
                  <dt className="text-paper-faint">Waar</dt>
                  <dd className="mt-1 text-paper">
                    {event.venueUrl ? (
                      <a
                        href={event.venueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-underline"
                      >
                        {event.venueName}
                      </a>
                    ) : (
                      event.venueName
                    )}
                    {event.venueAddress ? (
                      <span className="mt-1 block text-paper-muted">{event.venueAddress}</span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {!isPast && !cancelled ? (
                <div>
                  <dt className="text-paper-faint">Agenda</dt>
                  <dd className="mt-1">
                    <a
                      href={`/api/events/${encodeURIComponent(event.slug)}/ics`}
                      className="link-underline"
                    >
                      Zet in je agenda (.ics)
                    </a>
                  </dd>
                </div>
              ) : null}
              {event.recordingUrl ? (
                <div>
                  <dt className="text-paper-faint">Opname</dt>
                  <dd className="mt-1">
                    <a
                      href={event.recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-underline text-trace-300"
                    >
                      Kijk terug
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </aside>
      </div>
    </Container>
  );
}
