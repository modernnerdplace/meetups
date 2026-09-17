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
        setError(data.error ?? "That did not work.");
        return;
      }
      setMessage(data.message ?? "Check your inbox.");
      setStep("code");
    } catch {
      setError("Could not reach the server.");
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
        setError(data.error ?? "That code did not work.");
        return;
      }
      router.push(data.redirect ?? "/");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none";
  const buttonClass =
    "w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

  return (
    <div className="space-y-3">
      {step === "email" ? (
        <form onSubmit={requestCode} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="email">
            Email address
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
            placeholder="you@example.com"
          />
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? "Sending..." : "Send me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="code">
            Login code
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
            {busy ? "Checking..." : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            Use another address
          </button>
        </form>
      )}

      {message ? <p className="text-sm text-gray-600">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
