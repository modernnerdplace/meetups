import Link from "next/link";

import { formatLongDate, formatTime } from "@/app/(public)/_lib/format";
import { Container } from "@/components/container";
import { AuditList } from "./_components/audit-list";
import { CapacityIndicator } from "./_components/capacity-indicator";
import { PageHeader } from "./_components/page-header";
import { StatCard } from "./_components/stat-card";
import { EventStatusBadge } from "./_components/status-badge";
import { TerminalBadge } from "./_components/terminal-badge";
import { getDashboard } from "./_lib/queries";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const data = await getDashboard();
  const next = data.upcoming[0] ?? null;
  const pendingWaitlist = data.upcoming.reduce((sum, event) => sum + event.counts.waitlist, 0);

  return (
    <>
      <PageHeader
        kicker="uptime: nog steeds nerds"
        title="Dashboard"
        actions={
          <Link href="/admin/events/new" className="btn-primary">
            Nieuw event
          </Link>
        }
      />

      <Container className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Leden" value={data.members} hint={`+${data.newMembers} in 30 dagen`} />
        <StatCard label="Komende events" value={data.upcoming.length} />
        <StatCard label="Op wachtlijsten" value={pendingWaitlist} />
        <StatCard label="Check-ins totaal" value={data.totalCheckIns} hint={`${data.organisers} organisatoren`} />
      </Container>

      <Container className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="next-heading" className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="next-heading" className="font-display text-lg font-bold">
              Volgende avond
            </h2>
            {next ? <EventStatusBadge status={next.status} /> : null}
          </div>
          {next ? (
            <div className="mt-4">
              <p className="font-display text-2xl font-bold">{next.title}</p>
              <p className="mt-1 text-paper-muted">
                {formatLongDate(next.startsAt)}, {formatTime(next.startsAt)}
                {next.venueName ? ` bij ${next.venueName}` : ""}
              </p>
              <CapacityIndicator
                className="mt-5 max-w-sm"
                going={next.counts.going}
                capacity={next.capacity}
                waitlist={next.counts.waitlist}
              />
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href={`/admin/events/${next.id}`} className="btn-ghost">
                  Beheren
                </Link>
                <Link href={`/admin/events/${next.id}/check-in`} className="btn-primary">
                  Check-in openen
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <TerminalBadge tone="warn">no upcoming events found</TerminalBadge>
              <p className="mt-3 text-paper-muted">Er staat nog niets gepland. Tijd voor een nieuwe avond.</p>
            </div>
          )}

          {data.upcoming.length > 1 ? (
            <ul className="mt-8 divide-y divide-ink-700 border-t border-ink-700">
              {data.upcoming.slice(1).map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-4 py-3">
                  <Link href={`/admin/events/${event.id}`} className="min-w-0 hover:text-trace-300">
                    <span className="block truncate font-medium">{event.title}</span>
                    <span className="font-mono text-xs text-paper-faint">
                      {formatLongDate(event.startsAt)}
                    </span>
                  </Link>
                  <CapacityIndicator
                    going={event.counts.going}
                    capacity={event.capacity}
                    waitlist={event.counts.waitlist}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section aria-labelledby="log-heading" className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="log-heading" className="font-display text-lg font-bold">
              Laatste wijzigingen
            </h2>
            <Link href="/admin/audit" className="link-underline text-sm text-paper-muted">
              Alles
            </Link>
          </div>
          <div className="mt-3">
            <AuditList rows={data.recentAudit} />
          </div>
        </section>
      </Container>
    </>
  );
}
