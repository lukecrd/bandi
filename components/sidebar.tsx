"use client";

import { Building2, FileText, LayoutDashboard, RefreshCw, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

const links = [
  ["/", "Dashboard", LayoutDashboard],
  ["/clienti", "Clienti", Building2],
  ["/bandi", "Bandi", FileText],
  ["/fonti", "Fonti & Sync", RefreshCw],
  ["/impostazioni", "Impostazioni", Settings],
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="sidebar">
      <div className="brand">Bandi<span>Match</span></div>
      <nav className="nav">
        {links.map(([href, label, Icon]) => (
          <Link
            href={href}
            key={href}
            className={isActive(href) ? "active" : undefined}
            aria-current={isActive(href) ? "page" : undefined}
          >
            <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </Link>
        ))}
        <LogoutButton />
      </nav>
    </aside>
  );
}
