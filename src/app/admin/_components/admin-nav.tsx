"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/members", label: "Leden" },
  { href: "/admin/audit", label: "Auditlog" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Beheer" className="-mb-px flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "whitespace-nowrap border-b-2 px-3 py-3 font-display text-xs font-bold uppercase tracking-wider transition-colors",
              active
                ? "border-rocket text-paper"
                : "border-transparent text-paper-muted hover:text-paper",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
