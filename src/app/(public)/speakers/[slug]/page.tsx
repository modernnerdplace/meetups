import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatMediumDate, isoDate } from "../../_lib/format";
import { markdownToText } from "../../_lib/markdown";
import { getSpeakerBySlug, normaliseSpeakerLinks } from "../../_lib/queries";
import { site } from "../../_lib/site";
import { Container, Kicker } from "@/components/container";
import { Markdown } from "@/components/markdown";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const speaker = await getSpeakerBySlug(slug);
  if (!speaker) return { title: "Spreker niet gevonden" };

  const description = speaker.bio
    ? markdownToText(speaker.bio, 160)
    : `${speaker.name} sprak op een meetup van ${site.name}.`;

  return {
    title: speaker.name,
    description,
    openGraph: {
      type: "profile",
      title: `${speaker.name} | ${site.name}`,
      description,
      url: `/speakers/${speaker.slug}`,
      images: speaker.avatarUrl ? [{ url: speaker.avatarUrl }] : undefined,
    },
    alternates: { canonical: `/speakers/${speaker.slug}` },
  };
}

export default async function SpeakerPage({ params }: Props) {
  const { slug } = await params;
  const speaker = await getSpeakerBySlug(slug);
  if (!speaker) notFound();

  const links = normaliseSpeakerLinks(speaker.links);
  // Een spreker ziet zijn sessies, nieuwste eerst.
  const talks = speaker.sessions
    .map((entry) => entry.session)
    .sort((a, b) => b.event.startsAt.getTime() - a.event.startsAt.getTime());

  return (
    <Container className="py-12 sm:py-16">
      <Kicker>Spreker bij {site.name}</Kicker>

      <header className="mt-6 flex flex-col gap-6 border-b border-ink-700 pb-10 sm:flex-row sm:items-center sm:gap-8">
        {speaker.avatarUrl ? (
          <Image
            src={speaker.avatarUrl}
            alt=""
            width={128}
            height={128}
            className="h-24 w-24 rounded-full border border-ink-600 object-cover sm:h-32 sm:w-32"
            unoptimized
          />
        ) : null}

        <div className="min-w-0">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            {speaker.name}
          </h1>
          <p className="mt-2 font-mono text-sm text-paper-faint">
            {talks.length === 1 ? "1 sessie" : `${talks.length} sessies`} bij Modern Nerdplace
          </p>

          {links.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {links.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer me"
                    className="link-underline text-trace-300"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      <div className="mt-12 gap-14 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {speaker.bio ? (
            <section>
              <h2 className="sr-only">Over {speaker.name}</h2>
              <Markdown source={speaker.bio} />
            </section>
          ) : (
            <p className="text-paper-muted">Er staat nog geen stukje tekst bij deze spreker.</p>
          )}

          <section className="mt-14">
            <h2 className="font-display text-2xl font-bold">Sessies</h2>
            {talks.length > 0 ? (
              <ul className="mt-6 divide-y divide-ink-700 border-t border-ink-700">
                {talks.map((talk) => (
                  <li key={talk.id} className="py-6">
                    <time
                      dateTime={isoDate(talk.event.startsAt)}
                      className="font-mono text-xs text-paper-faint"
                    >
                      {formatMediumDate(talk.event.startsAt)}
                    </time>
                    <h3 className="mt-1.5 font-display text-xl font-bold leading-snug">
                      {talk.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-paper-muted">
                      op{" "}
                      <Link href={`/events/${talk.event.slug}`} className="link-underline">
                        {talk.event.title}
                      </Link>
                    </p>
                    {talk.abstract ? (
                      <p className="mt-3 leading-relaxed text-paper-muted">{talk.abstract}</p>
                    ) : null}
                    {talk.slidesUrl || talk.recordingUrl || talk.event.recordingUrl ? (
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
                        {talk.recordingUrl ?? talk.event.recordingUrl ? (
                          <a
                            href={(talk.recordingUrl ?? talk.event.recordingUrl) as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-trace-300 hover:underline"
                          >
                            Opname
                          </a>
                        ) : null}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-paper-muted">
                Nog geen praatje op de agenda. Zodra er een staat, komt hij hier.
              </p>
            )}
          </section>
        </div>

        <aside className="mt-12 lg:mt-0">
          <div className="panel p-6 text-sm">
            <h2 className="font-display text-lg font-bold">Zelf een praatje geven?</h2>
            <p className="mt-2 leading-relaxed text-paper-muted">
              We zoeken altijd sprekers. Twintig minuten over iets waar je mee bezig bent is genoeg.
            </p>
            <a
              href={site.discordUrl}
              className="btn-ghost mt-4 w-full"
              rel="noopener noreferrer"
            >
              Zeg het op Discord
            </a>
          </div>
        </aside>
      </div>
    </Container>
  );
}
