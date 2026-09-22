"use client";

import { useState, useTransition } from "react";

import { setEventSponsorsAction } from "../programme-actions";

export type SponsorPick = { sponsorId: string; name: string; role: string; on: boolean };

export function SponsorPicker({ eventId, sponsors }: { eventId: string; sponsors: SponsorPick[] }) {
  const [rows, setRows] = useState(sponsors);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save(next: SponsorPick[]) {
    setRows(next);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setEventSponsorsAction({
        eventId,
        sponsors: next.filter((r) => r.on).map((r) => ({ sponsorId: r.sponsorId, role: r.role.trim() || null })),
      });
      if (result.ok) setSaved(true);
      else setError(result.error ?? "Dat lukte niet.");
    });
  }

  if (sponsors.length === 0) {
    return <p className="text-sm text-paper-faint">Nog geen sponsors. Voeg ze toe onder Sponsors in het menu.</p>;
  }

  return (
    <div className={pending ? "opacity-70" : undefined}>
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={row.sponsorId} className="flex flex-wrap items-center gap-3">
            <label className="flex min-w-[10rem] items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-rocket"
                checked={row.on}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, on: event.target.checked };
                  save(next);
                }}
              />
              {row.name}
            </label>
            {row.on ? (
              <input
                aria-label={`Rol van ${row.name}`}
                placeholder="locatie, pizza, opnames"
                className="field max-w-[14rem] py-1.5 text-sm"
                value={row.role}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, role: event.target.value };
                  setRows(next);
                }}
                onBlur={() => save(rows)}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {saved ? <p className="mt-2 text-xs text-paper-faint">Opgeslagen.</p> : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-rocket-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
