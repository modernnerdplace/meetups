import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/container";

const nav = [
  { href: "/events", label: "Agenda" },
  { href: "/archive", label: "Archief" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-ink-800/80">
      <Container className="flex h-20 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Modern Nerdplace, naar home">
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

        <nav className="flex items-center gap-1 sm:gap-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 font-display text-sm font-bold uppercase tracking-wider text-paper-muted transition-colors hover:text-paper"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </Container>
    </header>
  );
}
