"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MODES, MODE_LABELS, applyMode, getStoredMode, type Mode } from "@/lib/theme";
import { Sun, SunMedium, Moon, User, type LucideIcon } from "lucide-react";

const MODE_ICONS: Record<Mode, LucideIcon> = {
  "mode-light": Sun,
  "mode-white": SunMedium,
  "mode-dark": Moon,
};

export default function SettingsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [mode, setMode] = useState<Mode>("mode-light");

  useEffect(() => {
    setMode(getStoredMode());
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      setEmail(user?.email ?? "");
      if (user) {
        const { data } = await supabase.from("profiles").select("name").eq("id", user.id).single();
        if (data?.name) setName(data.name);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile() {
    if (!userId) return;
    await supabase.from("profiles").update({ name: name.trim() || "Student" }).eq("id", userId);
    setSavedMsg("Saved!");
    setTimeout(() => setSavedMsg(""), 1500);
  }

  function pickMode(m: Mode) {
    setMode(m);
    applyMode(m);
  }

  return (
    <div className="page active">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Personalise your experience</p>
      </div>

      <div className="form-section">
        <h3 style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <User size={18} /> Profile
        </h3>
        <div className="input-row">
          <div className="field-group">
            <div className="field-label">Display Name</div>
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="field-group">
            <div className="field-label">Email</div>
            <input className="field-input" value={email} disabled style={{ opacity: 0.7 }} />
          </div>
        </div>
        <button className="btn-add" onClick={saveProfile}>Save Profile</button>
        {savedMsg && <span style={{ marginLeft: "0.75rem", color: "var(--olive)", fontSize: "0.82rem" }}>{savedMsg}</span>}
      </div>

      <div className="form-section">
        <h3>Appearance</h3>
        <div className="field-label" style={{ marginBottom: "0.5rem" }}>Colour Mode</div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          {MODES.map((m) => {
            const Icon = MODE_ICONS[m];
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => pickMode(m)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  border: active ? "1.5px solid var(--terracotta)" : "1px solid var(--border-strong)",
                  background: active ? "var(--terracotta-light)" : "var(--bg-card)",
                  color: active ? "var(--terracotta-dark)" : "var(--text-secondary)",
                  fontSize: "0.85rem",
                }}
              >
                <Icon size={16} /> {MODE_LABELS[m]}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.6rem" }}>
          Saved on this device. (The 16 colour palettes come in a later pass.)
        </div>
      </div>
    </div>
  );
}
