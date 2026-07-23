"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MODES, MODE_LABELS, applyMode, getStoredMode, type Mode } from "@/lib/theme";
import { Sun, SunMedium, Moon, User, Bell, type LucideIcon } from "lucide-react";
import { useProfile } from "@/components/profile-provider";
import {
  pushSupported,
  permissionState,
  currentEndpoint,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
} from "@/lib/push-client";

type PushState = "loading" | "unsupported" | "off" | "on" | "blocked";

type Prefs = { planner_due: boolean; due_morning: boolean; overdue: boolean };

// The three reminder kinds the cron supports, mapped to the notification_prefs
// columns. Order + copy mirror how they fire (earliest lead time first).
const REMINDER_KINDS: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: "planner_due", label: "Planner-due nudge", desc: "2 days before an assignment is due" },
  { key: "due_morning", label: "Due today", desc: "On the morning it's actually due" },
  { key: "overdue", label: "Overdue alert", desc: "If it slips past its due date unfinished" },
];

const MODE_ICONS: Record<Mode, LucideIcon> = {
  "mode-light": Sun,
  "mode-white": SunMedium,
  "mode-dark": Moon,
};

export default function SettingsPage() {
  const supabase = createClient();
  const { refresh } = useProfile();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [mode, setMode] = useState<Mode>("mode-light");

  const [push, setPush] = useState<PushState>("loading");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState("");
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [prefsBusy, setPrefsBusy] = useState(false);

  useEffect(() => {
    setMode(getStoredMode());
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      setEmail(user?.email ?? "");
      if (user) {
        const { data } = await supabase.from("profiles").select("name").eq("id", user.id).single();
        if (data?.name) setName(data.name);
        await loadPrefs(user.id);
      }
    })();
    (async () => {
      const perm = permissionState();
      if (perm === "unsupported") return setPush("unsupported");
      if (perm === "denied") return setPush("blocked");
      const endpoint = await currentEndpoint();
      setPush(endpoint ? "on" : "off");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load this user's per-kind reminder preferences (the row is created the first
  // time they subscribe). Missing row → leave prefs null until then.
  async function loadPrefs(uid: string) {
    const { data } = await supabase
      .from("notification_prefs")
      .select("planner_due, due_morning, overdue")
      .eq("user_id", uid)
      .maybeSingle();
    if (data) setPrefs(data as Prefs);
  }

  // Flip one reminder kind, optimistically, and persist. Prefs are per-user
  // (they apply to every device), so RLS scopes the write to this user.
  async function togglePref(key: keyof Prefs) {
    if (!userId || !prefs || prefsBusy) return;
    const previous = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setPrefsBusy(true);
    const { error } = await supabase
      .from("notification_prefs")
      .upsert(
        { user_id: userId, ...next, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) {
      setPrefs(previous); // revert on failure
      setPushMsg("Couldn't save that preference. Try again.");
    }
    setPrefsBusy(false);
  }

  async function enablePush() {
    setPushBusy(true);
    setPushMsg("");
    try {
      await subscribeToPush();
      setPush("on");
      if (userId) await loadPrefs(userId); // subscribe route just created the row
      setPushMsg("Notifications enabled on this device.");
    } catch (e) {
      if (permissionState() === "denied") setPush("blocked");
      setPushMsg(e instanceof Error ? e.message : "Couldn't enable notifications.");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    setPushMsg("");
    try {
      await unsubscribeFromPush();
      setPush("off");
      setPushMsg("Notifications turned off on this device.");
    } catch {
      setPushMsg("Couldn't turn off notifications.");
    } finally {
      setPushBusy(false);
    }
  }

  async function testPush() {
    setPushBusy(true);
    setPushMsg("");
    try {
      await sendTestPush();
      setPushMsg("Test sent — it should appear shortly.");
    } catch (e) {
      setPushMsg(e instanceof Error ? e.message : "Test failed.");
    } finally {
      setPushBusy(false);
    }
  }

  async function saveProfile() {
    if (!userId) return;
    await supabase.from("profiles").update({ name: name.trim() || "Student" }).eq("id", userId);
    await refresh();
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
        <h3 style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <Bell size={18} /> Notifications
        </h3>
        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "0.75rem", lineHeight: 1.5 }}>
          Get a reminder when an assignment reaches its planner-due date, on the morning it&apos;s
          actually due, and if it slips overdue. You&apos;ll need to allow notifications once per
          device.
        </div>

        {push === "loading" && (
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic" }}>Checking…</div>
        )}

        {push === "unsupported" && (
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            This browser doesn&apos;t support push notifications. On iPhone, add the app to your Home
            Screen first, then enable them from there.
          </div>
        )}

        {push === "blocked" && (
          <div style={{ fontSize: "0.82rem", color: "var(--terracotta-dark)" }}>
            Notifications are blocked for this site. Turn them back on in your browser&apos;s site
            settings, then reload this page.
          </div>
        )}

        {(push === "off" || push === "on") && (
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
            {push === "off" ? (
              <button className="btn-add" onClick={enablePush} disabled={pushBusy}>
                {pushBusy ? "Enabling…" : "Enable notifications"}
              </button>
            ) : (
              <>
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "0.35rem",
                    fontSize: "0.8rem", color: "var(--forest)", fontWeight: 500,
                  }}
                >
                  <Bell size={14} /> On for this device
                </span>
                <button className="btn-outline" onClick={testPush} disabled={pushBusy} style={{ padding: "0.4rem 0.9rem" }}>
                  Send test
                </button>
                <button className="btn-outline" onClick={disablePush} disabled={pushBusy} style={{ padding: "0.4rem 0.9rem" }}>
                  Turn off
                </button>
              </>
            )}
          </div>
        )}

        {push === "on" && prefs && (
          <div
            style={{
              marginTop: "1rem", paddingTop: "0.9rem", borderTop: "1px solid var(--border)",
              display: "flex", flexDirection: "column", gap: "0.75rem",
            }}
          >
            <div
              style={{
                fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.04em",
              }}
            >
              Which reminders
            </div>
            {REMINDER_KINDS.map(({ key, label, desc }) => (
              <div
                key={key}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}
              >
                <span>
                  <span style={{ display: "block", fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 500 }}>
                    {label}
                  </span>
                  <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)" }}>{desc}</span>
                </span>
                <Toggle on={prefs[key]} onToggle={() => togglePref(key)} disabled={prefsBusy} />
              </div>
            ))}
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              These apply to all your devices. Turn every one off to pause reminders without unsubscribing.
            </div>
          </div>
        )}

        {pushMsg && (
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.6rem" }}>{pushMsg}</div>
        )}
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

// Accessible on/off switch styled to the design tokens.
function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      disabled={disabled}
      style={{
        position: "relative", flexShrink: 0, width: 42, height: 24, padding: 0,
        borderRadius: 999, border: "none",
        cursor: disabled ? "default" : "pointer",
        background: on ? "var(--olive)" : "var(--border-strong)",
        transition: "background 0.15s ease",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: "absolute", top: 3, left: on ? 21 : 3, width: 18, height: 18,
          borderRadius: "50%", background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.25)", transition: "left 0.15s ease",
        }}
      />
    </button>
  );
}
