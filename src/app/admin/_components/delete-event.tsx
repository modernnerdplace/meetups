"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState } from "react";

import { deleteEventAction, type ActionState } from "../actions";

export function DeleteEvent({ eventId, title, rsvps }: { eventId: string; title: string; rsvps: number }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteEventAction, { ok: false });
  const [typed, setTyped] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.replace("/admin/events?deleted=1");
  }, [state.ok, router]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-3"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <p className="text-sm text-paper-muted">
        Verwijderen haalt het event en {rsvps === 1 ? "de enige aanmelding" : `alle ${rsvps} aanmeldingen`} definitief
        weg. Liever niet zichtbaar? Haal het dan offline. Typ de titel om te bevestigen.
      </p>
      <label htmlFor="confirmTitle" className="sr-only">
        Titel ter bevestiging
      </label>
      <input
        id="confirmTitle"
        name="confirmTitle"
        className="field"
        placeholder={title}
        autoComplete="off"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
      />
      {state.error ? (
        <p role="alert" className="text-sm text-rocket-300">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        className="btn border border-rocket/60 text-rocket-300 hover:bg-rocket hover:text-white disabled:opacity-40"
        disabled={pending || state.ok || typed.trim() !== title.trim()}
      >
        {pending ? "Bezig..." : "rm -rf dit event"}
      </button>
    </form>
  );
}
