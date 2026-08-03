"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ClipboardCheck, Gauge, Percent, CalendarClock, Plus, Pencil, Trash2,
  TrendingUp, ShieldCheck, HeartPulse, Brain, Bed, Pill, Activity,
  Stethoscope, ClipboardList, BookOpen, Sparkles, ListChecks, type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { useProfile } from "@/components/profile-provider";
import { useCollapsibleForm } from "@/lib/use-collapsible-form";
import { toISODate } from "@/lib/streak";
import { groupByDay, groupByPeriod, periodLabel, type Granularity } from "@/lib/group-by-date";
import { DetailSheet, DetailRow } from "@/components/detail-sheet";
import { ProGate } from "@/components/pro-gate";
import {
  PageHeader, Card, StatCard, Field, Input, Select, Textarea, Button,
  EmptyState, Badge, Progress, DateGroupHeader, PeriodRow,
} from "@/components/kit";

// ------------------------------------------------------------------
// NCLEX Tracker (Premium — see migration 0018). Log practice-question blocks,
// each attributed to one of the eight NCLEX-RN "Client Needs" categories, and
// the page turns them into a readiness picture:
//   • per-category accuracy + readiness tier (the perk "per-category scoring");
//   • question-bank volume vs an optional goal ("question-bank progress");
//   • a heuristic predicted-pass estimate ("predicted pass probability").
//
// TERM-AGNOSTIC (like Long Term Vision): NCLEX readiness is a CUMULATIVE journey
// toward one licensure exam, so every question ever practised keeps counting —
// it ignores the archived-term picker and never stamps `term`. The full history
// is small and personal, so we hold it client-side and aggregate in memory.
// ------------------------------------------------------------------

type Tone = "terracotta" | "olive" | "ochre" | "forest";

type CatKey =
  | "management_of_care" | "safety_infection" | "health_promotion" | "psychosocial"
  | "basic_care" | "pharmacology" | "risk_reduction" | "physiological";

type Session = {
  id: string;
  session_date: string;
  category: CatKey;
  source: string | null;
  total: number;
  correct: number;
  note: string | null;
  created_at: string;
};

const COLS = "id, session_date, category, source, total, correct, note, created_at";

// The eight NCLEX-RN Client-Needs categories — the readiness dimensions. `short`
// keeps tiles tidy; tones cycle the four brand colours.
type CatDef = { key: CatKey; label: string; short: string; tone: Tone; icon: LucideIcon };
const CATEGORIES: CatDef[] = [
  { key: "management_of_care", label: "Management of Care", short: "Mgmt of Care", tone: "terracotta", icon: ClipboardList },
  { key: "safety_infection", label: "Safety & Infection Control", short: "Safety & Infection", tone: "olive", icon: ShieldCheck },
  { key: "health_promotion", label: "Health Promotion & Maintenance", short: "Health Promotion", tone: "forest", icon: HeartPulse },
  { key: "psychosocial", label: "Psychosocial Integrity", short: "Psychosocial", tone: "ochre", icon: Brain },
  { key: "basic_care", label: "Basic Care & Comfort", short: "Basic Care", tone: "olive", icon: Bed },
  { key: "pharmacology", label: "Pharmacological & Parenteral Therapies", short: "Pharmacology", tone: "terracotta", icon: Pill },
  { key: "risk_reduction", label: "Reduction of Risk Potential", short: "Risk Reduction", tone: "forest", icon: Activity },
  { key: "physiological", label: "Physiological Adaptation", short: "Physiological", tone: "ochre", icon: Stethoscope },
];
const CAT = new Map(CATEGORIES.map((c) => [c.key, c]));

// Common question banks offered as datalist hints (source stays free text).
const SOURCES = ["UWorld", "Kaplan", "ATI", "Archer", "Saunders", "NCLEX Mastery", "SimpleNursing", "Hurst", "Bootcamp"];

const GRANS: { v: Granularity; label: string }[] = [
  { v: "day", label: "Day" },
  { v: "week", label: "Week" },
  { v: "month", label: "Month" },
];

// ---- Readiness tuning ----
const MIN_DATA = 10;        // questions before a category earns a tier
const CAT_TARGET = 75;      // per-category coverage goal (for the coverage hint)
const READY_MIN = 20;       // breadth: min questions for a category to "count"
const READY_ACC = 0.65;     // breadth: accuracy a category needs to be "ready"
const VOLUME_TARGET = 1200; // questions that read as fully-prepared volume
const PERF_LO = 0.5;        // accuracy that maps to 0 readiness…
const PERF_HI = 0.82;       // …and the accuracy that maps to full readiness

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const pct = (acc: number) => Math.round(acc * 100);
const parseISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

// Accuracy → readiness tier. Grey "No data" until a category has enough volume.
function tierOf(attempted: number, acc: number): { label: string; tone: Tone | "neutral" } {
  if (attempted < MIN_DATA) return { label: "No data", tone: "neutral" };
  if (acc < 0.6) return { label: "Weak", tone: "terracotta" };
  if (acc < 0.7) return { label: "Developing", tone: "ochre" };
  if (acc < 0.8) return { label: "Proficient", tone: "olive" };
  return { label: "Strong", tone: "forest" };
}

// Predicted-pass band → its label + tone (drives the gauge colour).
function bandOf(p: number): { label: string; tone: Tone } {
  if (p < 40) return { label: "Building foundation", tone: "terracotta" };
  if (p < 60) return { label: "Getting there", tone: "ochre" };
  if (p < 75) return { label: "On track", tone: "olive" };
  return { label: p < 88 ? "Strong" : "Exam ready", tone: "forest" };
}

// Semicircular readiness gauge. `value` is 0–100, or null when there isn't
// enough data yet (renders an em dash).
function ReadinessGauge({ value, tone }: { value: number | null; tone: Tone }) {
  const R = 80, CX = 90, CY = 90, SW = 14;
  const len = Math.PI * R; // semicircle arc length
  const frac = value == null ? 0 : clamp01(value / 100);
  const path = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  return (
    <div style={{ position: "relative", width: 180, maxWidth: "100%" }}>
      <svg viewBox="0 0 180 104" width="100%" role="img" aria-label={value == null ? "Not enough data" : `Predicted pass ${value}%`}>
        <path d={path} fill="none" stroke="var(--border)" strokeWidth={SW} strokeLinecap="round" />
        {value != null && (
          <path
            d={path} fill="none" stroke={`var(--${tone})`} strokeWidth={SW} strokeLinecap="round"
            strokeDasharray={len} strokeDashoffset={len * (1 - frac)}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        )}
      </svg>
      <div style={{ position: "absolute", inset: 0, top: "30%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "2.6rem", fontWeight: 700, lineHeight: 1, color: value == null ? "var(--text-muted)" : `var(--${tone})` }}>
          {value == null ? "—" : `${value}%`}
        </span>
        <span style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>est. pass</span>
      </div>
    </div>
  );
}

// Accuracy-over-sessions bar trend for a category's detail sheet.
function CategoryTrend({ tone, accs }: { tone: Tone; accs: number[] }) {
  if (accs.length < 2) {
    return <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic", padding: "0.5rem 0" }}>Log a couple more blocks to see a trend.</div>;
  }
  return (
    <div>
      <div style={{ position: "relative", height: 110, display: "flex", alignItems: "flex-end", gap: 3 }}>
        <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: "65%", borderTop: "1.5px dashed var(--text-muted)", opacity: 0.5 }}>
          <span style={{ position: "absolute", right: 0, top: -14, fontSize: "0.6rem", color: "var(--text-muted)" }}>65%</span>
        </div>
        {accs.map((a, i) => (
          <div key={i} title={`${pct(a)}%`} style={{ flex: 1, minWidth: 4, height: `${Math.max(3, a * 100)}%`, background: `var(--${tone})`, borderRadius: "3px 3px 0 0" }} />
        ))}
      </div>
      <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginTop: 6, textAlign: "center" }}>Accuracy per block, oldest → newest</div>
    </div>
  );
}

export default function NclexPage() {
  const { isPro, loading: profileLoading } = useProfile();

  const header = (
    <PageHeader
      icon={<ClipboardCheck size={22} />}
      title="NCLEX Tracker"
      subtitle="Turn practice questions into a readiness picture — per-category scoring and a predicted-pass estimate."
    />
  );

  // Gate the whole feature (and its data fetching) behind Pro. The child only
  // mounts — and only queries — when the user is Pro.
  return (
    <div className="page active">
      {(profileLoading || !isPro) && header}
      <ProGate
        feature="The NCLEX Tracker"
        blurb="Track your practice-question performance and see how ready you are across every NCLEX category."
        perks={["Per-category readiness scoring", "Question-bank progress", "Predicted pass estimate"]}
      >
        <NclexTracker />
      </ProGate>
    </div>
  );
}

function NclexTracker() {
  const supabase = createClient();
  const toast = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);

  // Exam plan (autosaved profile columns).
  const [examDate, setExamDate] = useState("");
  const [goal, setGoal] = useState("");
  const savedPlan = useRef({ examDate: "", goal: "" });

  // Detail sheets.
  const [catDetail, setCatDetail] = useState<CatKey | null>(null);
  const [sessionDetail, setSessionDetail] = useState<Session | null>(null);

  // History grouping.
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [openPeriod, setOpenPeriod] = useState<string | null>(null);

  // Collapsible log form (add + edit).
  const { open: formOpen, formRef, openForm, closeForm, scrollFormIntoView } = useCollapsibleForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fDate, setFDate] = useState(toISODate(new Date()));
  const [fCat, setFCat] = useState<CatKey>("pharmacology");
  const [fSource, setFSource] = useState("");
  const [fTotal, setFTotal] = useState("");
  const [fCorrect, setFCorrect] = useState("");
  const [fNote, setFNote] = useState("");
  const [formError, setFormError] = useState("");

  const pendingDelete = useRef<Map<string, { session: Session; timeout: number }>>(new Map());

  // ---- Initial load ----
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles").select("nclex_exam_date, nclex_question_goal").eq("id", user.id).single();
      const ed = (profile?.nclex_exam_date as string) ?? "";
      const gl = profile?.nclex_question_goal != null ? String(profile.nclex_question_goal) : "";
      setExamDate(ed);
      setGoal(gl);
      savedPlan.current = { examDate: ed, goal: gl };

      const { data: rows } = await supabase
        .from("nclex_sessions").select(COLS)
        .order("session_date", { ascending: false })
        .order("created_at", { ascending: false });
      setSessions((rows as Session[]) ?? []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Aggregates (the whole readiness picture) ----
  const stats = useMemo(() => {
    const per = new Map<CatKey, { attempted: number; correct: number; accs: number[] }>();
    for (const c of CATEGORIES) per.set(c.key, { attempted: 0, correct: 0, accs: [] });
    let attempted = 0, correct = 0;
    // sessions are newest-first; push accuracy oldest-first for the trend.
    for (let i = sessions.length - 1; i >= 0; i--) {
      const s = sessions[i];
      const p = per.get(s.category);
      if (!p) continue;
      p.attempted += s.total;
      p.correct += s.correct;
      p.accs.push(s.total ? s.correct / s.total : 0);
      attempted += s.total;
      correct += s.correct;
    }
    const overallAcc = attempted ? correct / attempted : 0;

    // Predicted-pass heuristic: how good you are (perf), scaled by how prepared
    // you are (volume + breadth). Conservative — needs real coverage to climb.
    const pPerf = clamp01((overallAcc - PERF_LO) / (PERF_HI - PERF_LO));
    const pVolume = clamp01(attempted / VOLUME_TARGET);
    const readyCats = CATEGORIES.filter((c) => {
      const p = per.get(c.key)!;
      return p.attempted >= READY_MIN && p.correct / p.attempted >= READY_ACC;
    }).length;
    const pBreadth = readyCats / CATEGORIES.length;
    const prob = attempted < READY_MIN
      ? null
      : Math.max(1, Math.min(99, Math.round(100 * pPerf * (0.55 + 0.25 * pVolume + 0.2 * pBreadth))));

    return { per, attempted, correct, overallAcc, prob, readyCats };
  }, [sessions]);

  // Focus areas (weakest rated categories, then untouched ones) and strengths.
  const insights = useMemo(() => {
    const rated = CATEGORIES.map((c) => ({ c, p: stats.per.get(c.key)! }))
      .filter((x) => x.p.attempted >= MIN_DATA)
      .map((x) => ({ c: x.c, acc: x.p.correct / x.p.attempted }));
    const weak = [...rated].sort((a, b) => a.acc - b.acc).filter((x) => x.acc < 0.75).slice(0, 3);
    const strong = [...rated].sort((a, b) => b.acc - a.acc).filter((x) => x.acc >= 0.75).slice(0, 3);
    const untouched = CATEGORIES.filter((c) => stats.per.get(c.key)!.attempted < MIN_DATA);
    return { weak, strong, untouched };
  }, [stats]);

  const band = stats.prob != null ? bandOf(stats.prob) : null;
  const goalNum = goal.trim() !== "" ? Number(goal) : null;
  const daysToExam = examDate ? Math.round((parseISO(examDate).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000) : null;

  // ---- Exam plan autosave ----
  async function saveExamDate(v: string) {
    if (!userId || v === savedPlan.current.examDate) return;
    savedPlan.current.examDate = v;
    const { error } = await supabase.from("profiles").update({ nclex_exam_date: v || null }).eq("id", userId);
    if (error) toast.show("Couldn't save your exam date — please try again.");
  }
  async function saveGoal() {
    if (!userId || goal === savedPlan.current.goal) return;
    const n = goal.trim() === "" ? null : Number(goal);
    if (n != null && (!Number.isInteger(n) || n <= 0)) { toast.show("Enter a whole number of questions."); return; }
    savedPlan.current.goal = goal;
    const { error } = await supabase.from("profiles").update({ nclex_question_goal: n }).eq("id", userId);
    if (error) toast.show("Couldn't save your goal — please try again.");
  }

  // ---- Log form ----
  function resetForm() {
    setEditingId(null);
    setFormError("");
    setFDate(toISODate(new Date()));
    setFSource("");
    setFTotal("");
    setFCorrect("");
    setFNote("");
  }
  function openAdd(cat?: CatKey) {
    resetForm();
    if (cat) setFCat(cat);
    setCatDetail(null);
    setSessionDetail(null);
    if (!formOpen) openForm();
    else scrollFormIntoView();
  }
  function openEdit(s: Session) {
    setEditingId(s.id);
    setFormError("");
    setFDate(s.session_date);
    setFCat(s.category);
    setFSource(s.source ?? "");
    setFTotal(String(s.total));
    setFCorrect(String(s.correct));
    setFNote(s.note ?? "");
    setCatDetail(null);
    setSessionDetail(null);
    if (!formOpen) openForm();
    else scrollFormIntoView();
  }

  const fTotalNum = Number(fTotal);
  const fCorrectNum = Number(fCorrect);
  const previewValid = fTotal.trim() !== "" && fCorrect.trim() !== "" && Number.isFinite(fTotalNum) && Number.isFinite(fCorrectNum) && fTotalNum > 0 && fCorrectNum >= 0 && fCorrectNum <= fTotalNum;

  async function saveForm() {
    if (!userId) return;
    if (!Number.isInteger(fTotalNum) || fTotalNum <= 0) { setFormError("Enter how many questions were in the block."); return; }
    if (!Number.isInteger(fCorrectNum) || fCorrectNum < 0) { setFormError("Enter how many you got right."); return; }
    if (fCorrectNum > fTotalNum) { setFormError("Correct can't be more than the total."); return; }
    setFormError("");

    const patch = {
      session_date: fDate,
      category: fCat,
      source: fSource.trim() || null,
      total: fTotalNum,
      correct: fCorrectNum,
      note: fNote.trim() || null,
    };

    if (editingId) {
      const { data, error } = await supabase
        .from("nclex_sessions").update(patch).eq("id", editingId).select(COLS).single();
      if (error || !data) { setFormError("Couldn't save — please try again."); return; }
      setSessions((xs) => sortSessions(xs.map((x) => (x.id === editingId ? (data as Session) : x))));
      resetForm();
      closeForm();
      return;
    }

    const { data, error } = await supabase
      .from("nclex_sessions").insert({ user_id: userId, ...patch }).select(COLS).single();
    if (error || !data) { setFormError("Couldn't add — please try again."); return; }
    setSessions((xs) => sortSessions([data as Session, ...xs]));
    resetForm();
    scrollFormIntoView();
  }

  function sortSessions(xs: Session[]) {
    return [...xs].sort((a, b) =>
      a.session_date !== b.session_date
        ? (a.session_date < b.session_date ? 1 : -1)
        : (a.created_at < b.created_at ? 1 : -1));
  }

  // ---- Delete (optimistic, undoable) ----
  function requestDelete(s: Session) {
    setSessionDetail(null);
    setSessions((xs) => xs.filter((x) => x.id !== s.id));
    const timeout = window.setTimeout(async () => {
      pendingDelete.current.delete(s.id);
      await supabase.from("nclex_sessions").delete().eq("id", s.id);
    }, 5000);
    pendingDelete.current.set(s.id, { session: s, timeout });
    toast.show("Practice block deleted", {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = pendingDelete.current.get(s.id);
        if (!p) return;
        clearTimeout(p.timeout);
        pendingDelete.current.delete(s.id);
        setSessions((xs) => sortSessions([...xs, p.session]));
      },
    });
  }

  // ---- Renderers ----
  function CategoryTile({ def }: { def: CatDef }) {
    const p = stats.per.get(def.key)!;
    const acc = p.attempted ? p.correct / p.attempted : 0;
    const t = tierOf(p.attempted, acc);
    const rated = p.attempted >= MIN_DATA;
    const Icon = def.icon;
    return (
      <button
        onClick={() => setCatDetail(def.key)}
        style={{
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--s-radius-sm)",
          padding: "0.9rem", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: "0.6rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `var(--${def.tone}-light)`, color: `var(--${def.tone})` }}>
            <Icon size={17} />
          </span>
          <span style={{ fontWeight: 600, fontSize: "0.82rem", lineHeight: 1.2, minWidth: 0, flex: 1 }}>{def.short}</span>
          <Badge tone={t.tone}>{t.label}</Badge>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.7rem", fontWeight: 700, lineHeight: 1, color: rated ? `var(--${def.tone})` : "var(--text-muted)" }}>
            {rated ? `${pct(acc)}%` : "—"}
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{p.attempted} Qs{p.attempted > 0 && p.attempted < CAT_TARGET ? ` · ${CAT_TARGET - p.attempted} to target` : ""}</span>
        </div>
        <Progress tone={rated ? (t.tone === "neutral" ? def.tone : t.tone) : def.tone} value={rated ? pct(acc) : 0} />
      </button>
    );
  }

  function SessionCard(s: Session) {
    const def = CAT.get(s.category)!;
    const acc = s.total ? s.correct / s.total : 0;
    const t = tierOf(s.total, acc);
    const Icon = def.icon;
    return (
      <button
        key={s.id}
        onClick={() => setSessionDetail(s)}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--s-radius-sm)", padding: "0.7rem 0.85rem", cursor: "pointer", textAlign: "left", width: "100%", display: "flex", alignItems: "center", gap: "0.7rem" }}
      >
        <span style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `var(--${def.tone}-light)`, color: `var(--${def.tone})` }}>
          <Icon size={16} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{def.short}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{s.correct}/{s.total} correct{s.source ? ` · ${s.source}` : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.3rem", fontWeight: 700, color: `var(--${def.tone})` }}>{pct(acc)}%</span>
          <Badge tone={t.tone}>{t.label}</Badge>
        </div>
      </button>
    );
  }

  function renderDayGroups(list: Session[]) {
    return groupByDay(list, (s) => s.session_date).map((group) => {
      const tot = group.items.reduce((n, s) => n + s.total, 0);
      const cor = group.items.reduce((n, s) => n + s.correct, 0);
      return (
        <div key={group.key} style={{ marginBottom: "1.25rem" }}>
          <DateGroupHeader label={group.label} summary={`${tot} Qs · ${tot ? pct(cor / tot) : 0}%`} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.items.map(SessionCard)}
          </div>
        </div>
      );
    });
  }

  // ---- Question-bank breakdown ----
  const bySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) { const k = s.source?.trim() || "Unspecified"; m.set(k, (m.get(k) ?? 0) + s.total); }
    return [...m.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
  }, [sessions]);

  const hasData = sessions.length > 0;
  const goalPct = goalNum ? clamp01(stats.attempted / goalNum) * 100 : 0;

  const logBtn = <Button onClick={() => openAdd()}><Plus size={16} /> Log practice</Button>;

  return (
    <>
      <PageHeader
        icon={<ClipboardCheck size={22} />}
        title="NCLEX Tracker"
        subtitle="Turn practice questions into a readiness picture — per-category scoring and a predicted-pass estimate."
        actions={<span className="k-desktop-only">{logBtn}</span>}
      />

      {loading ? (
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
      ) : (
        <>
          {/* TOP STATS */}
          <div className="k-stats-grid" style={{ marginBottom: "1.5rem" }}>
            <StatCard tone={band?.tone ?? "terracotta"} label="Predicted pass" value={stats.prob != null ? `${stats.prob}%` : "—"} sub={band?.label ?? "Log ~20 questions"} icon={<Gauge size={18} />} />
            <StatCard tone="forest" label="Overall accuracy" value={hasData ? `${pct(stats.overallAcc)}%` : "—"} sub={`${stats.correct}/${stats.attempted} correct`} icon={<Percent size={18} />} />
            <StatCard tone="olive" label="Questions done" value={stats.attempted} sub={goalNum ? `of ${goalNum} goal` : "no goal set"} icon={<ListChecks size={18} />}>
              {goalNum ? <div style={{ marginTop: "0.6rem" }}><Progress tone="olive" value={goalPct} /></div> : null}
            </StatCard>
            <StatCard
              tone="ochre"
              label="Exam countdown"
              value={daysToExam == null ? "—" : daysToExam < 0 ? "Passed" : daysToExam === 0 ? "Today" : daysToExam}
              sub={daysToExam == null ? "set a date below" : daysToExam > 0 ? "days to go" : examDate}
              icon={<CalendarClock size={18} />}
            />
          </div>

          {/* READINESS HERO */}
          <Card title="Readiness" icon={<TrendingUp size={20} />} subtitle="A conservative estimate from your practice — not a guarantee." style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "1.5rem", alignItems: "center" }} className="k-nclex-hero">
              <div style={{ display: "flex", justifyContent: "center" }}>
                <ReadinessGauge value={stats.prob} tone={band?.tone ?? "terracotta"} />
              </div>
              <div style={{ minWidth: 0 }}>
                {stats.prob == null ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "flex-start" }}>
                    <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                      Log around 20+ practice questions and your estimated pass likelihood will appear here, updating with every block.
                    </p>
                    {logBtn}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                      <Badge tone={band!.tone} solid>{band!.label}</Badge>
                      <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{stats.readyCats}/8 categories on target · {stats.attempted} questions</span>
                    </div>

                    {insights.weak.length > 0 && (
                      <div>
                        <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: "0.4rem" }}>Focus next</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          {insights.weak.map((w) => (
                            <button key={w.c.key} onClick={() => setCatDetail(w.c.key)} style={chip("terracotta")}>{w.c.short} · {pct(w.acc)}%</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {insights.weak.length === 0 && insights.untouched.length > 0 && (
                      <div>
                        <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: "0.4rem" }}>Not practised yet</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          {insights.untouched.slice(0, 4).map((c) => (
                            <button key={c.key} onClick={() => openAdd(c.key)} style={chip("ochre")}><Plus size={12} /> {c.short}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {insights.strong.length > 0 && (
                      <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                        <Sparkles size={14} style={{ color: "var(--forest)", flexShrink: 0 }} />
                        <span>Strongest: {insights.strong.map((s) => s.c.short).join(", ")}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Exam plan (autosaved) */}
            <div style={{ marginTop: "1.25rem", paddingTop: "1.1rem", borderTop: "1px solid var(--border)", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <Field label="Exam date" htmlFor="nclex-exam" hint="Optional — powers the countdown">
                <Input id="nclex-exam" type="date" value={examDate} onChange={(e) => { setExamDate(e.target.value); saveExamDate(e.target.value); }} style={{ maxWidth: 190 }} />
              </Field>
              <Field label="Question goal" htmlFor="nclex-goal" hint="Total questions before the exam">
                <Input id="nclex-goal" type="number" inputMode="numeric" min={1} value={goal} onChange={(e) => setGoal(e.target.value)} onBlur={saveGoal} placeholder="e.g., 2000" style={{ maxWidth: 150 }} />
              </Field>
            </div>
          </Card>

          {/* CATEGORY READINESS GRID */}
          <Card title="Category readiness" icon={<ClipboardList size={20} />} subtitle="Accuracy across the eight NCLEX Client-Needs categories. Tap one for detail." style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "0.85rem" }}>
              {CATEGORIES.map((def) => <CategoryTile key={def.key} def={def} />)}
            </div>
          </Card>

          {/* QUESTION-BANK BREAKDOWN */}
          {bySource.length > 0 && stats.attempted > 0 && (
            <Card title="By question bank" icon={<BookOpen size={20} />} subtitle="Where your practice volume comes from." style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                {bySource.map((row, i) => {
                  const tone = (["terracotta", "olive", "ochre", "forest"] as Tone[])[i % 4];
                  return (
                    <div key={row.source} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ width: 130, flexShrink: 0, fontSize: "0.82rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.source}</span>
                      <div style={{ flex: 1, minWidth: 0 }}><Progress tone={tone} value={(row.count / stats.attempted) * 100} /></div>
                      <span style={{ width: 96, flexShrink: 0, textAlign: "right", fontSize: "0.78rem", color: "var(--text-muted)" }}>{row.count} Qs · {pct(row.count / stats.attempted)}%</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Mobile log button */}
          {!formOpen && <div className="k-mobile-only k-mobile-add">{logBtn}</div>}

          {/* LOG FORM */}
          {formOpen && (
            <div ref={formRef} style={{ scrollMarginTop: "1rem", marginBottom: "1.5rem" }}>
              <Card title={editingId ? "Edit practice block" : "Log practice block"} icon={<Plus size={20} />}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem" }}>
                  <Field label="Date" htmlFor="nq-date">
                    <Input id="nq-date" type="date" value={fDate} max={toISODate(new Date())} onChange={(e) => setFDate(e.target.value)} />
                  </Field>
                  <Field label="Category" htmlFor="nq-cat">
                    <Select id="nq-cat" value={fCat} onChange={(e) => setFCat(e.target.value as CatKey)}>
                      {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Question bank" htmlFor="nq-source" hint="Optional">
                    <Input id="nq-source" list="nclex-sources" value={fSource} onChange={(e) => setFSource(e.target.value)} placeholder="e.g., UWorld" />
                    <datalist id="nclex-sources">{SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
                  </Field>
                  <Field label="Questions" htmlFor="nq-total">
                    <Input id="nq-total" type="number" inputMode="numeric" min={1} value={fTotal} onChange={(e) => { setFTotal(e.target.value); if (formError) setFormError(""); }} placeholder="75" />
                  </Field>
                  <Field label="Correct" htmlFor="nq-correct">
                    <Input id="nq-correct" type="number" inputMode="numeric" min={0} value={fCorrect} onChange={(e) => { setFCorrect(e.target.value); if (formError) setFormError(""); }} placeholder="54" />
                  </Field>
                </div>

                <Field label="Note (optional)" htmlFor="nq-note">
                  <Textarea id="nq-note" value={fNote} onChange={(e) => setFNote(e.target.value)} rows={2} placeholder="Topics that tripped you up, timing, mode (tutor/timed)…" style={{ width: "100%", resize: "vertical" }} />
                </Field>

                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "1rem" }}>
                  <Button onClick={(e) => { e.currentTarget.blur(); saveForm(); }}>{editingId ? "Save changes" : "Add block"}</Button>
                  <Button variant="outline" onClick={() => { closeForm(); resetForm(); }}>Cancel</Button>
                  {previewValid && (
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      Accuracy <strong style={{ color: "var(--text-primary, var(--text))" }}>{pct(fCorrectNum / fTotalNum)}%</strong>
                    </span>
                  )}
                  {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
                </div>
              </Card>
            </div>
          )}

          {/* HISTORY */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", margin: "0.5rem 0 1rem", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary, var(--text))", margin: 0 }}>Practice history</h2>
            {hasData && (
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Group by</span>
                {GRANS.map((g) => (
                  <Button key={g.v} size="sm" variant={granularity === g.v ? "primary" : "ghost"} onClick={() => setGranularity(g.v)}>{g.label}</Button>
                ))}
              </div>
            )}
          </div>

          {!hasData ? (
            <Card>
              <EmptyState
                icon={<ClipboardCheck size={26} />}
                title="No practice logged yet"
                description="Log your first block of NCLEX-style questions to start building your readiness picture."
                action={logBtn}
              />
            </Card>
          ) : granularity === "day" ? (
            renderDayGroups(sessions)
          ) : (
            groupByPeriod(sessions, (s) => s.session_date, granularity).map((grp) => {
              const tot = grp.items.reduce((n, s) => n + s.total, 0);
              const cor = grp.items.reduce((n, s) => n + s.correct, 0);
              return (
                <PeriodRow
                  key={grp.key}
                  label={periodLabel(grp.key, granularity)}
                  summary={`${grp.items.length} ${grp.items.length === 1 ? "block" : "blocks"} · ${tot} Qs · ${tot ? pct(cor / tot) : 0}%`}
                  open={openPeriod === grp.key}
                  onToggle={() => setOpenPeriod((k) => (k === grp.key ? null : grp.key))}
                >
                  {renderDayGroups(grp.items)}
                </PeriodRow>
              );
            })
          )}
        </>
      )}

      {/* CATEGORY DETAIL SHEET */}
      <DetailSheet open={!!catDetail} onOpenChange={(o) => { if (!o) setCatDetail(null); }} title={catDetail ? CAT.get(catDetail)!.label : ""}>
        {catDetail && (() => {
          const def = CAT.get(catDetail)!;
          const p = stats.per.get(catDetail)!;
          const acc = p.attempted ? p.correct / p.attempted : 0;
          const t = tierOf(p.attempted, acc);
          const catSessions = sessions.filter((s) => s.category === catDetail);
          const Icon = def.icon;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `var(--${def.tone}-light)`, color: `var(--${def.tone})` }}><Icon size={24} /></span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>{def.label}</div>
                  <Badge tone={t.tone}>{t.label}</Badge>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.85rem" }}>
                <DetailRow label="Accuracy">{p.attempted >= MIN_DATA ? `${pct(acc)}%` : "—"}</DetailRow>
                <DetailRow label="Questions">{p.attempted}</DetailRow>
                <DetailRow label="Correct">{p.correct}</DetailRow>
              </div>

              <CategoryTrend tone={def.tone} accs={p.accs} />

              <Button size="sm" variant="outline" onClick={() => openAdd(def.key)}><Plus size={14} /> Log {def.short} block</Button>

              {catSessions.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 6 }}>Recent blocks</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {catSessions.slice(0, 8).map((s) => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", padding: "0.3rem 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ color: "var(--text-muted)" }}>{s.session_date}{s.source ? ` · ${s.source}` : ""}</span>
                        <span style={{ fontWeight: 600 }}>{s.correct}/{s.total} · {pct(s.correct / s.total)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </DetailSheet>

      {/* SESSION DETAIL SHEET */}
      <DetailSheet open={!!sessionDetail} onOpenChange={(o) => { if (!o) setSessionDetail(null); }} title={sessionDetail ? CAT.get(sessionDetail.category)!.label : ""}>
        {sessionDetail && (() => {
          const s = sessionDetail;
          const acc = s.total ? s.correct / s.total : 0;
          const t = tierOf(s.total, acc);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem" }}>
                <span style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "2.4rem", fontWeight: 700, lineHeight: 1, color: `var(--${CAT.get(s.category)!.tone})` }}>{pct(acc)}%</span>
                <Badge tone={t.tone}>{t.label}</Badge>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <DetailRow label="Date">{s.session_date}</DetailRow>
                <DetailRow label="Score">{s.correct}/{s.total}</DetailRow>
                <DetailRow label="Category">{CAT.get(s.category)!.short}</DetailRow>
                <DetailRow label="Question bank">{s.source || "—"}</DetailRow>
              </div>
              {s.note && <DetailRow label="Note">{s.note}</DetailRow>}
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <Button size="sm" variant="outline" onClick={() => openEdit(s)}><Pencil size={13} /> Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => requestDelete(s)}><Trash2 size={13} /> Delete</Button>
              </div>
            </div>
          );
        })()}
      </DetailSheet>
    </>
  );
}

// Small pill chip used for focus/uncovered categories in the readiness hero.
function chip(tone: Tone): CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer",
    padding: "0.28rem 0.6rem", borderRadius: 999, fontSize: "0.76rem", fontWeight: 600,
    background: `var(--${tone}-light)`, color: `var(--${tone})`, border: `1px solid var(--${tone})`,
  };
}
