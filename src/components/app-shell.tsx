"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X, LogOut, Leaf, Flame, Trophy, Pencil } from "lucide-react";
import { navSections } from "@/lib/nav";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/profile-provider";
import { Badge } from "@/components/kit";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { QuickEditProfile } from "@/components/quick-edit-profile";

// Faithful reproduction of the original prototype's sidebar + layout, using the
// original CSS classes. On mobile the sidebar is a drawer opened from the
// bottom nav's Menu button; the pencil on the user card opens a quick-edit sheet.
export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { name, initials, streak, best, level } = useProfile();
  const TierIcon = level.tier.icon;
  const close = () => setOpen(false);

  // Auth + first-run setup render without the app chrome (sidebar/topbar).
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding")
  ) {
    return <>{children}</>;
  }

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const proBadge = (
    <Badge tone="ochre" style={{ marginLeft: "auto" }}>
      PRO
    </Badge>
  );

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      <div
        className={"sidebar-overlay md:hidden" + (open ? " active" : "")}
        onClick={close}
        aria-hidden
      />

      {/* Sidebar */}
      <aside className={"sidebar" + (open ? " open" : "")} id="main-sidebar">
        <div
          className="sidebar-logo"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <div>
            <h2 style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <Leaf size={20} />
              MyLifePlanner
            </h2>
            <p>Nursing Academic OS</p>
          </div>
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center"
            onClick={close}
            aria-label="Close menu"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <button
          type="button"
          className="user-card"
          onClick={() => { close(); setEditOpen(true); }}
          title="Edit profile"
          style={{
            width: "100%",
            background: "none",
            border: "none",
            borderBottom: "1px solid var(--border)",
            font: "inherit",
            textAlign: "left",
            cursor: "pointer",
            color: "inherit",
          }}
        >
          <div className="user-avatar" id="sidebar-avatar">
            {initials || "?"}
          </div>
          <div className="user-info">
            <div className="user-name" id="sidebar-name">
              {name || "Student"}
            </div>
            <div
              className="level-badge"
              style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}
            >
              <TierIcon size={11} /> {level.tier.name}
            </div>
          </div>
          <span
            aria-hidden
            style={{ marginLeft: "auto", color: "var(--text-muted)", display: "inline-flex", flexShrink: 0 }}
          >
            <Pencil size={14} />
          </span>
        </button>

        <div className={"streak-mini" + (streak === 0 ? " streak-mini--cold" : "")}>
          <span className="streak-mini__flame">
            <Flame size={18} />
          </span>
          <div className="streak-mini__body">
            <span className="streak-mini__val" id="sidebar-streak">{streak}</span>
            <span className="streak-mini__label">day streak</span>
          </div>
          {best > 0 && (
            <span className="streak-mini__best" title={`Best streak: ${best} day${best === 1 ? "" : "s"}`}>
              <Trophy size={11} /> {best}
            </span>
          )}
        </div>

        <nav>
          {navSections.map((section) => (
            <div className="nav-section" key={section.label}>
              <div className="nav-label">{section.label}</div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={close}
                    className={"nav-item" + (active ? " active" : "")}
                  >
                    <span className="nav-icon inline-flex items-center justify-center">
                      <Icon size={16} />
                    </span>
                    {item.label}
                    {item.pro && proBadge}
                  </Link>
                );
              })}
            </div>
          ))}

          <div className="nav-section">
            <div className="nav-label">Session</div>
            <button type="button" className="nav-item" onClick={logout} style={{ width: "100%", textAlign: "left", background: "none", border: "none", font: "inherit", cursor: "pointer" }}>
              <span className="nav-icon inline-flex items-center justify-center">
                <LogOut size={16} />
              </span>
              Switch Account / Log Out
            </button>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="main-content">{children}</main>

      {/* Mobile bottom tab bar (phone only) — Menu opens the sidebar drawer */}
      <MobileBottomNav onMenu={() => setOpen(true)} onNavigate={close} />

      {/* Quick-edit profile popup (opened from the user card pencil) */}
      <QuickEditProfile open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
