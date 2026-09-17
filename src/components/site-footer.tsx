import Link from "next/link";

import { site } from "@/app/(public)/_lib/site";
import { Container } from "@/components/container";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-ink-800/80 py-10 text-sm text-paper-muted">
      <Container className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm space-y-2">
          <p className="font-display font-bold text-paper">{site.name}</p>
          <p>
            Een meetup in {site.city} voor iedereen die met IT werkt. Kom langs, praat mee, of geef
            zelf een keer een praatje.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:text-right">
          <Link href="/events" className="hover:text-paper">
            Agenda
          </Link>
          <Link href="/archive" className="hover:text-paper">
            Archief
          </Link>
          <a href={site.discordUrl} className="hover:text-paper" rel="noopener noreferrer">
            Discord
          </a>
          {site.email ? (
            <a href={`mailto:${site.email}`} className="hover:text-paper">
              {site.email}
            </a>
          ) : null}
        </div>
      </Container>
    </footer>
  );
}
