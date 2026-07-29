"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { useProfile } from "@/components/profile-provider";
import { Badge } from "@/components/kit";

// Gate around Premium-only surfaces. Reads `isPro` from the ProfileProvider
// (backed by `profiles.is_pro`, migration 0014). While the profile is still
// loading we render nothing so the upsell never flashes before we know the
// user's tier. There's no billing wired yet — Pro is toggled by hand in
// Supabase — so the upsell's CTA is an honest "coming soon".

export interface ProGateProps {
  /** Name of the locked feature, e.g. "The term archive". */
  feature: string;
  /** One-line pitch for what unlocking gets the user. */
  blurb: string;
  /** Optional bullet perks. */
  perks?: string[];
  /** Rendered only when the user IS Pro. */
  children?: React.ReactNode;
  /** When locked, render nothing instead of the upsell (for inline gating). */
  hideWhenLocked?: boolean;
}

export function ProGate({ feature, blurb, perks, children, hideWhenLocked }: ProGateProps) {
  const { isPro, loading } = useProfile();
  if (loading) return null;
  if (isPro) return <>{children}</>;
  if (hideWhenLocked) return null;
  return <ProUpsell feature={feature} blurb={blurb} perks={perks} />;
}

// The upsell panel on its own — also usable directly where you want to show the
// pitch regardless of tier.
export function ProUpsell({ feature, blurb, perks }: { feature: string; blurb: string; perks?: string[] }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, var(--ochre-light), var(--bg-card) 65%)",
        border: "1px solid var(--border)",
        borderRadius: "var(--s-radius-sm, 12px)",
        padding: "2.25rem 1.5rem",
        textAlign: "center",
        maxWidth: 460,
        margin: "1rem auto",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "var(--ochre)",
          color: "#fff",
          marginBottom: "0.9rem",
        }}
      >
        <Sparkles size={24} />
      </span>
      <div style={{ marginBottom: "0.6rem" }}>
        <Badge tone="ochre" solid>PRO</Badge>
      </div>
      <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary, var(--text))", margin: "0 0 0.4rem" }}>
        {feature} is a Pro feature
      </h3>
      <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", margin: "0 auto", maxWidth: 360 }}>{blurb}</p>

      {perks && perks.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "1.1rem auto 0", maxWidth: 320, textAlign: "left", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {perks.map((p) => (
            <li key={p} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.85rem", color: "var(--text-primary, var(--text))" }}>
              <Sparkles size={15} style={{ flexShrink: 0, marginTop: 2, color: "var(--ochre)" }} />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}

      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "1.4rem", fontStyle: "italic" }}>
        Pro plans are coming soon.
      </p>
    </div>
  );
}
