import type { EventStatus, RsvpStatus } from "@prisma/client";
import { TerminalBadge, type BadgeTone } from "./terminal-badge";

const eventStatus: Record<EventStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "concept", tone: "warn" },
  PUBLISHED: { label: "live", tone: "ok" },
  CANCELLED: { label: "geannuleerd", tone: "danger" },
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const { label, tone } = eventStatus[status];
  return <TerminalBadge tone={tone}>{label}</TerminalBadge>;
}

const rsvpStatus: Record<RsvpStatus, { label: string; tone: BadgeTone }> = {
  GOING: { label: "komt", tone: "ok" },
  WAITLIST: { label: "wachtlijst", tone: "warn" },
  CANCELLED: { label: "afgemeld", tone: "neutral" },
};

export function RsvpStatusBadge({
  status,
  checkedIn,
  position,
}: {
  status: RsvpStatus;
  checkedIn: boolean;
  position?: number | null;
}) {
  if (checkedIn) return <TerminalBadge tone="info">binnen</TerminalBadge>;
  const { label, tone } = rsvpStatus[status];
  return (
    <TerminalBadge tone={tone}>
      {label}
      {status === "WAITLIST" && position ? ` #${position}` : null}
    </TerminalBadge>
  );
}
