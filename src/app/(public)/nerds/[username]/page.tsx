import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatMediumDate, isoDate } from "../../_lib/format";
import { site } from "../../_lib/site";
import { Container, Kicker } from "@/components/container";
import { NerdAvatar } from "@/components/nerd-avatar";
import { NerdBadges } from "@/components/nerd-badges";
import { getPublicProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const nerd = await getPublicProfile(username);
  if (!nerd) return { title: "Nerd niet gevonden", robots: { index: false } };
  const role = [nerd.jobTitle, nerd.company].filter(Boolean).join(" bij ");
  return {
    title: nerd.name,
    description: nerd.bio?.slice(0, 160) ?? `${nerd.name}${role ? `, ${role}` : ""}, lid van ${site.name}.`,
    alternates: { canonical: `/nerds/${nerd.username}` },
    openGraph: { type: "profile", title: `${nerd.name} | ${site.name}`, url: `/nerds/${nerd.username}` },
  };
}

export default async function NerdPage({ params }: Props) {
  const { username } = await params;
  const nerd = await getPublicProfile(username);
  if (!nerd) notFound();

  const role = [nerd.jobTitle, nerd.company].filter(Boolean).join(" @ ");
  const links = [
    nerd.websiteUrl ? { label: "Website", url: nerd.websiteUrl } : null,
    nerd.linkedinUrl ? { label: "LinkedIn", url: nerd.linkedinUrl } : null,
    nerd.githubUrl ? { label: "GitHub", url: nerd.githubUrl } : null,
  ].filter((link): link is { label: string; url: string } => link !== null);

  return (
    <Container className="py-12 sm:py-16">
      <Kicker>
        <Link href="/nerds" className="hover:text-paper">
          ./nerds
        </Link>
        /{nerd.username}
      </Kicker>

      <header className="mt-6 flex flex-col gap-6 border-b border-ink-700 pb-10 sm:flex-row sm:items-center sm:gap-8">
        <NerdAvatar name={nerd.name} src={nerd.avatarUrl} size={112} />
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{nerd.name}</h1>
          {role ? <p className="mt-2 text-lg text-paper-muted">{role}</p> : null}
          <div className="mt-3">
            <NerdBadges isMvp={nerd.isMvp} isMct={nerd.isMct} />
          </div>
          {links.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {links.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer nofollow me" className="link-underline text-trace-300">
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
          {nerd.bio ? (
            <section>
              <h2 className="sr-only">Over {nerd.name}</h2>
              {/* Platte tekst, geen markdown: geen afbeeldingen of links van derden. */}
              <p className="whitespace-pre-line text-lg leading-relaxed text-paper/90">{nerd.bio}</p>
            </section>
          ) : (
            <p className="text-paper-muted">{nerd.name} heeft nog geen bio geschreven.</p>
          )}

          {nerd.interests.length > 0 ? (
            <section className="mt-10" aria-labelledby="interests-heading">
              <h2 id="interests-heading" className="kicker">
                Praat met me over
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {nerd.interests.map((tag) => (
                  <li key={tag}>
                    <Link
                      href={`/nerds?interest=${encodeURIComponent(tag)}`}
                      className="rounded-full border border-ink-600 px-3 py-1 text-sm text-paper-muted hover:border-trace hover:text-paper"
                    >
                      {tag}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {nerd.speaker ? (
            <p className="mt-10">
              <Link href={`/speakers/${nerd.speaker.slug}`} className="btn-ghost">
                Praatjes van {nerd.name.split(" ")[0]}
              </Link>
            </p>
          ) : null}
        </div>

        <aside className="mt-12 lg:mt-0" aria-labelledby="attended-heading">
          <h2 id="attended-heading" className="font-display text-xl font-bold">
            Meetups
          </h2>
          {nerd.attended.length === 0 ? (
            <p className="mt-3 font-mono text-sm text-paper-faint">$ uptime: nog geen meetup. Binnenkort?</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink-700 border-t border-ink-700">
              {nerd.attended.map((event) => (
                <li key={event.slug} className="py-3">
                  <Link href={`/events/${event.slug}`} className="font-medium hover:text-trace-300">
                    {event.title}
                  </Link>
                  <p className="font-mono text-xs text-paper-faint">
                    <time dateTime={isoDate(event.startsAt)}>{formatMediumDate(event.startsAt)}</time>
                    {event.venueName ? ` · ${event.venueName}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </Container>
  );
}
