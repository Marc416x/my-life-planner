"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, ClipboardList, Flame, Menu } from "lucide-react";

// Phone-only tab bar. Four page shortcuts + a Menu button that opens the full
// sidebar drawer (the old top-left hamburger moved here). Styles: `.mobnav*` in
// kit.css. Hidden ≥768px via that CSS.
const ITEMS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Tasks", href: "/assignments", icon: ClipboardList },
  { label: "Streaks", href: "/streaks", icon: Flame },
];

export function MobileBottomNav({ onMenu, onNavigate }: { onMenu: () => void; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className="mobnav" aria-label="Primary">
      {ITEMS.map(({ label, href, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={"mobnav-item" + (active ? " active" : "")}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={20} />
            <span className="mobnav-label">{label}</span>
          </Link>
        );
      })}
      <button type="button" className="mobnav-item" onClick={onMenu} aria-label="Open menu">
        <Menu size={20} />
        <span className="mobnav-label">Menu</span>
      </button>
    </nav>
  );
}
