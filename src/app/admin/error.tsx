"use client";

import { Container } from "@/components/container";
import { TerminalBadge } from "./_components/terminal-badge";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="pt-12">
      <TerminalBadge tone="danger">segfault</TerminalBadge>
      <h1 className="mt-4 font-display text-2xl font-bold">Deze pagina laadde niet.</h1>
      <p className="mt-2 text-paper-muted">Er is niets gewijzigd. Probeer het opnieuw.</p>
      <button type="button" onClick={reset} className="btn-ghost mt-6">
        Opnieuw
      </button>
    </Container>
  );
}
