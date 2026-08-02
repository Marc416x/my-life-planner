"use client";

import { useEffect, useState } from "react";
import {
  BarChart3, GraduationCap, Timer, CalendarCheck, ClipboardList,
  TrendingUp, Award, Clock, Gauge, CircleCheck, LineChart,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/profile-provider";
import { toISODate } from "@/lib/streak";
import { applyTermScope } from "@/lib/term";
import { PageHeader, Card, StatCard, Progress, EmptyState } from "@/components/kit";

// ------------------------------------------------------------------
// Progress Metrics — a read-only, cross-cutting analytics view that reads the
// rest of the app (grades, study sessions, streaks, tasks, error log) and turns
// it into "where am I now" numbers. Nothing is written here.
//
// It reflects your CURRENT standing on purpose: term-stamped sources (study,
// errors) are scoped to the current term and it deliberately ignores the global
// archived-term picker — grades/GPA have no term stamp, so mixing an archived
// study view with a live GPA would read as contradictory. "Progress over time"
// here means recent history within the term you're actually in.
// ------------------------------------------------------------------

type Tone = "terracotta" | "olive" | "ochre" | "forest";

type CourseRow = { credits: number | null; grade_pct: number | null };
type Assess = { name: string; score: number | null; max_score: number | null; created_at: string | null };
type WeekPeriod = { period_start: string; cnt: number; total_min: number };
type SessRow = { session_date: string; duration_min: number; focus: number | null; started_at: string | null };

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Bars share the legacy `.chart-container` (height 160px, bars flex-end so they
// rise from a common label baseline). Cap heights below that so nothing clips.
const MAX_BAR = 128;
const barHeight = (frac: number) => Math.max(4, Math.round(4 + Math.min(1, frac) * (MAX_BAR - 4)));

// Percent → 4.0-scale grade point, ported from the Grades page (grades.js).
function pctToGradePoint(pct: number) {
  if (pct >= 93) return 4.0;
  if (pct >= 90) return 3.7;
  if (pct >= 87) return 3.3;
  if (pct >= 83) return 3.0;
  if (pct >= 80) return 2.7;
  if (pct >= 77) return 2.3;
  if (pct >= 73) return 2.0;
  if (pct >= 70) return 1.7;
  if (pct >= 60) return 1.0;
  return 0.0;
}

// A score's bar colour, warm→cool by band (mirrors the gradeClass buckets).
function gradeFill(pct: number): string {
  if (pct >= 90) return "fill-forest";
  if (pct >= 80) return "fill-olive";
  if (pct >= 70) return "fill-ochre";
  return "fill-terracotta";
}

function fmtDuration(min: number): string {
  if (min <= 0) return "0m";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function focusWord(v: number): string {
  if (v >= 4.5) return "Locked in";
  if (v >= 3.5) return "Focused";
  if (v >= 2.5) return "Okay";
  if (v >= 1.5) return "Meh";
  return "Distracted";
}

// Which time-of-day bucket an hour (0–23, local) falls in.
const TOD_BUCKETS: { label: string; tone: Tone }[] = [
  { label: "Early (5–9a)", tone: "ochre" },
  { label: "Morning (9–12)", tone: "terracotta" },
  { label: "Midday (12–3)", tone: "olive" },
  { label: "Afternoon (3–6)", tone: "forest" },
  { label: "Evening (6p+)", tone: "ochre" },
];
function todIndex(h: number): number {
  if (h >= 5 && h < 9) return 0;
  if (h >= 9 && h < 12) return 1;
  if (h >= 12 && h < 15) return 2;
  if (h >= 15 && h < 18) return 3;
  return 4; // 18–23 and 0–4 → evening/night
}

const hint: React.CSSProperties = {
  fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic", padding: "0.75rem 0.25rem",
};

export default function ProgressPage() {
  const supabase = createClient();
  const { studyDays, streak, best, level } = useProfile();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [assessments, setAssessments] = useState<Assess[]>([]);
  const [tasks, setTasks] = useState<{ done: boolean }[]>([]);
  const [sessions, setSessions] = useState<SessRow[]>([]);
  const [weeks, setWeeks] = useState<WeekPeriod[]>([]);
  const [errTotal, setErrTotal] = useState(0);
  const [errResolved, setErrResolved] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Current term drives the term-stamped scopes below.
      const { data: profile } = await supabase.from("profiles").select("year").eq("id", user.id).single();
      const yr = (profile?.year as string) ?? null;

      // 90-day window bounds the row-level study pulls (avg/day + time-of-day).
      const win = new Date();
      win.setHours(0, 0, 0, 0);
      win.setDate(win.getDate() - 89);
      const winISO = toISODate(win);

      const [
        { data: courseRows },
        { data: assessRows },
        { data: taskRows },
        sessRes,
        { data: weekRows },
        errAll,
        errDone,
      ] = await Promise.all([
        supabase.from("courses").select("credits, grade_pct"),
        supabase.from("assessments").select("name, score, max_score, created_at").order("created_at", { ascending: false }).limit(24),
        supabase.from("daily_tasks").select("done"),
        applyTermScope(
          supabase.from("study_sessions").select("session_date, duration_min, focus, started_at").gte("session_date", winISO),
          null, yr,
        ),
        supabase.rpc("study_session_periods", { p_gran: "week", p_scope: null }),
        applyTermScope(supabase.from("error_log").select("id", { count: "exact", head: true }), null, yr),
        applyTermScope(supabase.from("error_log").select("id", { count: "exact", head: true }).eq("resolved", true), null, yr),
      ]);

      setCourses((courseRows as CourseRow[]) ?? []);
      setAssessments((assessRows as Assess[]) ?? []);
      setTasks((taskRows as { done: boolean }[]) ?? []);
      setSessions((sessRes.data as SessRow[]) ?? []);
      setWeeks((weekRows as WeekPeriod[]) ?? []);
      setErrTotal(errAll.count ?? 0);
      setErrResolved(errDone.count ?? 0);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Academic: credit-weighted GPA (falls back to a flat average when no
  // course carries credits), plus a headline average percentage. ----
  const graded = courses.filter((c) => c.grade_pct != null);
  const gpaCourses = graded.filter((c) => (c.credits ?? 0) > 0);
  const gpaCredits = gpaCourses.reduce((s, c) => s + (c.credits ?? 0), 0);
  const gpa: number | null = gpaCredits > 0
    ? gpaCourses.reduce((s, c) => s + pctToGradePoint(c.grade_pct as number) * (c.credits ?? 0), 0) / gpaCredits
    : graded.length
      ? graded.reduce((s, c) => s + pctToGradePoint(c.grade_pct as number), 0) / graded.length
      : null;
  const avgPct = graded.length
    ? Math.round(graded.reduce((s, c) => s + (c.grade_pct as number), 0) / graded.length)
    : null;

  // ---- Study: minutes per calendar day in the window → avg per active day. ----
  const dayMin = new Map<string, number>();
  sessions.forEach((s) => dayMin.set(s.session_date, (dayMin.get(s.session_date) ?? 0) + (s.duration_min || 0)));
  const activeDays = dayMin.size;
  const windowMin = [...dayMin.values()].reduce((a, b) => a + b, 0);
  const avgPerDay = activeDays ? Math.round(windowMin / activeDays) : 0;

  // ---- Consistency: share of the last 28 days that were study days. ----
  const daySet = new Set(studyDays);
  let studied28 = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 28; i++) {
    if (daySet.has(toISODate(cursor))) studied28++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const consistency = Math.round((studied28 / 28) * 100);

  // ---- Tasks completion. ----
  const tasksDone = tasks.filter((t) => t.done).length;
  const tasksTotal = tasks.length;
  const tasksPct = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  // ---- Weekly study bars (oldest → newest, last 8 weeks). ----
  const weekBars = [...weeks].slice(0, 8).reverse();
  const maxWeekMin = Math.max(1, ...weekBars.map((w) => w.total_min));

  // ---- Recent recorded scores (oldest → newest of the latest ~10 scored). ----
  const scored = assessments.filter((a) => a.score != null && a.max_score != null && (a.max_score as number) > 0);
  const scoreBars = [...scored].slice(0, 10).reverse().map((a) => {
    const pct = Math.round(((a.score as number) / (a.max_score as number)) * 100);
    return { name: a.name, pct };
  });

  // ---- Time of day (only live-timer sessions carry a start time). ----
  const todMin = TOD_BUCKETS.map(() => 0);
  sessions.forEach((s) => {
    if (!s.started_at) return;
    todMin[todIndex(new Date(s.started_at).getHours())] += s.duration_min || 0;
  });
  const todTotal = todMin.reduce((a, b) => a + b, 0);
  const todPeak = todTotal ? todMin.indexOf(Math.max(...todMin)) : -1;

  // ---- Focus quality (avg of rated sessions in the window). ----
  const rated = sessions.filter((s) => s.focus != null).map((s) => s.focus as number);
  const avgFocus = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;

  // ---- Error-review mastery. ----
  const resolvedPct = errTotal ? Math.round((errResolved / errTotal) * 100) : 0;
  const errOpen = errTotal - errResolved;

  const TierIcon = level.tier.icon;

  return (
    <div className="page active">
      <PageHeader
        icon={<BarChart3 size={22} />}
        title="Progress Metrics"
        subtitle="Understand your patterns, optimize your performance"
      />

      {loading ? (
        <div style={{ ...hint, textAlign: "center" }}>Loading your progress…</div>
      ) : (
        <>
          {/* HEADLINE STATS */}
          <div className="k-stats-grid" style={{ marginBottom: "1.5rem" }}>
            <StatCard
              tone="forest"
              label="Overall GPA"
              value={gpa != null ? gpa.toFixed(2) : "—"}
              sub={graded.length
                ? `${graded.length} graded course${graded.length === 1 ? "" : "s"}${avgPct != null ? ` · ${avgPct}% avg` : ""}`
                : "Add grades to see your GPA"}
              icon={<GraduationCap size={18} />}
            />
            <StatCard
              tone="terracotta"
              label="Avg Study / Day"
              value={activeDays ? fmtDuration(avgPerDay) : "—"}
              sub={activeDays ? `over ${activeDays} study day${activeDays === 1 ? "" : "s"} (90d)` : "No sessions logged yet"}
              icon={<Timer size={18} />}
            />
            <StatCard
              tone="ochre"
              label="Study Consistency"
              value={`${consistency}%`}
              sub={`${studied28}/28 days · ${streak}-day streak`}
              icon={<CalendarCheck size={18} />}
            >
              <Progress value={consistency} tone="ochre" style={{ margin: "0.5rem 0 0.15rem" }} />
            </StatCard>
            <StatCard
              tone="olive"
              label="Tasks Completed"
              value={`${tasksDone}/${tasksTotal}`}
              sub={tasksTotal ? `${tasksPct}% complete` : "No tasks yet"}
              icon={<ClipboardList size={18} />}
            >
              <Progress value={tasksPct} tone="olive" style={{ margin: "0.5rem 0 0.15rem" }} />
            </StatCard>
          </div>

          {/* TREND CHARTS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: "1.5rem" }}>
            <Card title="Study Hours per Week" icon={<TrendingUp size={20} />}>
              {weekBars.length === 0 ? (
                <div style={hint}>Log study sessions and your weekly totals will chart here.</div>
              ) : (
                <>
                  <div className="chart-container">
                    {weekBars.map((w) => {
                      const d = new Date(w.period_start + "T00:00:00");
                      return (
                        <div className="chart-bar-wrap" key={w.period_start} title={`Week of ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()} — ${fmtDuration(w.total_min)}`}>
                          <div className="chart-bar-inner fill-terracotta" style={{ height: barHeight(w.total_min / maxWeekMin) }} />
                          <div className="chart-bar-label">{`${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.5rem", textAlign: "center" }}>
                    Total study time per week — last {weekBars.length} week{weekBars.length === 1 ? "" : "s"}
                  </div>
                </>
              )}
            </Card>

            <Card title="Recent Scores" icon={<Award size={20} />}>
              {scoreBars.length === 0 ? (
                <div style={hint}>Record graded assessments and your recent scores will chart here.</div>
              ) : (
                <>
                  <div className="chart-container">
                    {scoreBars.map((b, i) => (
                      <div className="chart-bar-wrap" key={i} title={`${b.name} — ${b.pct}%`}>
                        <div className={`chart-bar-inner ${gradeFill(b.pct)}`} style={{ height: barHeight(b.pct / 100) }} />
                        <div className="chart-bar-label">{b.name.length > 6 ? b.name.slice(0, 6) + "…" : b.name}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.5rem", textAlign: "center" }}>
                    Your most recent recorded scores (%)
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* INSIGHT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card title="Study Time of Day" icon={<Clock size={20} />} subtitle="When you focus best">
              {todTotal === 0 ? (
                <div style={hint}>Use the focus timer on Study Sessions and we&apos;ll surface your peak hours.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginTop: "0.25rem" }}>
                  {TOD_BUCKETS.map((b, i) => {
                    const pct = Math.round((todMin[i] / todTotal) * 100);
                    const peak = i === todPeak;
                    return (
                      <div key={b.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.76rem" }}>
                        <span style={{ width: 96, color: "var(--text-muted)", flexShrink: 0 }}>{b.label}</span>
                        <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: `var(--${b.tone})`, borderRadius: 4 }} />
                        </div>
                        <span style={{ width: 34, textAlign: "right", color: peak ? `var(--${b.tone})` : "var(--text-muted)", fontWeight: peak ? 700 : 400 }}>{pct}%</span>
                      </div>
                    );
                  })}
                  {todPeak >= 0 && (
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary, var(--text-muted))", marginTop: "0.4rem", fontStyle: "italic" }}>
                      💡 You study most in the {TOD_BUCKETS[todPeak].label.toLowerCase().replace(/\s*\(.*\)/, "")} — protect that window.
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card title="Focus Quality" icon={<Gauge size={20} />} subtitle="Self-rated concentration">
              {avgFocus == null ? (
                <div style={hint}>Rate your focus when you log sessions to see this trend.</div>
              ) : (
                <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
                  <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "2.4rem", fontWeight: 700, lineHeight: 1, color: "var(--terracotta)" }}>
                    {avgFocus.toFixed(1)}<span style={{ fontSize: "1.1rem", color: "var(--text-muted)" }}>/5</span>
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, marginTop: "0.2rem" }}>{focusWord(avgFocus)}</div>
                  <Progress value={(avgFocus / 5) * 100} tone="terracotta" style={{ marginTop: "0.75rem" }} />
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                    across {rated.length} rated session{rated.length === 1 ? "" : "s"} (90d)
                  </div>
                </div>
              )}
            </Card>

            <Card title="Error Review" icon={<CircleCheck size={20} />} subtitle="Turning misses into mastery">
              {errTotal === 0 ? (
                <div style={hint}>Log mistakes in the Error Log and your review progress shows here.</div>
              ) : (
                <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
                  <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "2.4rem", fontWeight: 700, lineHeight: 1, color: "var(--forest)" }}>
                    {resolvedPct}%
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, marginTop: "0.2rem" }}>reviewed &amp; mastered</div>
                  <Progress value={resolvedPct} tone="forest" style={{ marginTop: "0.75rem" }} />
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                    {errResolved} of {errTotal} logged · {errOpen === 0 ? "all caught up 🎉" : `${errOpen} still to review`}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* MOMENTUM STRIP — streak + discipline level, at a glance. */}
          <Card style={{ marginTop: "1.5rem" }} title="Momentum" icon={<LineChart size={20} />}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--terracotta-light)", color: "var(--terracotta)" }}>
                  <TierIcon size={22} />
                </span>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Discipline level {level.level}</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{level.tier.name}</div>
                </div>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4 }}>
                  <span>{streak}-day streak · best {best}</span>
                  <span>{level.next ? `Next: ${level.next.name} (${level.daysToNext}d)` : "Max level"}</span>
                </div>
                <Progress value={level.progress} tone="terracotta" />
              </div>
            </div>
          </Card>

          {/* Empty-shell nudge when literally nothing has been logged yet. */}
          {graded.length === 0 && activeDays === 0 && tasksTotal === 0 && errTotal === 0 && (
            <Card style={{ marginTop: "1.5rem" }}>
              <EmptyState
                icon={<BarChart3 size={26} />}
                title="Your metrics are waiting"
                description="Log study sessions, record grades, and review your mistakes — this page fills in automatically as you go."
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
