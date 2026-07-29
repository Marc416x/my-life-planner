import * as React from "react";
import { ChevronRight } from "lucide-react";

// Header row that sits above each day-group in a logging list (Study, Error Log,
// …). Pair it with `groupByDay` from src/lib/group-by-date. `summary` is the
// small muted roll-up on the right (e.g. "3 sessions · 2h 40m").
export interface DateGroupHeaderProps {
  label: React.ReactNode;
  summary?: React.ReactNode;
  className?: string;
}

export function DateGroupHeader({ label, summary, className }: DateGroupHeaderProps) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "0.75rem",
        padding: "0.35rem 0",
        marginBottom: "0.6rem",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary, var(--text))" }}>{label}</span>
      {summary != null && (
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{summary}</span>
      )}
    </div>
  );
}

// A collapsible period summary for the Week / Month roll-up views: a full-width
// clickable header (label + roll-up summary + chevron) that reveals `children`
// (the drilled-down items) when open. Pair with `periodLabel`/`periodRange`.
export interface PeriodRowProps {
  label: React.ReactNode;
  summary?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

export function PeriodRow({ label, summary, open, onToggle, children }: PeriodRowProps) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "0.75rem", padding: "0.7rem 0.9rem", background: "var(--bg-card)",
          border: "1px solid var(--border)", borderRadius: "var(--s-radius-sm)", cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <ChevronRight size={15} style={{ flexShrink: 0, color: "var(--text-muted)", transition: "transform 0.15s", transform: open ? "rotate(90deg)" : "none" }} />
          <span style={{ fontWeight: 600, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        </span>
        {summary != null && <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{summary}</span>}
      </button>
      {open && <div style={{ padding: "0.85rem 0 0.25rem" }}>{children}</div>}
    </div>
  );
}
