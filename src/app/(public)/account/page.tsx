import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { formatMediumDate } from "../_lib/format";
import { Container, Kicker } from "@/components/container";
import { getCurrentMember, isOrganiser } from "@/lib/auth";
import { getOwnAccount, suggestUsername } from "@/lib/profile";
import { LogoutButton } from "./logout-button";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Je account",
  robots: { index: false },
};

const statusLabel = { GOING: "aangemeld", WAITLIST: "wachtlijst", CANCELLED: "afgemeld" } as const;

export default async function AccountPage() {
  const me = await getCurrentMember();
  if (!me) redirect("/login?next=/account");
  const { member, rsvps } = await getOwnAccount(me.id);
  const now = Date.now();
  const upcoming = rsvps.filter((row) => row.event.startsAt.getTime() >= now);

  return (
    <Container className="py-12 sm:py-16">
      <Kicker>~/account</Kicker>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-bold tracking-tight">Hoi {member.name.split(" ")[0]} 👋</h1>
        <div className="flex flex-wrap gap-2">
          {isOrganiser(member) ? (
            <Link href="/admin" className="btn-ghost">
              Beheer
            </Link>
          ) : null}
          <LogoutButton />
        </div>
      </div>
      <p className="mt-2 text-paper-muted">
        Ingelogd{member.email ? ` als ${member.email}` : member.discordId ? " via Discord" : ""}. Alleen jij ziet dit.
      </p>

      <div className="mt-10 gap-12 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="font-display text-2xl font-bold">
            Je profiel
          </h2>
          <div className="mt-5">
            <ProfileForm
              suggestedUsername={suggestUsername(member.name)}
              values={{
                name: member.name,
                username: member.username ?? "",
                company: member.company ?? "",
                jobTitle: member.jobTitle ?? "",
                bio: member.bio ?? "",
                websiteUrl: member.websiteUrl ?? "",
                linkedinUrl: member.linkedinUrl ?? "",
                githubUrl: member.githubUrl ?? "",
                isMvp: member.isMvp,
                isMct: member.isMct,
                interests: member.interests.join(", "),
                profilePublic: member.profilePublic,
              }}
            />
          </div>
        </section>

        <aside className="mt-12 lg:mt-0" aria-labelledby="rsvp-heading">
          <h2 id="rsvp-heading" className="font-display text-2xl font-bold">
            Je meetups
          </h2>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-paper-muted">
              Nog nergens voor aangemeld.{" "}
              <Link href="/events" className="link-underline">
                Naar de agenda
              </Link>
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-ink-700 border-t border-ink-700">
              {upcoming.map((row) => (
                <li key={row.event.slug} className="py-3">
                  <Link href={`/events/${row.event.slug}`} className="font-medium hover:text-trace-300">
                    {row.event.title}
                  </Link>
                  <p className="font-mono text-xs text-paper-faint">
                    {formatMediumDate(row.event.startsAt)} · {statusLabel[row.status]}
                    {row.status === "WAITLIST" && row.waitlistPosition ? ` #${row.waitlistPosition}` : ""}
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
