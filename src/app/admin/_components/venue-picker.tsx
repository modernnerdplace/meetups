"use client";

import { useState, useTransition } from "react";

import { setEventVenueAction } from "../programme-actions";

export function VenuePicker({
  eventId,
  venues,
  current,
}: {
  eventId: string;
  venues: { id: string; name: string; city: string | null }[];
  current: string | null;
}) {
  const [value, setValue] = useState(current ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function change(next: string) {
    setValue(next);
    setError(null);
    setSaved(false);
    const form = new FormData();
    form.set("eventId", eventId);
    form.set("venueId", next);
    startTransition(async () => {
      const result = await setEventVenueAction(form);
      if (result.ok) setSaved(true);
      else {
        setValue(current ?? "");
        setError(result.error ?? "Dat lukte niet.");
      }
    });
  }

  return (
    <div>
      <label htmlFor="venueId" className="block text-sm font-medium">
        Locatie
      </label>
      <select
        id="venueId"
        className="field mt-1.5"
        value={value}
        disabled={pending}
        onChange={(event) => change(event.target.value)}
      >
        <option value="">Geen vaste locatie</option>
        {venues.map((venue) => (
          <option key={venue.id} value={venue.id}>
            {venue.name}
            {venue.city ? ` (${venue.city})` : ""}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-xs text-paper-faint">
        Kiezen vult meteen naam, adres en link op de eventpagina.
        {saved ? " Opgeslagen." : ""}
      </p>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-rocket-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
