import type { Metadata } from "next";
import Link from "next/link";

import { site } from "../_lib/site";
import { Container, Kicker } from "@/components/container";
import { NerdCard } from "@/components/nerd-card";
import { getCurrentMember } from "@/lib/auth";
import { listPublicProfiles, publicInterests } from "@/lib/profile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nerds",
  description: `De mensen van ${site.name}: IT-liefhebbers, MSP's, MVP's en MCT's uit heel Nederland.`,
  alternates: { canonical: "/nerds" },
};

export default async function NerdsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; interest?: string }>;
}) {
  const { q, interest } = await searchParams;
  const [nerds, interests, me] = await Promise.all([
    listPublicProfiles({ q, interest }),
    publicInterests(),
    getCurrentMember(),
  ]);
  const filtered = Boolean(q || interest);

  return (
    <Container className="py-12 sm:py-16">
      <Kicker>$ ls ./nerds</Kicker>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Nerds assemble.</h1>
      <p className="mt-4 max-w-2xl text-lg text-paper-muted">
        De mensen achter {site.name}. Iedereen hier heeft zelf gekozen om zichtbaar te zijn.{" "}
        {me ? (
          <Link href="/account" className="link-underline">
            Zet je eigen profiel aan
          </Link>
        ) : (
          <Link href="/login?next=/account" className="link-underline">
            Log in en zet je eigen profiel aan
          </Link>
        )}
        .
      </p>

      <form role="search" className="mt-8 flex max-w-lg gap-2">
        <label htmlFor="q" className="sr-only">
          Zoek op naam, functie of bedrijf
        </label>
        <input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="grep naam, functie of bedrijf" className="field" />
        {interest ? <input type="hidden" name="interest" value={interest} /> : null}
        <button type="submit" className="btn-ghost">
          Zoek
        </button>
      </form>

      {interests.length > 0 ? (
        <nav aria-label="Filter op interesse" className="mt-5 flex flex-wrap gap-2">
          {interests.map(({ tag, count }) => {
            const active = tag === interest;
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (!active) params.set("interest", tag);
            const href = `/nerds${params.size ? `?${params}` : ""}`;
            return (
              <Link
                key={tag}
                href={href}
                aria-current={active ? "true" : undefined}
                className={
                  active
                    ? "rounded-full border border-trace bg-trace/15 px-3 py-1 text-sm text-trace-300"
                    : "rounded-full border border-ink-600 px-3 py-1 text-sm text-paper-muted hover:border-trace hover:text-paper"
                }
              >
                {tag} <span className="font-mono text-xs text-paper-faint">{count}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      {nerds.length === 0 ? (
        <div className="panel mt-10 p-8">
          <p className="font-mono text-sm text-paper-faint">
            {filtered ? "$ grep: 0 matches" : "$ ls: directory is empty"}
          </p>
          <p className="mt-2 text-paper-muted">
            {filtered ? (
              <Link href="/nerds" className="link-underline">
                Filter wissen
              </Link>
            ) : (
              "Nog niemand heeft een openbaar profiel. Wees de eerste."
            )}
          </p>
        </div>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {nerds.map((nerd) => (
            <li key={nerd.username}>
              <NerdCard nerd={nerd} />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
