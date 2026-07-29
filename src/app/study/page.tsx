"use client";

import { useEffect, useRef, useState } from "react";
import {
  Timer, Play, Pause, RotateCcw, Plus, Pencil, Trash2, Clock, Target, Flame,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { useProfile } from "@/components/profile-provider";
import { useCollapsibleForm } from "@/lib/use-collapsible-form";
import { toISODate } from "@/lib/streak";
import { groupByDay, periodLabel, periodRange, type Granularity } from "@/lib/group-by-date";
import { DetailSheet, DetailRow } from "@/components/detail-sheet";
import { PageHeader, Card, StatCard, Field, Input, Select, Textarea, Button, EmptyState, DateGroupHeader, PeriodRow } from "@/components/kit";

type Period = { period_start: string; cnt: number; total_min: number };

const GRANS: { v: Granularity; label: string }[] = [
  { v: "day", label: "Day" },
  { v: "week", label: "Week" },
  { v: "month", label: "Month" },
];

type Course = { id: string; name: string };

type Session = {
  id: string;
  course_id: string | null;
  topic: string | null;
  duration_min: number;
  focus: number | null;
  notes: string | null;
  session_date: string;
  started_at: string | null;
};

// One page of the recent-sessions list. We never load a user's whole history —
// just a window, with "Load more" fetching the next slice. That's what keeps the
// page fast no matter how many years of sessions a daily user has piled up.
const PAGE = 15;

const FOCUS = [
  { v: 1, label: "1 — Distracted" },
  { v: 2, label: "2 — Meh" },
  { v: 3, label: "3 — Okay" },
  { v: 4, label: "4 — Focused" },
  { v: 5, label: "5 — Locked in" },
];

function fmtDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Live-timer readout: MM:SS, or H:MM:SS once past an hour.
function fmtClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}

// Monday of the current local week, as YYYY-MM-DD — the window for the top stats.
function weekStartISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

export default function StudyPage() {
  const supabase = createClient();
  const toast = useToast();
  const { streak, recordActivity } = useProfile();

  const [userId, setUserId] = useState<string | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detail, setDetail] = useState<Session | null>(null);

  // Group-by (Day | Week | Month). Week/Month use DB roll-ups (accurate totals),
  // expanded on demand.
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [openPeriods, setOpenPeriods] = useState<Set<string>>(new Set());
  const [periodItems, setPeriodItems] = useState<Record<string, Session[]>>({});

  // This-week aggregates. Bounded to one week of rows — never the whole history.
  const [weekRows, setWeekRows] = useState<{ duration_min: number; focus: number | null; course_id: string | null }[]>([]);

  // ---- Focus timer (counts up; you Save to log the elapsed time) ----
  const [running, setRunning] = useState(false);
  const [accumMs, setAccumMs] = useState(0);
  const startTsRef = useRef<number | null>(null);
  const [, forceTick] = useState(0);
  const [tCourse, setTCourse] = useState("");
  const [tFocus, setTFocus] = useState(3);
  const [tTopic, setTTopic] = useState("");

  // ---- Manual "log a past session" form ----
  const { open: formOpen, formRef, openForm, closeForm: collapseForm, scrollFormIntoView } = useCollapsibleForm();
  const [fCourse, setFCourse] = useState("");
  const [fDate, setFDate] = useState("");
  const [fDuration, setFDuration] = useState("");
  const [fFocus, setFFocus] = useState(3);
  const [fTopic, setFTopic] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const pending = useRef<Map<string, { item: Session; timeout: number }>>(new Map());
  const wkStart = weekStartISO();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) { setLoading(false); return; }

      const [{ data: profile }, { data: courseRows }, listRes, { data: week }] = await Promise.all([
        supabase.from("profiles").select("year").eq("id", user.id).single(),
        supabase.from("courses").select("id, name").order("created_at", { ascending: true }),
        supabase
          .from("study_sessions")
          .select("id, course_id, topic, duration_min, focus, notes, session_date, started_at", { count: "exact" })
          .order("session_date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(0, PAGE - 1),
        supabase
          .from("study_sessions")
          .select("duration_min, focus, course_id")
          .gte("session_date", wkStart),
      ]);

      setTerm((profile?.year as string) ?? null);
      const cs = (courseRows as Course[]) ?? [];
      setCourses(cs);
      if (cs.length) setTCourse(cs[0].id);
      setSessions((listRes.data as Session[]) ?? []);
      setTotal(listRes.count ?? 0);
      setWeekRows(week ?? []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render every second while the timer runs.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const courseName = (id: string | null) => (id ? courses.find((c) => c.id === id)?.name ?? "General" : "General");

  const elapsedMs = accumMs + (running && startTsRef.current != null ? Date.now() - startTsRef.current : 0);

  // ---- Weekly stat roll-ups (from the bounded week window) ----
  const weekMin = weekRows.reduce((s, r) => s + (r.duration_min || 0), 0);
  const weekCount = weekRows.length;
  const focusVals = weekRows.filter((r) => r.focus != null).map((r) => r.focus as number);
  const avgFocus = focusVals.length ? Math.round((focusVals.reduce((a, b) => a + b, 0) / focusVals.length) * 10) / 10 : null;
  const byCourse = new Map<string, number>();
  weekRows.forEach((r) => { if (r.course_id) byCourse.set(r.course_id, (byCourse.get(r.course_id) || 0) + r.duration_min); });
  let topCourseId: string | null = null;
  let topMin = 0;
  byCourse.forEach((v, k) => { if (v > topMin) { topMin = v; topCourseId = k; } });

  async function reloadWeek(uid: string) {
    const { data } = await supabase
      .from("study_sessions")
      .select("duration_min, focus, course_id")
      .eq("user_id", uid)
      .gte("session_date", wkStart);
    setWeekRows(data ?? []);
  }

  // Shared insert for both the timer and the manual form.
  async function persistSession(payload: Omit<Session, "id"> & { user_id: string; term: string | null }) {
    const { data, error } = await supabase
      .from("study_sessions")
      .insert(payload)
      .select("id, course_id, topic, duration_min, focus, notes, session_date, started_at")
      .single();
    if (error || !data) return null;
    setSessions((xs) => [data as Session, ...xs]);
    setTotal((n) => n + 1);
    if (userId) reloadWeek(userId);
    // A session dated today counts toward the streak (same system the Streaks page uses).
    if (payload.session_date === toISODate(new Date())) recordActivity();
    return data as Session;
  }

  async function saveTimer() {
    if (!userId) return;
    const now = Date.now();
    const totalMs = accumMs + (running && startTsRef.current != null ? now - startTsRef.current : 0);
    if (totalMs < 30000) { toast.show("Start the timer and study a bit before saving."); return; }
    const minutes = Math.max(1, Math.round(totalMs / 60000));
    const saved = await persistSession({
      user_id: userId,
      term,
      course_id: tCourse || null,
      topic: tTopic.trim() || null,
      duration_min: minutes,
      focus: tFocus,
      notes: null,
      session_date: toISODate(new Date()),
      started_at: new Date(now - totalMs).toISOString(),
    });
    if (!saved) { toast.show("Could not save the session — please try again."); return; }
    resetTimer();
    setTTopic("");
    toast.show(`Logged ${fmtDuration(minutes)} of study — nice work!`);
  }

  function startTimer() { startTsRef.current = Date.now(); setRunning(true); }
  function pauseTimer() {
    const now = Date.now();
    setAccumMs(accumMs + (startTsRef.current != null ? now - startTsRef.current : 0));
    startTsRef.current = null;
    setRunning(false);
  }
  function resetTimer() { setRunning(false); startTsRef.current = null; setAccumMs(0); }

  function resetManual() {
    setEditingId(null);
    setFormError("");
    setFDuration("");
    setFTopic("");
    setFNotes("");
    setFDate("");
  }

  function openEditSession(s: Session) {
    setEditingId(s.id);
    setFormError("");
    setFCourse(s.course_id ?? "");
    setFDate(s.session_date);
    setFDuration(String(s.duration_min));
    setFFocus(s.focus ?? 3);
    setFTopic(s.topic ?? "");
    setFNotes(s.notes ?? "");
    setDetail(null);
    if (!formOpen) openForm();
    else scrollFormIntoView();
  }

  async function saveManual() {
    if (!userId) return;
    const dur = fDuration === "" ? NaN : Number(fDuration);
    if (!(dur > 0)) { setFormError("Enter how many minutes you studied."); return; }
    setFormError("");
    const fields = {
      course_id: fCourse || null,
      topic: fTopic.trim() || null,
      duration_min: Math.round(dur),
      focus: fFocus,
      notes: fNotes.trim() || null,
      session_date: fDate || toISODate(new Date()),
    };

    if (editingId) {
      const { data, error } = await supabase
        .from("study_sessions")
        .update(fields)
        .eq("id", editingId)
        .select("id, course_id, topic, duration_min, focus, notes, session_date, started_at")
        .single();
      if (error || !data) { setFormError("Could not save — please try again."); return; }
      setSessions((xs) => xs.map((x) => (x.id === editingId ? (data as Session) : x)));
      if (userId) reloadWeek(userId);
      collapseForm();
      resetManual();
      return;
    }

    const saved = await persistSession({ user_id: userId, term, ...fields, started_at: null });
    if (!saved) { setFormError("Could not save — please try again."); return; }
    setFDuration("");
    setFTopic("");
    setFNotes("");
    setFDate("");
    scrollFormIntoView();
  }

  async function loadMore() {
    const next = page + 1;
    setLoadingMore(true);
    const from = next * PAGE;
    const { data } = await supabase
      .from("study_sessions")
      .select("id, course_id, topic, duration_min, focus, notes, session_date, started_at")
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    setSessions((xs) => [...xs, ...((data as Session[]) ?? [])]);
    setPage(next);
    setLoadingMore(false);
  }

  function requestDelete(s: Session) {
    setSessions((xs) => xs.filter((x) => x.id !== s.id));
    setTotal((n) => Math.max(0, n - 1));
    const timeout = window.setTimeout(async () => {
      pending.current.delete(s.id);
      await supabase.from("study_sessions").delete().eq("id", s.id);
      if (userId) reloadWeek(userId);
    }, 5000);
    pending.current.set(s.id, { item: s, timeout });
    toast.show("Session deleted", {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = pending.current.get(s.id);
        if (!p) return;
        clearTimeout(p.timeout);
        pending.current.delete(s.id);
        setSessions((xs) => [p.item, ...xs.filter((x) => x.id !== s.id)]);
        setTotal((n) => n + 1);
      },
    });
  }

  function openManual() { resetManual(); openForm(); }

  // ---- Group-by: Day / Week / Month ----
  async function loadPeriods(g: "week" | "month") {
    setPeriodsLoading(true);
    const { data } = await supabase.rpc("study_session_periods", { p_gran: g });
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

  // Expand a week/month → lazily load that period's individual sessions.
  async function togglePeriod(key: string) {
    setOpenPeriods((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
    if (!periodItems[key] && granularity !== "day") {
      const { start, end } = periodRange(key, granularity);
      const { data } = await supabase
        .from("study_sessions")
        .select("id, course_id, topic, duration_min, focus, notes, session_date, started_at")
        .gte("session_date", start).lte("session_date", end)
        .order("session_date", { ascending: false })
        .order("created_at", { ascending: false });
      setPeriodItems((prev) => ({ ...prev, [key]: (data as Session[]) ?? [] }));
    }
  }

  function renderSessionCard(s: Session) {
    return (
      <div
        key={s.id}
        onClick={() => setDetail(s)}
        role="button"
        aria-label={`${courseName(s.course_id)} study session — view details`}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--s-radius-sm)", padding: "1.1rem", cursor: "pointer", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{courseName(s.course_id)}{s.topic ? ` — ${s.topic}` : ""}</div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: 6, flexWrap: "wrap" }}>
            {s.focus != null && <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 10, background: "var(--forest-light)", color: "var(--forest)" }}>Focus {s.focus}/5</span>}
            {s.notes && <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 10, background: "var(--bg-elevated, var(--ochre-light))", color: "var(--text-muted)" }}>Notes</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.5rem", fontWeight: 700, color: "var(--terracotta)" }}>{fmtDuration(s.duration_min)}</div>
          <button onClick={(e) => { e.stopPropagation(); requestDelete(s); }} aria-label="Delete session" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2 }}><Trash2 size={14} /></button>
        </div>
      </div>
    );
  }

  function renderDayGroups(list: Session[]) {
    return groupByDay(list, (s) => s.session_date).map((group) => {
      const mins = group.items.reduce((n, s) => n + s.duration_min, 0);
      return (
        <div key={group.key} style={{ marginBottom: "1.25rem" }}>
          <DateGroupHeader
            label={group.label}
            summary={`${group.items.length} ${group.items.length === 1 ? "session" : "sessions"} · ${fmtDuration(mins)}`}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.items.map(renderSessionCard)}
          </div>
        </div>
      );
    });
  }

  const groupByControl = (
    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Group by</span>
      {GRANS.map((g) => (
        <Button key={g.v} size="sm" variant={granularity === g.v ? "primary" : "ghost"} onClick={() => changeGranularity(g.v)}>{g.label}</Button>
      ))}
    </div>
  );

  return (
    <div className="page active">
      <PageHeader
        icon={<Timer size={22} />}
        title="Study Sessions"
        subtitle="Time your focus, then log it — every session builds your streak."
        actions={!formOpen ? (
          <Button className="k-desktop-only" variant="outline" onClick={openManual}>
            <Plus size={16} /> Log a past session
          </Button>
        ) : undefined}
      />

      <div className="k-stats-grid" style={{ marginBottom: "1.5rem" }}>
        <StatCard tone="terracotta" label="This Week" value={fmtDuration(weekMin)} sub={`across ${weekCount} ${weekCount === 1 ? "session" : "sessions"}`} icon={<Clock size={18} />} />
        <StatCard tone="olive" label="Sessions" value={weekCount} sub="logged this week" icon={<Timer size={18} />} />
        <StatCard tone="forest" label="Avg Focus" value={avgFocus != null ? `${avgFocus}/5` : "—"} sub="this week" icon={<Target size={18} />} />
        <StatCard tone="ochre" label="Current Streak" value={`${streak} ${streak === 1 ? "day" : "days"}`} sub={topCourseId ? `Most time: ${courseName(topCourseId)}` : "Keep showing up"} icon={<Flame size={18} />} />
      </div>

      {/* FOCUS TIMER */}
      <Card title="Focus Timer" icon={<Timer size={20} />} subtitle="Start when you begin studying; Save to log the time." style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1.25rem" }}>
          <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "3.25rem", fontWeight: 700, lineHeight: 1, color: running ? "var(--terracotta)" : "var(--text-primary, var(--text))", fontVariantNumeric: "tabular-nums", minWidth: "clamp(120px, 30vw, 190px)" }}>
            {fmtClock(elapsedMs)}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {!running ? (
              <Button onClick={startTimer}><Play size={16} /> {accumMs > 0 ? "Resume" : "Start"}</Button>
            ) : (
              <Button variant="secondary" onClick={pauseTimer}><Pause size={16} /> Pause</Button>
            )}
            <Button variant="outline" onClick={saveTimer} disabled={elapsedMs < 30000}>Save session</Button>
            <Button variant="ghost" iconOnly onClick={resetTimer} aria-label="Reset timer" disabled={elapsedMs === 0}><RotateCcw size={16} /></Button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "0.75rem", marginTop: "1.1rem" }}>
          <Field label="Subject" htmlFor="t-course">
            <Select id="t-course" value={tCourse} onChange={(e) => setTCourse(e.target.value)}>
              <option value="">General study</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Topic (optional)" htmlFor="t-topic"><Input id="t-topic" value={tTopic} onChange={(e) => setTTopic(e.target.value)} placeholder="e.g., Cardiac meds" /></Field>
          <Field label="Focus" htmlFor="t-focus"><Select id="t-focus" value={tFocus} onChange={(e) => setTFocus(Number(e.target.value))}>{FOCUS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}</Select></Field>
        </div>
      </Card>

      {/* RECENT SESSIONS */}
      {loading ? (
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
      ) : total === 0 ? (
        <Card>
          <EmptyState
            icon={<Timer size={26} />}
            title="No study sessions yet"
            description="Start the focus timer above, or log a past session, to begin tracking your study time."
          />
        </Card>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            {groupByControl}
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{total} total</span>
          </div>

          {granularity === "day" ? (
            <>
              {renderDayGroups(sessions)}
              {sessions.length < total && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: "1.25rem" }}>
                  <Button variant="outline" onClick={loadMore} loading={loadingMore}>Load more</Button>
                </div>
              )}
            </>
          ) : periodsLoading ? (
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
          ) : periods.length === 0 ? (
            <Card><EmptyState icon={<Timer size={26} />} title="Nothing to roll up" description="Log some study time to see it grouped here." /></Card>
          ) : (
            periods.map((p) => (
              <PeriodRow
                key={p.period_start}
                label={periodLabel(p.period_start, granularity)}
                summary={`${p.cnt} ${p.cnt === 1 ? "session" : "sessions"} · ${fmtDuration(p.total_min)}`}
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

      {/* Mobile: the "log a past session" action sits below the list. */}
      {!formOpen && (
        <div className="k-mobile-only k-mobile-add">
          <Button variant="outline" onClick={openManual}><Plus size={16} /> Log a past session</Button>
        </div>
      )}

      {/* MANUAL LOG */}
      {formOpen && (
        <div ref={formRef} style={{ scrollMarginTop: "1rem", marginTop: "1.5rem" }}>
          <Card title={editingId ? "Edit session" : "Log a past session"} icon={editingId ? <Pencil size={20} /> : <Plus size={20} />}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "0.75rem" }}>
              <Field label="Subject" htmlFor="m-course">
                <Select id="m-course" value={fCourse} onChange={(e) => setFCourse(e.target.value)}>
                  <option value="">General study</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Date" htmlFor="m-date"><Input id="m-date" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} /></Field>
              <Field label="Duration (min)" htmlFor="m-dur"><Input id="m-dur" type="number" min="1" value={fDuration} onChange={(e) => { setFDuration(e.target.value); if (formError) setFormError(""); }} placeholder="45" /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
              <Field label="Topic (optional)" htmlFor="m-topic"><Input id="m-topic" value={fTopic} onChange={(e) => setFTopic(e.target.value)} placeholder="e.g., Cardiac meds" /></Field>
              <Field label="Focus" htmlFor="m-focus"><Select id="m-focus" value={fFocus} onChange={(e) => setFFocus(Number(e.target.value))}>{FOCUS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}</Select></Field>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <Field label="Notes (optional)" htmlFor="m-notes"><Textarea id="m-notes" value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="What did you cover? What clicked, what didn't?" /></Field>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "1.1rem" }}>
              <Button onClick={(e) => { e.currentTarget.blur(); saveManual(); }}>{editingId ? "Save changes" : "Add session"}</Button>
              <Button variant="outline" onClick={() => { collapseForm(); resetManual(); }}>{editingId ? "Cancel" : "Done"}</Button>
              {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
            </div>
          </Card>
        </div>
      )}

      <DetailSheet
        open={!!detail}
        onOpenChange={(o) => { if (!o) setDetail(null); }}
        title={detail ? `${courseName(detail.course_id)}${detail.topic ? ` — ${detail.topic}` : ""}` : ""}
      >
        {detail && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <DetailRow label="Subject">{courseName(detail.course_id)}</DetailRow>
              <DetailRow label="Date">{detail.session_date}</DetailRow>
              <DetailRow label="Duration">{fmtDuration(detail.duration_min)}</DetailRow>
              {detail.focus != null && <DetailRow label="Focus">{FOCUS.find((f) => f.v === detail.focus)?.label ?? `${detail.focus}/5`}</DetailRow>}
            </div>
            {detail.topic && <DetailRow label="Topic">{detail.topic}</DetailRow>}
            {detail.notes
              ? <DetailRow label="Notes">{detail.notes}</DetailRow>
              : <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic" }}>No notes for this session.</div>}
            <div style={{ marginTop: "0.25rem" }}>
              <Button size="sm" variant="outline" onClick={() => openEditSession(detail)}><Pencil size={13} /> Edit</Button>
            </div>
          </div>
        )}
      </DetailSheet>
    </div>
  );
}
