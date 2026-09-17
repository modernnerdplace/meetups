"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Container, Kicker } from "@/components/container";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-24 sm:py-32">
      <Kicker>Er ging iets mis</Kicker>
      <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        Deze pagina laadde niet.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-paper-muted">
        Waarschijnlijk ligt het aan ons. Probeer het nog een keer, of ga terug naar de agenda.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Opnieuw proberen
        </button>
        <Link href="/" className="btn-ghost">
          Naar home
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-8 font-mono text-xs text-paper-faint">Foutcode {error.digest}</p>
      ) : null}
    </Container>
  );
}
