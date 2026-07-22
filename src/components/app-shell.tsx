"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, Leaf, Sprout } from "lucide-react";
import { navSections } from "@/lib/nav";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/profile-provider";

// Faithful reproduction of the original prototype's sidebar + layout, using the
// original CSS classes. Adds a proper mobile drawer (the part that was buggy)
// via the original `.sidebar.open` mechanism + an overlay.
export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { name, initials } = useProfile();
  const close = () => setOpen(false);

  // Auth routes render without the app chrome (sidebar/topbar).
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const proBadge = (
    <span
      style={{
        fontSize: "0.6rem",
        background: "var(--ochre-light)",
        color: "#7A5A10",
        padding: "1px 5px",
        borderRadius: "3px",
        marginLeft: "auto",
        fontWeight: 600,
      }}
    >
      PRO
    </span>
  );

  return (
    <div className="app-layout">
      {/* Mobile hamburger — hidden on desktop */}
      <button
        type="button"
        className="md:hidden inline-flex items-center justify-center"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        style={{
          position: "fixed",
          top: "0.75rem",
          left: "0.75rem",
          zIndex: 97,
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-strong)",
          color: "var(--text-primary)",
          boxShadow: "var(--shadow)",
        }}
      >
        <Menu size={22} />
      </button>

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

        <Link href="/settings" onClick={close} className="user-card" style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }} title="Edit Profile">
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
              <Sprout size={11} /> Beginner
            </div>
          </div>
        </Link>

        <div className="streak-mini">
          <div className="streak-mini-label">Study Streak</div>
          <div className="streak-mini-val" id="sidebar-streak">
            0
          </div>
          <div className="streak-mini-sub">days consecutive</div>
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
    </div>
  );
}
