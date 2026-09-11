import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

const links = [
  ["/", "Dashboard"],
  ["/clienti", "Clienti"],
  ["/bandi", "Bandi"],
  ["/fonti", "Fonti & Sync"],
  ["/impostazioni", "Impostazioni"],
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">Bandi<span>Match</span></div>
      <nav className="nav">
        {links.map(([href, label]) => (
          <Link href={href} key={href}>{label}</Link>
        ))}
        <LogoutButton />
      </nav>
    </aside>
  );
}
