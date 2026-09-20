"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { startTransition, useActionState } from "react";

import { saveProfileAction, type ProfileState } from "./actions";

export type ProfileValues = {
  name: string;
  username: string;
  company: string;
  jobTitle: string;
  bio: string;
  websiteUrl: string;
  linkedinUrl: string;
  githubUrl: string;
  isMvp: boolean;
  isMct: boolean;
  interests: string;
  profilePublic: boolean;
};

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
      <label htmlFor={name} className="block text-sm font-medium">
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

export function ProfileForm({ values, suggestedUsername }: { values: ProfileValues; suggestedUsername: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfileAction, { ok: false });
  const errors = state.fieldErrors ?? {};
  const publicUsername = state.ok ? state.username : values.profilePublic ? values.username : null;
  const isPublic = state.ok ? state.profilePublic : values.profilePublic;

  const text = (name: keyof ProfileValues, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      id={name}
      name={name}
      defaultValue={values[name] as string}
      aria-invalid={errors[name] ? true : undefined}
      aria-describedby={errors[name] ? `${name}-error` : undefined}
      className={clsx("field", errors[name] && "border-rocket")}
      {...props}
    />
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-8"
      noValidate
    >
      {state.error ? (
        <p role="alert" className="rounded-md border border-rocket/50 bg-rocket/10 px-4 py-3 text-sm">
          {state.error}
        </p>
      ) : state.ok ? (
        <p role="status" className="rounded-md border border-mint/40 bg-mint/10 px-4 py-3 text-sm">
          Opgeslagen.{" "}
          {isPublic && publicUsername ? (
            <Link href={`/nerds/${publicUsername}`} className="link-underline">
              Bekijk je profiel
            </Link>
          ) : (
            "Je profiel is privé."
          )}
        </p>
      ) : null}

      <fieldset className="panel grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <legend className="kicker px-1">Wie ben je</legend>
        <Field name="name" label="Naam" error={errors.name}>
          {text("name", { required: true, autoComplete: "name" })}
        </Field>
        <Field
          name="username"
          label="Gebruikersnaam"
          hint={`Voor je profiel-url, bijvoorbeeld /nerds/${suggestedUsername || "jouw-naam"}.`}
          error={errors.username}
        >
          {text("username", { placeholder: suggestedUsername, autoCapitalize: "none", spellCheck: false })}
        </Field>
        <Field name="jobTitle" label="Functie" error={errors.jobTitle}>
          {text("jobTitle", { autoComplete: "organization-title" })}
        </Field>
        <Field name="company" label="Bedrijf" error={errors.company}>
          {text("company", { autoComplete: "organization" })}
        </Field>
        <Field name="bio" label="Over jou" hint="Kort. Waar ben je mee bezig, waar mogen mensen je over aanspreken?" error={errors.bio} className="sm:col-span-2">
          <textarea
            id="bio"
            name="bio"
            rows={5}
            maxLength={1500}
            defaultValue={values.bio}
            className={clsx("field", errors.bio && "border-rocket")}
          />
        </Field>
        <Field
          name="interests"
          label="Interesses"
          hint="Komma-gescheiden, maximaal 12. Bijvoorbeeld: Intune, Zero Trust, PowerShell"
          error={errors.interests}
          className="sm:col-span-2"
        >
          {text("interests")}
        </Field>
        <div className="flex flex-wrap gap-6 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isMvp" defaultChecked={values.isMvp} className="h-4 w-4 accent-rocket" />
            Microsoft MVP
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isMct" defaultChecked={values.isMct} className="h-4 w-4 accent-rocket" />
            Microsoft Certified Trainer
          </label>
        </div>
      </fieldset>

      <fieldset className="panel grid gap-5 p-5 sm:grid-cols-3 sm:p-6">
        <legend className="kicker px-1">Links</legend>
        <Field name="websiteUrl" label="Website" error={errors.websiteUrl}>
          {text("websiteUrl", { type: "url", inputMode: "url", placeholder: "https://" })}
        </Field>
        <Field name="linkedinUrl" label="LinkedIn" error={errors.linkedinUrl}>
          {text("linkedinUrl", { type: "url", inputMode: "url", placeholder: "https://www.linkedin.com/in/..." })}
        </Field>
        <Field name="githubUrl" label="GitHub" error={errors.githubUrl}>
          {text("githubUrl", { type: "url", inputMode: "url", placeholder: "https://github.com/..." })}
        </Field>
      </fieldset>

      <fieldset className="panel p-5 sm:p-6">
        <legend className="kicker px-1">Zichtbaarheid</legend>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="profilePublic"
            defaultChecked={values.profilePublic}
            className="mt-1 h-4 w-4 accent-rocket"
          />
          <span>
            <span className="font-medium">Toon mijn profiel op /nerds</span>
            <span className="mt-1 block text-sm text-paper-muted">
              Dan zijn je naam, functie, bedrijf, bio, links, interesses en de meetups waar je was
              publiek zichtbaar. Je e-mailadres nooit. Uitzetten kan altijd, dan is je profiel meteen weg.
            </span>
          </span>
        </label>
      </fieldset>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Bezig..." : "Opslaan"}
      </button>
    </form>
  );
}
