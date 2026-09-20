"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "email" | "code";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Dat lukte niet.");
        return;
      }
      setMessage(data.message ?? "Kijk in je mail.");
      setStep("code");
    } catch {
      setError("De server is niet bereikbaar.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, next }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Die code werkt niet.");
        return;
      }
      router.push(data.redirect ?? "/");
      router.refresh();
    } catch {
      setError("De server is niet bereikbaar.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "field";
  const buttonClass = "btn-primary w-full disabled:opacity-50";

  return (
    <div className="space-y-3">
      {step === "email" ? (
        <form onSubmit={requestCode} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="email">
            E-mailadres
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(changeEvent) => setEmail(changeEvent.target.value)}
            className={inputClass}
            placeholder="jij@voorbeeld.nl"
          />
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? "Versturen..." : "Stuur me een code"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="code">
            Inlogcode
          </label>
          <input
            id="code"
            name="code"
            required
            inputMode="text"
            autoComplete="one-time-code"
            value={code}
            onChange={(changeEvent) => setCode(changeEvent.target.value.toUpperCase())}
            className={`${inputClass} font-mono tracking-widest`}
            placeholder="XXXXXXXX"
          />
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? "Controleren..." : "Inloggen"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="btn-ghost w-full"
          >
            Ander adres gebruiken
          </button>
        </form>
      )}

      {message ? <p className="text-sm text-paper-muted">{message}</p> : null}
      {error ? <p role="alert" className="text-sm text-rocket-300">{error}</p> : null}
    </div>
  );
}
