import Link from "next/link";
import { notFound } from "next/navigation";

import { formatLongDate, formatTime } from "@/app/(public)/_lib/format";
import { Container } from "@/components/container";
import { CheckInList } from "../../../_components/check-in-list";
import { getEventForEdit, listRegistrations } from "../../../_lib/queries";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const event = await getEventForEdit(id);
  return { title: event ? `Check-in ${event.title}` : "Check-in" };
}

export default async function CheckInPage({ params }: Props) {
  const { id } = await params;
  const [event, registrations] = await Promise.all([getEventForEdit(id), listRegistrations(id)]);
  if (!event) notFound();

  const rows = registrations
    .filter((row) => row.status !== "CANCELLED")
    .map((row) => ({
      id: row.id,
      name: row.member.name,
      company: row.member.company,
      status: row.status as "GOING" | "WAITLIST",
      waitlistPosition: row.waitlistPosition,
      checkedInAt: row.checkedInAt?.toISOString() ?? null,
      note: row.note,
    }));

  return (
    <Container className="max-w-2xl pt-6">
      <Link href={`/admin/events/${event.id}`} className="link-underline text-sm text-paper-muted">
        Terug naar het event
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">{event.title}</h1>
      <p className="font-mono text-xs text-paper-faint">
        {formatLongDate(event.startsAt)}, {formatTime(event.startsAt)} · tik op een naam om in te checken
      </p>
      <div className="mt-4">
        <CheckInList eventId={event.id} rows={rows} />
      </div>
    </Container>
  );
}
