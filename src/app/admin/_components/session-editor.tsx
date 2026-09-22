"use client";

import { clsx } from "clsx";
import { startTransition, useActionState, useEffect, useState, useTransition } from "react";

import type { ActionState } from "../actions";
import { saveSessionAction, sessionRowAction } from "../programme-actions";

export type SessionRow = {
  id: string;
  title: string;
  abstract: string | null;
  startsAt: string;
  endsAt: string;
  room: string | null;
  slidesUrl: string | null;
  recordingUrl: string | null;
  speakerIds: string[];
  speakerNames: string[];
};

export type SpeakerOption = { id: string; name: string };

const empty: SessionRow = {
  id: "",
  title: "",
  abstract: null,
  startsAt: "",
  endsAt: "",
  room: null,
  slidesUrl: null,
  recordingUrl: null,
  speakerIds: [],
  speakerNames: [],
};

function SessionForm({
  eventId,
  session,
  speakers,
  onDone,
}: {
  eventId: string;
  session: SessionRow;
  speakers: SpeakerOption[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSessionAction, { ok: false });
  const [picked, setPicked] = useState<string[]>(session.speakerIds);
  const errors = state.fieldErrors ?? {};

  // Opgeslagen: het formulier sluit zichzelf.
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        data.set("speakerIds", picked.join(","));
        startTransition(() => action(data));
      }}
      className="panel space-y-4 p-4 sm:p-5"
      noValidate
    >
      <input type="hidden" name="eventId" value={eventId} />
      {session.id ? <input type="hidden" name="sessionId" value={session.id} /> : null}

      {state.error ? (
        <p role="alert" className="rounded-md border border-rocket/50 bg-rocket/10 px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}

      <div>
        <label htmlFor="session-title" className="block text-sm font-medium">
          Titel
        </label>
        <input
          id="session-title"
          name="title"
          defaultValue={session.title}
          required
          className={clsx("field mt-1.5", errors.title && "border-rocket")}
        />
        {errors.title ? <p className="mt-1 text-sm text-rocket-300">{errors.title}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="session-startsAt" className="block text-sm font-medium">
            Begint
          </label>
          <input
            id="session-startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={session.startsAt}
            className={clsx("field mt-1.5", errors.startsAt && "border-rocket")}
          />
        </div>
        <div>
          <label htmlFor="session-endsAt" className="block text-sm font-medium">
            Eindigt
          </label>
          <input
            id="session-endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={session.endsAt}
            className={clsx("field mt-1.5", errors.endsAt && "border-rocket")}
          />
          {errors.endsAt ? <p className="mt-1 text-sm text-rocket-300">{errors.endsAt}</p> : null}
        </div>
        <div>
          <label htmlFor="session-room" className="block text-sm font-medium">
            Zaal
          </label>
          <input id="session-room" name="room" defaultValue={session.room ?? ""} className="field mt-1.5" />
        </div>
      </div>

      <div>
        <label htmlFor="session-abstract" className="block text-sm font-medium">
          Waar gaat het over
        </label>
        <textarea
          id="session-abstract"
          name="abstract"
          rows={4}
          defaultValue={session.abstract ?? ""}
          className="field mt-1.5"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Sprekers</legend>
        {speakers.length === 0 ? (
          <p className="mt-1.5 text-sm text-paper-faint">
            Nog geen sprekers. Voeg ze toe onder Sprekers in het menu.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {speakers.map((speaker) => {
              const on = picked.includes(speaker.id);
              return (
                <button
                  key={speaker.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setPicked((current) =>
                      on ? current.filter((id) => id !== speaker.id) : [...current, speaker.id],
                    )
                  }
                  className={clsx(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    on ? "border-trace bg-trace/15 text-trace-300" : "border-ink-600 text-paper-muted hover:text-paper",
                  )}
                >
                  {speaker.name}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="session-slidesUrl" className="block text-sm font-medium">
            Slides
          </label>
          <input
            id="session-slidesUrl"
            name="slidesUrl"
            type="url"
            defaultValue={session.slidesUrl ?? ""}
            className={clsx("field mt-1.5", errors.slidesUrl && "border-rocket")}
          />
        </div>
        <div>
          <label htmlFor="session-recordingUrl" className="block text-sm font-medium">
            Opname
          </label>
          <input
            id="session-recordingUrl"
            name="recordingUrl"
            type="url"
            defaultValue={session.recordingUrl ?? ""}
            className={clsx("field mt-1.5", errors.recordingUrl && "border-rocket")}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Bezig..." : session.id ? "Sessie opslaan" : "Sessie toevoegen"}
        </button>
        <button type="button" className="btn-ghost" onClick={onDone} disabled={pending}>
          Annuleren
        </button>
      </div>
    </form>
  );
}

export function SessionEditor({
  eventId,
  sessions,
  speakers,
}: {
  eventId: string;
  sessions: SessionRow[];
  speakers: SpeakerOption[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startRowTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function row(session: SessionRow, action: "delete" | "up" | "down") {
    if (action === "delete" && !window.confirm(`"${session.title}" uit het programma halen?`)) return;
    setError(null);
    startRowTransition(async () => {
      const result = await sessionRowAction({ sessionId: session.id, eventId, action });
      if (!result.ok) setError(result.error ?? "Dat lukte niet.");
    });
  }

  return (
    <div>
      {error ? (
        <p role="alert" className="mb-3 text-sm text-rocket-300">
          {error}
        </p>
      ) : null}

      {sessions.length === 0 && !adding ? (
        <p className="font-mono text-sm text-paper-faint">$ cat programma: nog leeg</p>
      ) : (
        <ol className="divide-y divide-ink-700">
          {sessions.map((session, index) => (
            <li key={session.id} className="py-3">
              {editing === session.id ? (
                <SessionForm
                  eventId={eventId}
                  session={session}
                  speakers={speakers}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <div className={clsx("flex flex-wrap items-start justify-between gap-3", pending && "opacity-70")}>
                  <div className="min-w-0">
                    <p className="font-medium">
                      <span className="mr-2 font-mono text-xs text-paper-faint">
                        {session.startsAt ? session.startsAt.slice(11) : String(index + 1).padStart(2, "0")}
                      </span>
                      {session.title}
                    </p>
                    <p className="mt-0.5 text-xs text-paper-faint">
                      {session.speakerNames.length > 0 ? session.speakerNames.join(", ") : "geen spreker"}
                      {session.room ? ` · ${session.room}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1.5 text-xs"
                      disabled={pending || index === 0}
                      onClick={() => row(session, "up")}
                      aria-label="Omhoog"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1.5 text-xs"
                      disabled={pending || index === sessions.length - 1}
                      onClick={() => row(session, "down")}
                      aria-label="Omlaag"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-3 py-1.5 text-xs"
                      onClick={() => {
                        setAdding(false);
                        setEditing(session.id);
                      }}
                    >
                      Wijzig
                    </button>
                    <button
                      type="button"
                      className="btn px-3 py-1.5 text-xs text-paper-muted hover:text-rocket-300"
                      disabled={pending}
                      onClick={() => row(session, "delete")}
                    >
                      Weg
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4">
        {adding ? (
          <SessionForm eventId={eventId} session={empty} speakers={speakers} onDone={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
          >
            Sessie toevoegen
          </button>
        )}
      </div>
    </div>
  );
}
