import Link from "next/link";
import { notFound } from "next/navigation";

import { formatLongDate, formatTime } from "@/app/(public)/_lib/format";
import { Container } from "@/components/container";
import { getCurrentMember, isAdmin } from "@/lib/auth";
import { utcToAmsterdamLocal } from "@/lib/time";
import { updateEventAction } from "../../actions";
import { AuditList } from "../../_components/audit-list";
import { CapacityIndicator } from "../../_components/capacity-indicator";
import { DeleteEvent } from "../../_components/delete-event";
import { EventForm, type EventFormValues } from "../../_components/event-form";
import { EventStatusControls } from "../../_components/event-status-controls";
import { PageHeader } from "../../_components/page-header";
import { Registrations } from "../../_components/registrations";
import { EventStatusBadge } from "../../_components/status-badge";
import { TerminalBadge } from "../../_components/terminal-badge";
import { getEventForEdit, listAudit, listRegistrations } from "../../_lib/queries";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const event = await getEventForEdit(id);
  return { title: event?.title ?? "Event" };
}

export default async function AdminEventPage({ params, searchParams }: Props) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const [event, registrations, history, member] = await Promise.all([
    getEventForEdit(id),
    listRegistrations(id),
    listAudit({ eventId: id, take: 30 }),
    getCurrentMember(),
  ]);
  if (!event) notFound();

  const values: EventFormValues = {
    title: event.title,
    slug: event.slug,
    summary: event.summary ?? "",
    description: event.description ?? "",
    startsAt: utcToAmsterdamLocal(event.startsAt),
    endsAt: event.endsAt ? utcToAmsterdamLocal(event.endsAt) : "",
    venueName: event.venueName ?? "",
    venueAddress: event.venueAddress ?? "",
    venueUrl: event.venueUrl ?? "",
    capacity: event.capacity?.toString() ?? "",
    coverImageUrl: event.coverImageUrl ?? "",
    recordingUrl: event.recordingUrl ?? "",
  };

  const going = registrations.filter((row) => row.status === "GOING").length;
  const waitlist = registrations.filter((row) => row.status === "WAITLIST").length;
  const checkedIn = registrations.filter((row) => row.checkedInAt).length;

  return (
    <>
      <PageHeader
        kicker={`${formatLongDate(event.startsAt)}, ${formatTime(event.startsAt)}`}
        title={event.title}
        actions={
          <>
            {event.status !== "DRAFT" ? (
              <Link href={`/events/${event.slug}`} className="btn-ghost">
                Bekijk op de site
              </Link>
            ) : null}
            <Link href={`/admin/events/${event.id}/check-in`} className="btn-primary">
              Check-in
            </Link>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <EventStatusBadge status={event.status} />
          {event.meetupComUrl ? (
            <TerminalBadge>geimporteerd van meetup.com</TerminalBadge>
          ) : null}
          <span className="font-mono text-xs text-paper-faint">/{event.slug}</span>
        </div>
      </PageHeader>

      <Container className="mt-6">
        {created ? (
          <p role="status" className="panel mb-6 px-4 py-3 text-sm">
            <TerminalBadge tone="ok">ok</TerminalBadge>
            <span className="ml-2">Concept aangemaakt. Controleer alles en publiceer als het klaar is.</span>
          </p>
        ) : null}
        <div className="panel flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <CapacityIndicator going={going} capacity={event.capacity} waitlist={waitlist} className="w-56" />
          <p className="font-mono text-xs text-paper-faint">{checkedIn} ingecheckt</p>
          <EventStatusControls eventId={event.id} status={event.status} />
        </div>
      </Container>

      <Container className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="edit-heading">
          <h2 id="edit-heading" className="font-display text-xl font-bold">
            Gegevens
          </h2>
          <div className="mt-4">
            <EventForm action={updateEventAction} values={values} eventId={event.id} submitLabel="Opslaan" />
          </div>
        </section>

        <div className="space-y-10">
          <section aria-labelledby="rsvp-heading" className="panel p-4 sm:p-5">
            <h2 id="rsvp-heading" className="font-display text-xl font-bold">
              Aanmeldingen
            </h2>
            <p className="mt-1 text-xs text-paper-faint">
              Opmerkingen zijn alleen voor organisatoren zichtbaar.
            </p>
            <div className="mt-4">
              <Registrations
                eventId={event.id}
                rows={registrations.map((row) => ({
                  id: row.id,
                  status: row.status,
                  waitlistPosition: row.waitlistPosition,
                  checkedIn: row.checkedInAt !== null,
                  note: row.note,
                  createdAt: row.createdAt.toISOString(),
                  name: row.member.name,
                  company: row.member.company,
                }))}
              />
            </div>
          </section>

          <section aria-labelledby="history-heading" className="panel p-4 sm:p-5">
            <h2 id="history-heading" className="font-display text-xl font-bold">
              Geschiedenis
            </h2>
            <div className="mt-3">
              <AuditList rows={history} empty="nog geen wijzigingen via het beheer." />
            </div>
          </section>

          {isAdmin(member) ? (
            <section aria-labelledby="danger-heading" className="rounded-lg border border-rocket/40 p-4 sm:p-5">
              <h2 id="danger-heading" className="font-display text-xl font-bold text-rocket-300">
                Verwijderen
              </h2>
              <div className="mt-3">
                <DeleteEvent eventId={event.id} title={event.title} rsvps={registrations.length} />
              </div>
            </section>
          ) : null}
        </div>
      </Container>
    </>
  );
}
