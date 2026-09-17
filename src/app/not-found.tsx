import type { Metadata } from "next";
import Link from "next/link";

import { site } from "@/app/(public)/_lib/site";
import { Container, Kicker } from "@/components/container";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Pagina niet gevonden",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Container className="py-24 sm:py-32">
          <Kicker>404</Kicker>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Deze pagina bestaat niet.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-paper-muted">
            De link klopt niet meer, of de meetup staat er nog niet op. Vanaf hier kom je verder.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="btn-primary">
              Naar home
            </Link>
            <Link href="/archive" className="btn-ghost">
              Archief
            </Link>
            <a href={site.discordUrl} className="btn-ghost" rel="noopener noreferrer">
              Discord
            </a>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
