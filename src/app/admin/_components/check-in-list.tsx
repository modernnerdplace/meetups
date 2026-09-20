"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";

import { rsvpActionAction } from "../actions";

export type CheckInRow = {
  id: string;
  name: string;
  company: string | null;
  status: "GOING" | "WAITLIST";
  waitlistPosition: number | null;
  checkedInAt: string | null;
  note: string | null;
};

/** Zoeken zonder accenten en hoofdletters: "jose" vindt "José". */
function normalise(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const REFRESH_MS = 20_000;

export function CheckInList({ eventId, rows: initialRows }: { eventId: string; rows: CheckInRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // Nieuwe serverdata overnemen (andere organisator checkt ook in, of refresh).
  useEffect(() => setRows(initialRows), [initialRows]);

  // Met twee mensen bij de deur blijft zo iedereen synchroon.
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  const going = rows.filter((row) => row.status === "GOING");
  const checkedIn = going.filter((row) => row.checkedInAt).length;
  const waitlist = rows.filter((row) => row.status === "WAITLIST");

  const filtered = useMemo(() => {
    const q = normalise(deferredQuery.trim());
    const match = (row: CheckInRow) =>
      !q || normalise(row.name).includes(q) || (row.company ? normalise(row.company).includes(q) : false);
    const sort = (a: CheckInRow, b: CheckInRow) =>
      Number(Boolean(a.checkedInAt)) - Number(Boolean(b.checkedInAt)) || a.name.localeCompare(b.name, "nl");
    return {
      going: rows.filter((row) => row.status === "GOING" && match(row)).sort(sort),
      waitlist: rows.filter((row) => row.status === "WAITLIST" && match(row)),
    };
  }, [rows, deferredQuery]);

  function act(row: CheckInRow, action: "checkin" | "undo" | "admit") {
    if (busy.has(row.id)) return;
    if (action === "admit" && !window.confirm(`${row.name} staat op de wachtlijst. Toch binnenlaten?`)) return;
    if (action === "undo" && !window.confirm(`Check-in van ${row.name} terugdraaien?`)) return;
    setError(null);

    // Meteen tonen, bij een fout terugzetten.
    const previous = row;
    const optimistic: CheckInRow =
      action === "undo"
        ? { ...row, checkedInAt: null }
        : { ...row, status: "GOING", waitlistPosition: null, checkedInAt: new Date().toISOString() };
    setRows((current) => current.map((item) => (item.id === row.id ? optimistic : item)));
    setBusy((current) => new Set(current).add(row.id));

    startTransition(async () => {
      const result = await rsvpActionAction({ rsvpId: row.id, eventId, action });
      setBusy((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
      if (!result.ok) {
        setRows((current) => current.map((item) => (item.id === row.id ? previous : item)));
        setError(`${row.name}: ${result.error ?? "dat lukte niet."}`);
      }
    });
  }

  return (
    <div>
      <div className="sticky top-[6.5rem] z-10 -mx-5 border-b border-ink-700 bg-ink-900/95 px-5 pb-4 pt-2 backdrop-blur sm:-mx-8 sm:px-8">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="panel py-2">
            <dt className="kicker text-[0.6rem]">Aangemeld</dt>
            <dd className="font-display text-2xl font-bold tabular-nums">{going.length}</dd>
          </div>
          <div className="panel border-trace/40 py-2">
            <dt className="kicker text-[0.6rem]">Binnen</dt>
            <dd className="font-display text-2xl font-bold tabular-nums text-trace-300">{checkedIn}</dd>
          </div>
          <div className="panel py-2">
            <dt className="kicker text-[0.6rem]">Wachtlijst</dt>
            <dd className="font-display text-2xl font-bold tabular-nums text-spark">{waitlist.length}</dd>
          </div>
        </dl>
        <label htmlFor="checkin-search" className="sr-only">
          Zoek op naam of bedrijf
        </label>
        <input
          id="checkin-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="grep naam of bedrijf..."
          className="field mt-3 text-base"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {error ? (
          <p role="alert" className="mt-2 text-sm text-rocket-300">
            {error}
          </p>
        ) : null}
      </div>

      <ul className="mt-4 space-y-2" aria-label="Aangemeld">
        {filtered.going.map((row) => {
          const inside = Boolean(row.checkedInAt);
          return (
            <li key={row.id} className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => (inside ? undefined : act(row, "checkin"))}
                aria-pressed={inside}
                aria-label={inside ? `${row.name} is binnen` : `${row.name} inchecken`}
                disabled={inside}
                className={clsx(
                  "flex min-h-[4rem] flex-1 items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors",
                  inside
                    ? "border-trace/40 bg-trace/10"
                    : "border-ink-600 bg-ink-850 active:bg-ink-700 hover:border-trace",
                  busy.has(row.id) && "opacity-70",
                )}
              >
                <span
                  aria-hidden
                  className={clsx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border font-mono text-sm",
                    inside ? "border-trace bg-trace text-ink-900" : "border-ink-500 text-paper-faint",
                  )}
                >
                  {inside ? "✓" : ""}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium">{row.name}</span>
                  {row.company || row.note ? (
                    <span className="block truncate text-xs text-paper-faint">
                      {row.company}
                      {row.company && row.note ? " · " : ""}
                      {row.note ? <span className="text-spark">{row.note}</span> : null}
                    </span>
                  ) : null}
                </span>
              </button>
              {inside ? (
                <button
                  type="button"
                  onClick={() => act(row, "undo")}
                  className="rounded-lg border border-ink-600 px-3 text-xs text-paper-muted hover:text-paper"
                  aria-label={`Check-in van ${row.name} terugdraaien`}
                >
                  undo
                </button>
              ) : null}
            </li>
          );
        })}
        {filtered.going.length === 0 ? (
          <li className="py-6 font-mono text-sm text-paper-faint">
            {query ? `$ grep "${query}": niets gevonden` : "Nog niemand aangemeld."}
          </li>
        ) : null}
      </ul>

      {filtered.waitlist.length > 0 ? (
        <section className="mt-10" aria-labelledby="waitlist-heading">
          <h2 id="waitlist-heading" className="kicker">
            Wachtlijst
          </h2>
          <ul className="mt-3 space-y-2">
            {filtered.waitlist.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-ink-600 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    <span className="mr-2 font-mono text-xs text-spark">#{row.waitlistPosition}</span>
                    {row.name}
                  </span>
                  {row.company ? <span className="block truncate text-xs text-paper-faint">{row.company}</span> : null}
                </span>
                <button type="button" onClick={() => act(row, "admit")} className="btn-ghost shrink-0 px-3 py-2 text-xs">
                  Toch binnen
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
