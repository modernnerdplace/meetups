import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/container";
import { getCurrentMember } from "@/lib/auth";

const nav = [
  { href: "/events", label: "Agenda" },
  { href: "/archive", label: "Archief" },
  { href: "/nerds", label: "Nerds" },
];

export async function SiteHeader() {
  const member = await getCurrentMember();
  const account = (
    <Link
      href={member ? "/account" : "/login"}
      className="shrink-0 rounded-md border border-ink-600 px-3 py-2 font-display text-sm font-bold uppercase tracking-wider text-paper transition-colors hover:border-trace hover:text-trace-300"
    >
      {member ? member.name.split(" ")[0] : "Inloggen"}
    </Link>
  );

  return (
    <header className="border-b border-ink-800/80">
      {/* Mobiel: logo en account boven, menu eronder. Vanaf sm alles op een regel. */}
      <Container className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 sm:h-20 sm:flex-nowrap sm:py-0">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Modern Nerdplace, naar home">
          <Image
            src="/logo.png"
            alt=""
            width={64}
            height={70}
            priority
            className="h-11 w-auto sm:h-12"
          />
          <span className="font-display text-base font-bold tracking-tight sm:text-lg">
            Modern Nerdplace
          </span>
        </Link>

        <div className="sm:hidden">{account}</div>

        <nav aria-label="Hoofdmenu" className="-mx-3 flex w-full items-center gap-1 sm:mx-0 sm:w-auto sm:gap-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 font-display text-sm font-bold uppercase tracking-wider text-paper-muted transition-colors hover:text-paper"
            >
              {item.label}
            </Link>
          ))}
          <div className="ml-1 hidden sm:block">{account}</div>
        </nav>
      </Container>
    </header>
  );
}
