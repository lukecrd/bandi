"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

const links = [
  ["/", "Dashboard"],
  ["/clienti", "Clienti"],
  ["/bandi", "Bandi"],
  ["/fonti", "Fonti & Sync"],
  ["/impostazioni", "Impostazioni"],
];

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="sidebar">
      <div className="brand">Bandi<span>Match</span></div>
      <nav className="nav">
        {links.map(([href, label]) => (
          <Link
            href={href}
            key={href}
            className={isActive(href) ? "active" : undefined}
            aria-current={isActive(href) ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
        <LogoutButton />
      </nav>
    </aside>
  );
}
