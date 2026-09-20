import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Container } from "@/components/container";
import { getCurrentMember, isAdmin, isOrganiser } from "@/lib/auth";
import { AdminNav } from "./_components/admin-nav";
import { TerminalBadge } from "./_components/terminal-badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Beheer", template: "%s | Beheer | Modern Nerdplace" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Eerste slot op de deur. Elke server action controleert de rol daarna opnieuw.
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=/admin");

  if (!isOrganiser(member)) {
    return (
      <main className="flex min-h-screen items-center">
        <Container className="py-24">
          <TerminalBadge tone="danger">403 permission denied</TerminalBadge>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Dit deel is voor organisatoren.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-paper-muted">
            Je bent ingelogd als {member.name}, maar zonder beheerrechten. Wil je helpen
            organiseren? Zeg het op Discord.
          </p>
          <Link href="/" className="btn-ghost mt-8">
            Terug naar de site
          </Link>
        </Container>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-ink-700 bg-ink-900/90 backdrop-blur">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-3" aria-label="Beheer, naar dashboard">
            <Image src="/logo.png" alt="" width={64} height={70} className="h-9 w-auto" />
            <span className="font-display text-sm font-bold tracking-tight sm:text-base">
              Modern Nerdplace
            </span>
            <TerminalBadge className="hidden sm:inline-flex">sudo</TerminalBadge>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-paper-muted sm:inline">
              {member.name}
              <span className="ml-2 font-mono text-xs text-paper-faint">
                {isAdmin(member) ? "admin" : "organizer"}
              </span>
            </span>
            <Link href="/" className="link-underline text-paper-muted">
              Naar de site
            </Link>
          </div>
        </Container>
        <Container>
          <AdminNav />
        </Container>
      </header>
      <main className="flex-1 pb-20">{children}</main>
    </div>
  );
}
