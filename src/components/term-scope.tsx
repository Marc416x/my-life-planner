"use client";

import { Archive, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/kit";
import type { TermCount } from "@/lib/term";

// Read-only banner shown at the top of a logging page when the app is scoped to
// an archived past term (set globally in Settings → Viewing term).
export function ArchiveBanner({ term }: { term: string | null }) {
  if (!term) return null;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap",
        padding: "0.6rem 0.85rem", marginBottom: "1.25rem",
        background: "var(--ochre-light)", border: "1px solid var(--border)",
        borderRadius: "var(--s-radius-sm, 10px)", fontSize: "0.8rem", color: "var(--text-primary, var(--text))",
      }}
    >
      <Archive size={15} style={{ flexShrink: 0, color: "var(--ochre)" }} />
      <span>Viewing <strong>{term}</strong> — a read-only archive.</span>
      <Link href="/settings" style={{ marginLeft: "auto", color: "var(--terracotta)", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
        Switch term in Settings →
      </Link>
    </div>
  );
}

// Term picker for the logging pages (Study, Error Log, Clinicals). Shows the
// current term plus any archived (past) terms. Renders nothing when there are no
// past terms, so pages that have never advanced a year look exactly as before.
// Past terms carry a lock for non-Pro users; the page shows the upsell when one
// is selected. See src/lib/term.ts + migration 0015.
export interface TermScopeProps {
  /** The user's current term label (profiles.year), e.g. "Year 2". */
  currentTerm: string | null;
  /** Archived terms (already excludes current + SEED). */
  archived: TermCount[];
  /** Selected scope: null = current term, else the archived term. */
  scope: string | null;
  onScope: (term: string | null) => void;
  isPro: boolean;
}

export function TermScope({ currentTerm, archived, scope, onScope, isPro }: TermScopeProps) {
  if (archived.length === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "var(--text-muted)" }}>
        <Archive size={13} /> Term
      </span>
      <Button size="sm" variant={scope === null ? "primary" : "ghost"} onClick={() => onScope(null)}>
        {currentTerm || "Current"}
      </Button>
      {archived.map((a) => (
        <Button
          key={a.term}
          size="sm"
          variant={scope === a.term ? "primary" : "ghost"}
          onClick={() => onScope(a.term)}
          title={isPro ? `${a.cnt} logged` : "Viewing past terms is a Pro feature"}
        >
          {!isPro && <Lock size={12} />} {a.term}
        </Button>
      ))}
    </div>
  );
}
