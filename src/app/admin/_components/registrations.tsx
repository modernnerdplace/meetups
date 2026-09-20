"use client";

import { clsx } from "clsx";
import { useMemo, useState, useTransition } from "react";

import { rsvpActionAction } from "../actions";
import { RsvpStatusBadge } from "./status-badge";

export type RegistrationRow = {
  id: string;
  status: "GOING" | "WAITLIST" | "CANCELLED";
  waitlistPosition: number | null;
  checkedIn: boolean;
  note: string | null;
  createdAt: string;
  name: string;
  company: string | null;
};

type Tab = "GOING" | "WAITLIST" | "CANCELLED";
type Action = "cancel" | "promote" | "checkin" | "undo";

const tabs: { key: Tab; label: string }[] = [
  { key: "GOING", label: "Komen" },
  { key: "WAITLIST", label: "Wachtlijst" },
  { key: "CANCELLED", label: "Afgemeld" },
];

const confirmText: Partial<Record<Action, string>> = {
  cancel: "Deze aanmelding annuleren? De eerste van de wachtlijst schuift dan door.",
  promote: "Toelaten, ook als het event vol zit?",
};

const dateFormat = new Intl.DateTimeFormat("nl-NL", {
  timeZone: "Europe/Amsterdam",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function Registrations({ eventId, rows }: { eventId: string; rows: RegistrationRow[] }) {
  const [tab, setTab] = useState<Tab>("GOING");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const out: Record<Tab, number> = { GOING: 0, WAITLIST: 0, CANCELLED: 0 };
    for (const row of rows) out[row.status] += 1;
    return out;
  }, [rows]);
  const visible = rows.filter((row) => row.status === tab);

  function run(row: RegistrationRow, action: Action) {
    const text = confirmText[action];
    if (text && !window.confirm(`${row.name}: ${text}`)) return;
    setError(null);
    setBusyId(row.id);
    startTransition(async () => {
      const result = await rsvpActionAction({ rsvpId: row.id, eventId, action });
      if (!result.ok) setError(result.error ?? "Dat lukte niet.");
      setBusyId(null);
    });
  }

  return (
    <div>
      <div role="tablist" aria-label="Aanmeldingen" className="flex gap-1 border-b border-ink-700">
        {tabs.map((item) => (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={clsx(
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === item.key ? "border-trace text-paper" : "border-transparent text-paper-muted hover:text-paper",
            )}
          >
            {item.label} <span className="font-mono text-xs text-paper-faint">{counts[item.key]}</span>
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-rocket-300">
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="py-6 font-mono text-sm text-paper-faint">$ ls: leeg</p>
      ) : (
        <ul role="tabpanel" className="divide-y divide-ink-700">
          {visible.map((row) => {
            const busy = pending && busyId === row.id;
            return (
              <li key={row.id} className={clsx("grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center", busy && "opacity-60")}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.name}</span>
                    <RsvpStatusBadge status={row.status} checkedIn={row.checkedIn} position={row.waitlistPosition} />
                  </div>
                  <p className="mt-0.5 text-xs text-paper-faint">
                    {row.company ? `${row.company} · ` : ""}aangemeld {dateFormat.format(new Date(row.createdAt))}
                  </p>
                  {row.note ? (
                    <p className="mt-1 text-sm text-spark">
                      <span className="sr-only">Opmerking: </span>
                      {row.note}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.status === "GOING" && !row.checkedIn ? (
                    <button type="button" className="btn-ghost px-3 py-2" disabled={busy} onClick={() => run(row, "checkin")}>
                      Inchecken
                    </button>
                  ) : null}
                  {row.checkedIn ? (
                    <button type="button" className="btn-ghost px-3 py-2" disabled={busy} onClick={() => run(row, "undo")}>
                      Check-in terug
                    </button>
                  ) : null}
                  {row.status === "WAITLIST" ? (
                    <button type="button" className="btn-ghost px-3 py-2" disabled={busy} onClick={() => run(row, "promote")}>
                      Toelaten
                    </button>
                  ) : null}
                  {row.status !== "CANCELLED" ? (
                    <button
                      type="button"
                      className="btn px-3 py-2 text-paper-muted hover:text-rocket-300"
                      disabled={busy}
                      onClick={() => run(row, "cancel")}
                    >
                      Afmelden
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
