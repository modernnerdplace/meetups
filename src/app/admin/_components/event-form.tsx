"use client";

import { clsx } from "clsx";
import { startTransition, useActionState } from "react";

import type { ActionState } from "../actions";
import { TerminalBadge } from "./terminal-badge";

export type EventFormValues = {
  title: string;
  slug: string;
  summary: string;
  description: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  venueAddress: string;
  venueUrl: string;
  capacity: string;
  coverImageUrl: string;
  recordingUrl: string;
};

export const emptyEventValues: EventFormValues = {
  title: "",
  slug: "",
  summary: "",
  description: "",
  startsAt: "",
  endsAt: "",
  venueName: "",
  venueAddress: "",
  venueUrl: "",
  capacity: "",
  coverImageUrl: "",
  recordingUrl: "",
};

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

function Field({
  name,
  label,
  hint,
  error,
  className,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-sm font-medium text-paper">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${name}-error`} className="mt-1.5 text-sm text-rocket-300">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-paper-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function EventForm({
  action,
  values,
  eventId,
  submitLabel,
}: {
  action: Action;
  values: EventFormValues;
  eventId?: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, { ok: false });
  const errors = state.fieldErrors ?? {};

  const input = (name: keyof EventFormValues, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      id={name}
      name={name}
      defaultValue={values[name]}
      aria-invalid={errors[name] ? true : undefined}
      aria-describedby={errors[name] ? `${name}-error` : undefined}
      className={clsx("field", errors[name] && "border-rocket")}
      {...props}
    />
  );

  return (
    <form
      // Handmatig in plaats van action={...}: React zet een formulier na een action
      // terug naar de beginwaarden, en dan ben je bij een typfout alles kwijt.
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-8"
      noValidate
    >
      {eventId ? <input type="hidden" name="eventId" value={eventId} /> : null}

      {state.error ? (
        <p role="alert" className="rounded-md border border-rocket/50 bg-rocket/10 px-4 py-3 text-sm">
          <TerminalBadge tone="danger">err</TerminalBadge> <span className="ml-2">{state.error}</span>
        </p>
      ) : state.ok && state.message ? (
        <p role="status" className="rounded-md border border-mint/40 bg-mint/10 px-4 py-3 text-sm">
          <TerminalBadge tone="ok">ok</TerminalBadge> <span className="ml-2">{state.message}</span>
        </p>
      ) : null}

      <fieldset className="panel grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <legend className="kicker px-1">Wat</legend>
        <Field name="title" label="Titel" error={errors.title} className="sm:col-span-2">
          {input("title", { required: true, maxLength: 160 })}
        </Field>
        <Field
          name="slug"
          label="Slug"
          hint="Leeg laten voor datum plus titel, zoals 2026-10-29-meetup-cloudspace."
          error={errors.slug}
        >
          {input("slug", { pattern: "[a-z0-9]+(-[a-z0-9]+)*", spellCheck: false })}
        </Field>
        <Field name="summary" label="Samenvatting" hint="Een zin voor in het overzicht." error={errors.summary}>
          {input("summary", { maxLength: 300 })}
        </Field>
        <Field
          name="description"
          label="Beschrijving"
          hint="Markdown werkt: koppen, lijstjes, links en code."
          error={errors.description}
          className="sm:col-span-2"
        >
          <textarea
            id="description"
            name="description"
            rows={10}
            defaultValue={values.description}
            className={clsx("field font-mono text-sm", errors.description && "border-rocket")}
          />
        </Field>
      </fieldset>

      <fieldset className="panel grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <legend className="kicker px-1">Wanneer en waar</legend>
        <Field name="startsAt" label="Begin" hint="Amsterdamse tijd." error={errors.startsAt}>
          {input("startsAt", { type: "datetime-local", required: true })}
        </Field>
        <Field name="endsAt" label="Einde" hint="Optioneel." error={errors.endsAt}>
          {input("endsAt", { type: "datetime-local" })}
        </Field>
        <Field name="venueName" label="Locatie" error={errors.venueName}>
          {input("venueName", { maxLength: 160 })}
        </Field>
        <Field name="venueAddress" label="Adres" error={errors.venueAddress}>
          {input("venueAddress", { maxLength: 300, autoComplete: "off" })}
        </Field>
        <Field name="venueUrl" label="Link naar de locatie" error={errors.venueUrl}>
          {input("venueUrl", { type: "url", inputMode: "url" })}
        </Field>
        <Field
          name="capacity"
          label="Capaciteit"
          hint="Leeg is onbeperkt en dus geen wachtlijst. Verhogen schuift de wachtlijst door."
          error={errors.capacity}
        >
          {input("capacity", { type: "number", min: 1, max: 10000, inputMode: "numeric" })}
        </Field>
      </fieldset>

      <fieldset className="panel grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <legend className="kicker px-1">Media</legend>
        <Field name="coverImageUrl" label="Omslagafbeelding (URL)" error={errors.coverImageUrl}>
          {input("coverImageUrl", { type: "url", inputMode: "url" })}
        </Field>
        <Field name="recordingUrl" label="Opname (URL)" hint="Voor na afloop." error={errors.recordingUrl}>
          {input("recordingUrl", { type: "url", inputMode: "url" })}
        </Field>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Bezig..." : submitLabel}
        </button>
        {pending ? <span className="font-mono text-xs text-paper-faint">$ saving...</span> : null}
      </div>
    </form>
  );
}
