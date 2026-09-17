"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { site } from "@/app/(public)/_lib/site";

export type RsvpSnapshot = {
  status: "GOING" | "WAITLIST" | "CANCELLED" | null;
  waitlistPosition: number | null;
  goingCount: number;
  waitlistCount: number;
  capacity: number | null;
  spotsLeft: number | null;
  full: boolean;
};

const UNAVAILABLE =
  "Aanmelden lukt nu even niet. Zeg het op Discord, dan zetten we je er met de hand bij.";

type Busy = "idle" | "joining" | "leaving";

export function RsvpForm({
  slug,
  signedIn,
  memberName,
  initial,
}: {
  slug: string;
  signedIn: boolean;
  memberName: string | null;
  initial: RsvpSnapshot;
}) {
  const router = useRouter();
  const [state, setState] = useState<RsvpSnapshot>(initial);
  const [busy, setBusy] = useState<Busy>("idle");
  const [error, setError] = useState<string | null>(null);

  const attending = state.status === "GOING" || state.status === "WAITLIST";

  async function call(method: "POST" | "DELETE", body?: unknown) {
    setError(null);
    setBusy(method === "POST" ? "joining" : "leaving");
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(slug)}/rsvp`, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      // Zolang de route er nog niet is komt hier geen JSON terug.
      let payload: Record<string, unknown>;
      try {
        payload = (await response.json()) as Record<string, unknown>;
      } catch {
        setError(UNAVAILABLE);
        return;
      }

      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/events/${slug}`)}`);
        return;
      }

      if (!response.ok) {
        setError(typeof payload.error === "string" ? payload.error : UNAVAILABLE);
        return;
      }

      const event = (payload.event ?? {}) as Record<string, unknown>;
      setState({
        status: (payload.status as RsvpSnapshot["status"]) ?? null,
        waitlistPosition: (payload.waitlistPosition as number | null) ?? null,
        goingCount: Number(event.goingCount ?? state.goingCount),
        waitlistCount: Number(event.waitlistCount ?? state.waitlistCount),
        capacity: (event.capacity as number | null) ?? state.capacity,
        spotsLeft: (event.spotsLeft as number | null) ?? null,
        full: Boolean(event.full),
      });
      router.refresh();
    } catch {
      setError(UNAVAILABLE);
    } finally {
      setBusy("idle");
    }
  }

  return (
    <div className="panel p-6">
      <h2 className="font-display text-xl font-bold">
        {attending ? "Je bent aangemeld" : "Aanmelden"}
      </h2>

      <Counts state={state} />

      {attending ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-relaxed text-paper-muted">
            {state.status === "WAITLIST"
              ? `Je staat op de wachtlijst${
                  state.waitlistPosition ? `, plek ${state.waitlistPosition}` : ""
                }. Valt er iemand af, dan schuif je door en krijg je bericht.`
              : "Tot dan. Kun je toch niet? Meld je af, dan kan iemand van de wachtlijst erbij."}
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={`/api/events/${encodeURIComponent(slug)}/ics`} className="btn-ghost flex-1">
              In je agenda
            </a>
            <button
              type="button"
              onClick={() => call("DELETE")}
              disabled={busy !== "idle"}
              className="btn-ghost flex-1"
            >
              {busy === "leaving" ? "Bezig" : "Afmelden"}
            </button>
          </div>
        </div>
      ) : signedIn ? (
        <form
          onSubmit={(formEvent) => {
            formEvent.preventDefault();
            const data = new FormData(formEvent.currentTarget);
            const note = String(data.get("note") ?? "").trim();
            void call("POST", note ? { note } : {});
          }}
          className="mt-4 space-y-4"
        >
          {memberName ? (
            <p className="text-sm text-paper-muted">
              Je meldt je aan als <span className="text-paper">{memberName}</span>.
            </p>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1.5 block text-paper-muted">Opmerking (mag leeg)</span>
            <textarea name="note" rows={2} maxLength={500} className="field" />
            <span className="mt-1.5 block text-xs text-paper-faint">
              Bijvoorbeeld een dieetwens. Alleen de organisatie leest dit.
            </span>
          </label>

          <button type="submit" disabled={busy !== "idle"} className="btn-primary w-full">
            {busy === "joining" ? "Bezig" : state.full ? "Op de wachtlijst" : "Ik kom"}
          </button>
        </form>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-relaxed text-paper-muted">
            Je meldt je aan met je Discord-account of met een code per e-mail. We bewaren alleen je
            naam en je e-mailadres.
          </p>
          <a
            href={`/login?next=${encodeURIComponent(`/events/${slug}`)}`}
            className="btn-primary w-full"
          >
            Inloggen en aanmelden
          </a>
        </div>
      )}

      {error ? (
        <p className="mt-4 text-sm text-rocket-300" role="alert">
          {error}{" "}
          <a href={site.discordUrl} className="link-underline" rel="noopener noreferrer">
            Naar Discord
          </a>
        </p>
      ) : null}
    </div>
  );
}

function Counts({ state }: { state: RsvpSnapshot }) {
  if (state.capacity === null) {
    return state.goingCount > 0 ? (
      <p className="mt-2 font-mono text-xs text-paper-faint">
        {state.goingCount} {state.goingCount === 1 ? "aanmelding" : "aanmeldingen"} tot nu toe.
      </p>
    ) : (
      <p className="mt-2 font-mono text-xs text-paper-faint">Nog niemand aangemeld. Wees de eerste.</p>
    );
  }

  const left = state.spotsLeft ?? Math.max(state.capacity - state.goingCount, 0);
  let line: string;
  if (left === 0) {
    line = `Vol. ${
      state.waitlistCount > 0 ? `${state.waitlistCount} op de wachtlijst.` : "Je kunt op de wachtlijst."
    }`;
  } else if (state.goingCount === 0) {
    line = `Ruimte voor ${state.capacity}. Nog niemand aangemeld.`;
  } else {
    line = `Nog ${left} van de ${state.capacity} plekken vrij.`;
  }
  return <p className="mt-2 font-mono text-xs text-paper-faint">{line}</p>;
}
