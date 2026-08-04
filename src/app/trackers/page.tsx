"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Plus, Minus, Check, X, Pencil, Trash2, ChevronUp, ChevronDown,
  Settings2, RotateCcw, LineChart, Target, CalendarDays,
  Moon, Droplets, Smile, Dumbbell, Stethoscope, Heart, Brain, BookOpen,
  Coffee, Pill, Bed, Footprints, Scale, Apple, Sun, type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { useProfile } from "@/components/profile-provider";
import { useCollapsibleForm } from "@/lib/use-collapsible-form";
import { toISODate } from "@/lib/streak";
import { groupByDay, periodLabel, periodRange, type Granularity } from "@/lib/group-by-date";
import { applyTermScope } from "@/lib/term";
import { DetailSheet, DetailRow } from "@/components/detail-sheet";
import { ArchiveBanner } from "@/components/term-scope";
import { ProUpsell } from "@/components/pro-gate";
import { PageHeader, Card, StatCard, Field, Input, Select, Button, EmptyState, DateGroupHeader, PeriodRow, Progress } from "@/components/kit";

// ------------------------------------------------------------------
// Trackers — a GENERIC engine (see migration 0016). Every tracker carries a
// `kind`, and the quick-log widget specialises itself by kind, so Sleep, Water,
// Mood, a Yes/No habit and a custom weight tracker all share one code path.
// One entry per (tracker, day): the entry's `value` IS that day's number.
// ------------------------------------------------------------------

type Kind = "count" | "duration" | "scale" | "yesno" | "number";
type Tone = "terracotta" | "olive" | "ochre" | "forest";

type Tracker = {
  id: string;
  name: string;
  kind: Kind;
  unit: string | null;
  target: number | null;
  tone: Tone;
  icon: string;
  sort_order: number;
  active: boolean;
};

type Entry = { id: string; tracker_id: string; entry_date: string; value: number };
type Period = { period_start: string; cnt: number; day_cnt: number };

// Curated icon set the picker offers; entries store the string name.
const ICONS: Record<string, LucideIcon> = {
  Activity, Moon, Droplets, Smile, Dumbbell, Stethoscope, Heart, Brain,
  BookOpen, Coffee, Pill, Bed, Footprints, Scale, Apple, Sun, Target,
};
const ICON_NAMES = Object.keys(ICONS);
const iconOf = (name: string): LucideIcon => ICONS[name] ?? Activity;

const TONES: Tone[] = ["terracotta", "olive", "ochre", "forest"];

const KINDS: { v: Kind; label: string; hint: string }[] = [
  { v: "count", label: "Count", hint: "glasses, reps — tap ±" },
  { v: "duration", label: "Duration", hint: "hours or minutes" },
  { v: "scale", label: "Scale 1–5", hint: "mood, energy" },
  { v: "yesno", label: "Yes / No", hint: "did it or not" },
  { v: "number", label: "Number", hint: "weight, steps" },
];
const kindLabel = (k: Kind) => KINDS.find((x) => x.v === k)?.label ?? k;

// The five one-tap presets seeded on a user's first visit (see AGENTS discussion).
const PRESETS: { name: string; kind: Kind; unit: string; target: number | null; tone: Tone; icon: string }[] = [
  { name: "Sleep", kind: "duration", unit: "h", target: 8, tone: "forest", icon: "Moon" },
  { name: "Water", kind: "count", unit: "glasses", target: 8, tone: "olive", icon: "Droplets" },
  { name: "Mood", kind: "scale", unit: "", target: null, tone: "ochre", icon: "Smile" },
  { name: "Exercise", kind: "duration", unit: "min", target: 30, tone: "terracotta", icon: "Dumbbell" },
  { name: "Clinical hours", kind: "duration", unit: "h", target: null, tone: "forest", icon: "Stethoscope" },
];

const GRANS: { v: Granularity; label: string }[] = [
  { v: "day", label: "Day" },
  { v: "week", label: "Week" },
  { v: "month", label: "Month" },
];

const PAGE = 20;

const round = (n: number) => Math.round(n * 100) / 100;
const trimNum = (n: number) => (Number.isInteger(n) ? String(n) : String(round(n)));
const hasNumericUnit = (k: Kind) => k === "count" || k === "duration" || k === "number";

// The step a ± tap nudges a value by, chosen from the unit.
function stepFor(t: Tracker): number {
  if (t.kind === "count") return 1;
  if (t.unit === "min") return 5;
  if (t.unit === "h") return 0.5;
  return 1;
}

// A day's value, formatted for its kind.
function fmtValue(t: Tracker, v: number): string {
  switch (t.kind) {
    case "scale": return `${trimNum(v)}/5`;
    case "yesno": return v >= 1 ? "Yes" : "No";
    case "duration": return t.unit === "min" ? `${trimNum(v)} min` : `${trimNum(v)}h`;
    default: return `${trimNum(v)}${t.unit ? ` ${t.unit}` : ""}`;
  }
}

// Whether a day's value meets the tracker's daily goal.
const metTarget = (t: Tracker, v: number | null | undefined) =>
  t.target != null && (v ?? 0) >= t.target;

export default function TrackersPage() {
  const supabase = createClient();
  const toast = useToast();
  const { isPro, viewTerm } = useProfile();

  const [userId, setUserId] = useState<string | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [today, setToday] = useState<Record<string, Entry>>({});
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Group-by (Day | Week | Month), same roll-up pattern as Study.
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [openPeriods, setOpenPeriods] = useState<Set<string>>(new Set());
  const [periodItems, setPeriodItems] = useState<Record<string, Entry[]>>({});

  // Detail sheet (per-tracker trend).
  const [detail, setDetail] = useState<Tracker | null>(null);
  // Trend data is stamped with its tracker id so the render can tell "still
  // loading the newly-opened tracker" from "showing the previous one".
  const [detailData, setDetailData] = useState<{ id: string; rows: Entry[] } | null>(null);

  // Manage panel + add/edit form.
  const { open: manageOpen, formRef, openForm: openManage, closeForm: closeManage, scrollFormIntoView } = useCollapsibleForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fName, setFName] = useState("");
  const [fKind, setFKind] = useState<Kind>("count");
  const [fUnit, setFUnit] = useState("");
  const [fTarget, setFTarget] = useState("");
  const [fTone, setFTone] = useState<Tone>("terracotta");
  const [fIcon, setFIcon] = useState("Activity");
  const [formError, setFormError] = useState("");

  const pendingTracker = useRef<Map<string, { tracker: Tracker; entries: Entry[]; timeout: number }>>(new Map());
  const todayISO = toISODate(new Date());
  const readOnly = viewTerm !== null;
  const locked = readOnly && !isPro;

  const byId = useMemo(() => new Map(trackers.map((t) => [t.id, t])), [trackers]);
  const active = useMemo(
    () => trackers.filter((t) => t.active).sort((a, b) => a.sort_order - b.sort_order),
    [trackers],
  );
  const archived = useMemo(() => trackers.filter((t) => !t.active), [trackers]);

  // ---- Initial load ----
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase.from("profiles").select("year").eq("id", user.id).single();
      const yr = (profile?.year as string) ?? null;
      setTerm(yr);

      // Definitions persist across terms, so they're never term-scoped. Load all
      // (incl. archived) so history entries from archived trackers still resolve.
      const { data: trackerRows } = await supabase
        .from("trackers")
        .select("id, name, kind, unit, target, tone, icon, sort_order, active")
        .order("sort_order", { ascending: true });
      let ts = (trackerRows as Tracker[]) ?? [];

      // First visit (current-term view): seed the presets so the page isn't empty.
      //
      // Seeded via upsert, NOT insert: React Strict Mode double-invokes this
      // effect in dev, and a plain insert let both runs pass the `length === 0`
      // check before either landed — seeding every preset twice (migration 0021
      // cleans that up and adds the unique index this relies on). `onConflict`
      // makes a second run a no-op, so we re-read rather than trusting what this
      // particular call happened to insert.
      if (ts.length === 0 && viewTerm === null) {
        const seed = PRESETS.map((p, i) => ({
          user_id: user.id, name: p.name, kind: p.kind, unit: p.unit || null,
          target: p.target, tone: p.tone, icon: p.icon, sort_order: i,
        }));
        await supabase
          .from("trackers")
          .upsert(seed, { onConflict: "user_id,name", ignoreDuplicates: true });
        const { data: seeded } = await supabase
          .from("trackers")
          .select("id, name, kind, unit, target, tone, icon, sort_order, active")
          .order("sort_order", { ascending: true });
        ts = (seeded as Tracker[]) ?? [];
      }
      setTrackers(ts);

      // Today's values (current term only — the archive view has no "today").
      if (viewTerm === null) {
        const { data: todayRows } = await applyTermScope(
          supabase.from("tracker_entries").select("id, tracker_id, entry_date, value").eq("entry_date", todayISO),
          null, yr,
        );
        const map: Record<string, Entry> = {};
        ((todayRows as Entry[]) ?? []).forEach((r) => { map[r.tracker_id] = r; });
        setToday(map);
      }

      // History window, scoped to whichever term we're viewing.
      const { data: histRows, count } = await applyTermScope(
        supabase
          .from("tracker_entries")
          .select("id, tracker_id, entry_date, value", { count: "exact" })
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(0, PAGE - 1),
        viewTerm, yr,
      );
      setEntries((histRows as Entry[]) ?? []);
      setTotal(count ?? 0);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Detail trend: latest ~30 logged days for the opened tracker ----
  useEffect(() => {
    if (!detail) return;
    const id = detail.id;
    (async () => {
      const { data } = await applyTermScope(
        supabase
          .from("tracker_entries")
          .select("id, tracker_id, entry_date, value")
          .eq("tracker_id", id)
          .order("entry_date", { ascending: false })
          .limit(30),
        viewTerm, term,
      );
      // Ascending for the chart (oldest → newest, left → right).
      setDetailData({ id, rows: [...((data as Entry[]) ?? [])].reverse() });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id]);

  // ---- Logging ----
  async function setValue(t: Tracker, value: number) {
    if (!userId) return;
    const v = Math.max(0, round(value));
    const prev = today[t.id];
    // Optimistic write.
    setToday((m) => ({ ...m, [t.id]: { id: prev?.id ?? `tmp-${t.id}`, tracker_id: t.id, entry_date: todayISO, value: v } }));
    const { data, error } = await supabase
      .from("tracker_entries")
      .upsert({ user_id: userId, tracker_id: t.id, entry_date: todayISO, value: v, term }, { onConflict: "tracker_id,entry_date" })
      .select("id, tracker_id, entry_date, value")
      .single();
    if (error || !data) {
      setToday((m) => { const n = { ...m }; if (prev) n[t.id] = prev; else delete n[t.id]; return n; });
      toast.show("Couldn't save — please try again.");
      return;
    }
    const row = data as Entry;
    setToday((m) => ({ ...m, [t.id]: row }));
    // Reflect today's value at the top of the history list.
    setEntries((xs) => [row, ...xs.filter((e) => !(e.tracker_id === t.id && e.entry_date === todayISO))]);
    if (!prev) setTotal((n) => n + 1);
  }

  async function clearToday(t: Tracker) {
    const prev = today[t.id];
    if (!prev) return;
    setToday((m) => { const n = { ...m }; delete n[t.id]; return n; });
    setEntries((xs) => xs.filter((e) => !(e.tracker_id === t.id && e.entry_date === todayISO)));
    setTotal((n) => Math.max(0, n - 1));
    await supabase.from("tracker_entries").delete().eq("tracker_id", t.id).eq("entry_date", todayISO);
  }

  function commitInput(t: Tracker, raw: string) {
    if (raw.trim() === "") { clearToday(t); return; }
    const n = Number(raw);
    if (!Number.isNaN(n)) setValue(t, n);
  }

  // ---- History pagination & roll-ups ----
  async function loadMore() {
    const next = page + 1;
    setLoadingMore(true);
    const from = next * PAGE;
    const { data } = await applyTermScope(
      supabase
        .from("tracker_entries")
        .select("id, tracker_id, entry_date, value")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1),
      viewTerm, term,
    );
    setEntries((xs) => [...xs, ...((data as Entry[]) ?? [])]);
    setPage(next);
    setLoadingMore(false);
  }

  async function loadPeriods(g: "week" | "month") {
    setPeriodsLoading(true);
    const { data } = await supabase.rpc("tracker_entry_periods", { p_gran: g, p_scope: viewTerm });
    setPeriods((data as Period[]) ?? []);
    setPeriodsLoading(false);
  }

  function changeGranularity(g: Granularity) {
    if (g === granularity) return;
    setGranularity(g);
    setOpenPeriods(new Set());
    setPeriodItems({});
    if (g !== "day") loadPeriods(g);
  }

  async function togglePeriod(key: string) {
    setOpenPeriods((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
    if (!periodItems[key] && granularity !== "day") {
      const { start, end } = periodRange(key, granularity);
      const { data } = await applyTermScope(
        supabase
          .from("tracker_entries")
          .select("id, tracker_id, entry_date, value")
          .gte("entry_date", start).lte("entry_date", end)
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false }),
        viewTerm, term,
      );
      setPeriodItems((prev) => ({ ...prev, [key]: (data as Entry[]) ?? [] }));
    }
  }

  // ---- Manage: add / edit / reorder / archive / delete ----
  function resetForm() {
    setEditingId(null);
    setFormError("");
    setFName("");
    setFKind("count");
    setFUnit("");
    setFTarget("");
    setFTone("terracotta");
    setFIcon("Activity");
  }

  function openManagePanel() { resetForm(); openManage(); }

  async function addTracker(def: { name: string; kind: Kind; unit: string; target: number | null; tone: Tone; icon: string }) {
    if (!userId) return null;
    const sort_order = trackers.reduce((m, t) => Math.max(m, t.sort_order), -1) + 1;
    const { data, error } = await supabase
      .from("trackers")
      .insert({ user_id: userId, name: def.name.trim(), kind: def.kind, unit: def.unit.trim() || null, target: def.target, tone: def.tone, icon: def.icon, sort_order, active: true })
      .select("id, name, kind, unit, target, tone, icon, sort_order, active")
      .single();
    if (error || !data) { setFormError("Couldn't add — please try again."); return null; }
    setTrackers((xs) => [...xs, data as Tracker]);
    return data as Tracker;
  }

  async function saveForm() {
    if (!fName.trim()) { setFormError("Give your tracker a name."); return; }
    const showsNum = hasNumericUnit(fKind);
    const target = showsNum && fTarget.trim() !== "" ? Number(fTarget) : null;
    if (target != null && !(target > 0)) { setFormError("Target must be a positive number."); return; }
    setFormError("");
    const def = { name: fName, kind: fKind, unit: showsNum ? fUnit : "", target, tone: fTone, icon: fIcon };

    if (editingId) {
      const { data, error } = await supabase
        .from("trackers")
        .update({ name: def.name.trim(), kind: def.kind, unit: def.unit.trim() || null, target: def.target, tone: def.tone, icon: def.icon })
        .eq("id", editingId)
        .select("id, name, kind, unit, target, tone, icon, sort_order, active")
        .single();
      if (error || !data) { setFormError("Couldn't save — please try again."); return; }
      setTrackers((xs) => xs.map((x) => (x.id === editingId ? (data as Tracker) : x)));
      resetForm();
      return;
    }
    if (await addTracker(def)) { resetForm(); scrollFormIntoView(); }
  }

  function openEditTracker(t: Tracker) {
    setEditingId(t.id);
    setFormError("");
    setFName(t.name);
    setFKind(t.kind);
    setFUnit(t.unit ?? "");
    setFTarget(t.target != null ? String(t.target) : "");
    setFTone(t.tone);
    setFIcon(t.icon);
    setDetail(null);
    if (!manageOpen) openManage();
    else scrollFormIntoView();
  }

  async function move(t: Tracker, dir: -1 | 1) {
    const i = active.findIndex((x) => x.id === t.id);
    const j = i + dir;
    if (j < 0 || j >= active.length) return;
    const a = active[i], b = active[j];
    setTrackers((xs) => xs.map((x) => (x.id === a.id ? { ...x, sort_order: b.sort_order } : x.id === b.id ? { ...x, sort_order: a.sort_order } : x)));
    await supabase.from("trackers").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("trackers").update({ sort_order: a.sort_order }).eq("id", b.id);
  }

  async function setActive(t: Tracker, isActive: boolean) {
    setTrackers((xs) => xs.map((x) => (x.id === t.id ? { ...x, active: isActive } : x)));
    if (!isActive) setToday((m) => { const n = { ...m }; delete n[t.id]; return n; });
    await supabase.from("trackers").update({ active: isActive }).eq("id", t.id);
  }

  function requestDeleteTracker(t: Tracker) {
    const removed = entries.filter((e) => e.tracker_id === t.id);
    setTrackers((xs) => xs.filter((x) => x.id !== t.id));
    setEntries((xs) => xs.filter((e) => e.tracker_id !== t.id));
    const timeout = window.setTimeout(async () => {
      pendingTracker.current.delete(t.id);
      await supabase.from("trackers").delete().eq("id", t.id);
    }, 5000);
    pendingTracker.current.set(t.id, { tracker: t, entries: removed, timeout });
    toast.show(`"${t.name}" deleted`, {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = pendingTracker.current.get(t.id);
        if (!p) return;
        clearTimeout(p.timeout);
        pendingTracker.current.delete(t.id);
        setTrackers((xs) => [...xs, p.tracker]);
        setEntries((xs) => [...p.entries, ...xs].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1)));
      },
    });
  }

  // ---- Today-snapshot stats ----
  const loggedToday = active.filter((t) => today[t.id] != null).length;
  const withTarget = active.filter((t) => t.target != null);
  const targetsMet = withTarget.filter((t) => metTarget(t, today[t.id]?.value)).length;

  // ---- Quick-log widget, specialised by kind ----
  function control(t: Tracker) {
    const cur = today[t.id];
    const v = cur?.value ?? null;

    if (t.kind === "scale") {
      return (
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => (v === n ? clearToday(t) : setValue(t, n))}
              aria-label={`${n} of 5`}
              style={{
                width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.82rem",
                border: "1px solid var(--border)",
                background: v === n ? `var(--${t.tone})` : "var(--bg-card)",
                color: v === n ? "#fff" : "var(--text-muted)",
              }}
            >
              {n}
            </button>
          ))}
        </div>
      );
    }

    if (t.kind === "yesno") {
      const done = (v ?? 0) >= 1;
      return (
        <Button size="sm" variant={done ? "primary" : "outline"} onClick={() => (done ? clearToday(t) : setValue(t, 1))}>
          {done ? <><Check size={14} /> Done</> : "Mark done"}
        </Button>
      );
    }

    // count | duration | number → a ± stepper with a directly-editable value.
    const step = stepFor(t);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Button size="sm" variant="outline" iconOnly aria-label="Decrease" onClick={() => setValue(t, Math.max(0, round((v ?? 0) - step)))}><Minus size={14} /></Button>
        <input
          key={v ?? "empty"}
          type="number"
          defaultValue={v ?? ""}
          step={step}
          min={0}
          onBlur={(e) => commitInput(t, e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          className="k-input"
          style={{ width: 72, textAlign: "center", padding: "0.35rem 0.4rem" }}
          aria-label={`${t.name} value`}
        />
        {t.kind !== "count" && t.unit && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{t.unit}</span>}
        <Button size="sm" variant="outline" iconOnly aria-label="Increase" onClick={() => setValue(t, round((v ?? 0) + step))}><Plus size={14} /></Button>
      </div>
    );
  }

  function TrackerTile(t: Tracker) {
    const cur = today[t.id];
    const Icon = iconOf(t.icon);
    const met = metTarget(t, cur?.value);
    return (
      <div key={t.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--s-radius-sm)", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
          <button
            onClick={() => setDetail(t)}
            title="View trend"
            style={{ display: "flex", alignItems: "center", gap: "0.55rem", background: "none", border: "none", padding: 0, cursor: "pointer", minWidth: 0, textAlign: "left" }}
          >
            <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `var(--${t.tone}-light)`, color: `var(--${t.tone})` }}>
              <Icon size={18} />
            </span>
            <span style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
          </button>
          {cur && (
            <button onClick={() => clearToday(t)} aria-label={`Clear today's ${t.name}`} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2, flexShrink: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.85rem", fontWeight: 700, lineHeight: 1, color: cur ? `var(--${t.tone})` : "var(--text-muted)" }}>
            {cur ? fmtValue(t, cur.value) : "—"}
          </span>
          {t.target != null && <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>goal {trimNum(t.target)}{t.kind === "duration" && t.unit === "h" ? "h" : ""}{met ? " ✓" : ""}</span>}
        </div>

        {control(t)}

        {t.target != null && <Progress tone={t.tone} value={((cur?.value ?? 0) / t.target) * 100} />}
      </div>
    );
  }

  // ---- History rendering ----
  function renderEntryCard(e: Entry) {
    const t = byId.get(e.tracker_id);
    if (!t) return null;
    const Icon = iconOf(t.icon);
    return (
      <button
        key={e.id}
        onClick={() => setDetail(t)}
        aria-label={`${t.name} — view trend`}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--s-radius-sm)", padding: "0.7rem 0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.6rem", textAlign: "left", width: "100%" }}
      >
        <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `var(--${t.tone}-light)`, color: `var(--${t.tone})` }}>
          <Icon size={15} />
        </span>
        <span style={{ fontWeight: 600, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{t.name}</span>
        <span style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.15rem", fontWeight: 700, color: `var(--${t.tone})`, flexShrink: 0 }}>{fmtValue(t, e.value)}</span>
      </button>
    );
  }

  function renderDayGroups(list: Entry[]) {
    return groupByDay(list, (e) => e.entry_date).map((group) => (
      <div key={group.key} style={{ marginBottom: "1.25rem" }}>
        <DateGroupHeader label={group.label} summary={`${group.items.length} ${group.items.length === 1 ? "log" : "logs"}`} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {group.items.map(renderEntryCard)}
        </div>
      </div>
    ));
  }

  // ---- Detail trend chart (single series → the tracker's own tone) ----
  function renderTrend(t: Tracker, rows: Entry[]) {
    if (rows.length < 2) {
      return <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic", padding: "0.5rem 0" }}>Log a couple more days to see a trend.</div>;
    }
    const vals = rows.map((r) => r.value);
    const max = Math.max(t.target ?? 0, ...vals, 1);
    return (
      <div>
        <div style={{ position: "relative", height: 130, display: "flex", alignItems: "flex-end", gap: 2, padding: "0 1px" }}>
          {t.target != null && (
            <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: `${(t.target / max) * 100}%`, borderTop: "1.5px dashed var(--text-muted)", opacity: 0.55 }}>
              <span style={{ position: "absolute", right: 0, top: -15, fontSize: "0.6rem", color: "var(--text-muted)" }}>goal {trimNum(t.target)}</span>
            </div>
          )}
          {rows.map((r) => (
            <div
              key={r.id}
              title={`${r.entry_date}: ${fmtValue(t, r.value)}`}
              style={{ flex: 1, minWidth: 3, height: `${Math.max(2, (r.value / max) * 100)}%`, background: `var(--${t.tone})`, borderRadius: "3px 3px 0 0" }}
            />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: "0.62rem", color: "var(--text-muted)" }}>
          <span>{rows[0].entry_date.slice(5)}</span>
          <span>{rows[rows.length - 1].entry_date.slice(5)}</span>
        </div>
      </div>
    );
  }

  const groupByControl = (
    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Group by</span>
      {GRANS.map((g) => (
        <Button key={g.v} size="sm" variant={granularity === g.v ? "primary" : "ghost"} onClick={() => changeGranularity(g.v)}>{g.label}</Button>
      ))}
    </div>
  );

  const manageBtn = (
    <Button variant="outline" onClick={() => (manageOpen ? closeManage() : openManagePanel())}>
      <Settings2 size={16} /> Manage trackers
    </Button>
  );

  // Presets the user hasn't got yet — offered as one-tap chips in Manage.
  const missingPresets = PRESETS.filter((p) => !trackers.some((t) => t.name.toLowerCase() === p.name.toLowerCase()));

  // null while the opened tracker's trend is still loading (or none open).
  const detailRows = detail && detailData?.id === detail.id ? detailData.rows : null;

  return (
    <div className="page active">
      <PageHeader
        icon={<LineChart size={22} />}
        title="Trackers"
        subtitle="Log sleep, water, mood and more — one tap a day builds the picture."
        actions={!readOnly ? <span className="k-desktop-only">{manageBtn}</span> : undefined}
      />

      {readOnly && <ArchiveBanner term={viewTerm} />}

      {/* TODAY SNAPSHOT + QUICK LOG — current term only */}
      {!readOnly && (
        <>
          <div className="k-stats-grid" style={{ marginBottom: "1.5rem" }}>
            <StatCard tone="terracotta" label="Tracked today" value={`${loggedToday}/${active.length}`} sub="trackers logged" icon={<Activity size={18} />} />
            <StatCard tone="forest" label="Goals met" value={withTarget.length ? `${targetsMet}/${withTarget.length}` : "—"} sub="daily targets hit" icon={<Target size={18} />} />
            <StatCard tone="olive" label="Active trackers" value={active.length} sub="wellbeing habits" icon={<CalendarDays size={18} />} />
          </div>

          {loading ? (
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
          ) : active.length === 0 ? (
            <Card>
              <EmptyState
                icon={<LineChart size={26} />}
                title="No active trackers"
                description="Add a tracker or turn a preset back on to start logging your day."
                action={<Button onClick={openManagePanel}><Plus size={16} /> Add a tracker</Button>}
              />
            </Card>
          ) : (
            <Card title="Today" icon={<Activity size={20} />} subtitle={todayISO} style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "0.85rem" }}>
                {active.map(TrackerTile)}
              </div>
            </Card>
          )}
        </>
      )}

      {/* HISTORY */}
      {locked ? (
        <ProUpsell
          feature="The term archive"
          blurb={`Revisit ${viewTerm} as read-only history — your past trackers stay with you as you advance.`}
          perks={["Browse every past term", "Read-only, never lost", "Week & month roll-ups per term"]}
        />
      ) : loading ? null : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", margin: "0.5rem 0 1rem", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary, var(--text))", margin: 0 }}>History</h2>
            {total > 0 && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{total} total</span>}
          </div>

          {total === 0 ? (
            <Card>
              <EmptyState
                icon={<CalendarDays size={26} />}
                title={readOnly ? "Nothing logged this term" : "No history yet"}
                description={readOnly ? "There are no tracker entries recorded for this term." : "Your logged days will appear here, grouped by day, week or month."}
              />
            </Card>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                {groupByControl}
              </div>

              {granularity === "day" ? (
                <>
                  {renderDayGroups(entries)}
                  {entries.length < total && (
                    <div style={{ display: "flex", justifyContent: "center", marginTop: "1.25rem" }}>
                      <Button variant="outline" onClick={loadMore} loading={loadingMore}>Load more</Button>
                    </div>
                  )}
                </>
              ) : periodsLoading ? (
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
              ) : periods.length === 0 ? (
                <Card><EmptyState icon={<CalendarDays size={26} />} title="Nothing to roll up" description="Log some days to see them grouped here." /></Card>
              ) : (
                periods.map((p) => (
                  <PeriodRow
                    key={p.period_start}
                    label={periodLabel(p.period_start, granularity as "week" | "month")}
                    summary={`${p.cnt} ${p.cnt === 1 ? "log" : "logs"} · ${p.day_cnt} ${p.day_cnt === 1 ? "day" : "days"}`}
                    open={openPeriods.has(p.period_start)}
                    onToggle={() => togglePeriod(p.period_start)}
                  >
                    {periodItems[p.period_start]
                      ? renderDayGroups(periodItems[p.period_start])
                      : <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic", padding: "0.5rem" }}>Loading…</div>}
                  </PeriodRow>
                ))
              )}
            </>
          )}
        </>
      )}

      {/* Mobile: Manage action below the list. */}
      {!readOnly && !manageOpen && (
        <div className="k-mobile-only k-mobile-add">{manageBtn}</div>
      )}

      {/* MANAGE PANEL */}
      {manageOpen && !readOnly && (
        <div ref={formRef} style={{ scrollMarginTop: "1rem", marginTop: "1.5rem" }}>
          <Card title="Manage trackers" icon={<Settings2 size={20} />}>
            {/* Quick-add missing presets */}
            {missingPresets.length > 0 && !editingId && (
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Quick add</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {missingPresets.map((p) => {
                    const Icon = iconOf(p.icon);
                    return (
                      <Button key={p.name} size="sm" variant="ghost" onClick={() => addTracker({ ...p })}>
                        <Icon size={14} /> {p.name}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add / edit form */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "0.75rem" }}>
              <Field label="Name" htmlFor="tr-name"><Input id="tr-name" value={fName} onChange={(e) => { setFName(e.target.value); if (formError) setFormError(""); }} placeholder="e.g., Meditation" /></Field>
              <Field label="Type" htmlFor="tr-kind">
                <Select id="tr-kind" value={fKind} onChange={(e) => setFKind(e.target.value as Kind)}>
                  {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label} — {k.hint}</option>)}
                </Select>
              </Field>
              {hasNumericUnit(fKind) && (
                <>
                  <Field label="Unit" htmlFor="tr-unit"><Input id="tr-unit" value={fUnit} onChange={(e) => setFUnit(e.target.value)} placeholder={fKind === "duration" ? "h or min" : "glasses, kg…"} /></Field>
                  <Field label="Daily goal (optional)" htmlFor="tr-target"><Input id="tr-target" type="number" min="0" value={fTarget} onChange={(e) => setFTarget(e.target.value)} placeholder="8" /></Field>
                </>
              )}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", marginTop: "0.9rem" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>Colour</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {TONES.map((tone) => (
                    <button
                      key={tone}
                      onClick={() => setFTone(tone)}
                      aria-label={tone}
                      style={{ width: 28, height: 28, borderRadius: "50%", cursor: "pointer", background: `var(--${tone})`, border: fTone === tone ? "2px solid var(--text-primary, var(--text))" : "2px solid transparent", outline: "1px solid var(--border)" }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>Icon</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxWidth: 340 }}>
                  {ICON_NAMES.map((name) => {
                    const Icon = iconOf(name);
                    const on = fIcon === name;
                    return (
                      <button
                        key={name}
                        onClick={() => setFIcon(name)}
                        aria-label={name}
                        style={{ width: 30, height: 30, borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", background: on ? `var(--${fTone}-light)` : "var(--bg-card)", color: on ? `var(--${fTone})` : "var(--text-muted)", border: `1px solid ${on ? `var(--${fTone})` : "var(--border)"}` }}
                      >
                        <Icon size={15} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "1.1rem" }}>
              <Button onClick={(e) => { e.currentTarget.blur(); saveForm(); }}>{editingId ? "Save changes" : "Add tracker"}</Button>
              {editingId
                ? <Button variant="outline" onClick={resetForm}>Cancel edit</Button>
                : <Button variant="outline" onClick={() => { closeManage(); resetForm(); }}>Done</Button>}
              {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
            </div>

            {/* Existing trackers */}
            {active.length > 0 && (
              <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1.1rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.6rem" }}>Your trackers</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {active.map((t, i) => {
                    const Icon = iconOf(t.icon);
                    const meta = [kindLabel(t.kind), t.unit || null, t.target != null ? `goal ${trimNum(t.target)}` : null].filter(Boolean).join(" · ");
                    return (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.5rem 0.6rem", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--s-radius-sm)" }}>
                        <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `var(--${t.tone}-light)`, color: `var(--${t.tone})` }}><Icon size={15} /></span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{meta}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                          <Button size="sm" variant="ghost" iconOnly aria-label="Move up" disabled={i === 0} onClick={() => move(t, -1)}><ChevronUp size={15} /></Button>
                          <Button size="sm" variant="ghost" iconOnly aria-label="Move down" disabled={i === active.length - 1} onClick={() => move(t, 1)}><ChevronDown size={15} /></Button>
                          <Button size="sm" variant="ghost" iconOnly aria-label={`Edit ${t.name}`} onClick={() => openEditTracker(t)}><Pencil size={14} /></Button>
                          <Button size="sm" variant="ghost" iconOnly aria-label={`Archive ${t.name}`} title="Archive (keeps history)" onClick={() => setActive(t, false)}><X size={15} /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Archived trackers */}
            {archived.length > 0 && (
              <div style={{ marginTop: "1.25rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.6rem" }}>Archived</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {archived.map((t) => {
                    const Icon = iconOf(t.icon);
                    return (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.5rem 0.6rem", background: "var(--bg-card)", border: "1px dashed var(--border)", borderRadius: "var(--s-radius-sm)", opacity: 0.85 }}>
                        <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--bg-elevated, var(--ochre-light))", color: "var(--text-muted)" }}><Icon size={15} /></span>
                        <div style={{ minWidth: 0, flex: 1, fontWeight: 600, fontSize: "0.85rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                          <Button size="sm" variant="ghost" onClick={() => setActive(t, true)}><RotateCcw size={13} /> Restore</Button>
                          <Button size="sm" variant="ghost" iconOnly aria-label={`Delete ${t.name}`} title="Delete permanently" onClick={() => requestDeleteTracker(t)}><Trash2 size={14} /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* DETAIL SHEET — per-tracker trend */}
      <DetailSheet open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }} title={detail?.name ?? ""}>
        {detail && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {detailRows === null ? (
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic" }}>Loading…</div>
            ) : (
              <>
                {renderTrend(detail, detailRows)}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                  {!readOnly && <DetailRow label="Today">{today[detail.id] ? fmtValue(detail, today[detail.id].value) : "Not logged"}</DetailRow>}
                  {detail.target != null && <DetailRow label="Daily goal">{fmtValue(detail, detail.target)}</DetailRow>}
                  {detailRows.length > 0 && <DetailRow label="Best">{fmtValue(detail, Math.max(...detailRows.map((r) => r.value)))}</DetailRow>}
                  {detailRows.length > 0 && <DetailRow label="Average">{fmtValue(detail, round(detailRows.reduce((s, r) => s + r.value, 0) / detailRows.length))}</DetailRow>}
                </div>

                {detailRows.length > 0 && (
                  <div>
                    <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 6 }}>Recent</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      {[...detailRows].reverse().slice(0, 10).map((r) => (
                        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", padding: "0.3rem 0", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ color: "var(--text-muted)" }}>{r.entry_date}</span>
                          <span style={{ fontWeight: 600 }}>{fmtValue(detail, r.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!readOnly && (
                  <div>
                    <Button size="sm" variant="outline" onClick={() => openEditTracker(detail)}><Pencil size={13} /> Edit tracker</Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </DetailSheet>
    </div>
  );
}
