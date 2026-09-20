"use client";

import type { EventStatus } from "@prisma/client";
import { useState, useTransition } from "react";

import { setEventStatusAction } from "../actions";

const transitions: Record<EventStatus, { to: EventStatus; label: string; confirm?: string; primary?: boolean }[]> = {
  DRAFT: [{ to: "PUBLISHED", label: "Publiceren", primary: true }],
  PUBLISHED: [
    {
      to: "DRAFT",
      label: "Offline halen",
      confirm: "Het event verdwijnt van de site. Aanmeldingen blijven bewaard. Doorgaan?",
    },
    {
      to: "CANCELLED",
      label: "Annuleren",
      confirm: "Het event blijft zichtbaar met een label 'geannuleerd' en aanmelden kan niet meer. Doorgaan?",
    },
  ],
  CANCELLED: [
    { to: "PUBLISHED", label: "Weer openzetten", confirm: "Het event wordt weer normaal zichtbaar. Doorgaan?" },
    { to: "DRAFT", label: "Offline halen" },
  ],
};

export function EventStatusControls({ eventId, status }: { eventId: string; status: EventStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(to: EventStatus, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    const form = new FormData();
    form.set("eventId", eventId);
    form.set("status", to);
    startTransition(async () => {
      const result = await setEventStatusAction(form);
      if (!result.ok) setError(result.error ?? "Dat lukte niet.");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {transitions[status].map((option) => (
        <button
          key={option.to}
          type="button"
          disabled={pending}
          onClick={() => change(option.to, option.confirm)}
          className={option.primary ? "btn-primary" : "btn-ghost"}
        >
          {option.label}
        </button>
      ))}
      {error ? (
        <p role="alert" className="w-full text-sm text-rocket-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
