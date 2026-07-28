"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Target, Trash2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { useCollapsibleForm } from "@/lib/use-collapsible-form";
import { PageHeader, Card, Field, Input, Select, Button, Badge } from "@/components/kit";

// Grade-point + GPA logic, ported verbatim from the prototype (grades.js).
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

function gradeClass(pct: number) {
  if (pct >= 90) return "grade-A";
  if (pct >= 80) return "grade-B";
  if (pct >= 70) return "grade-C";
  return "grade-F";
}

type Course = {
  id: string;
  name: string;
  code: string | null;
  credits: number | null;
  semester: string | null;
  grade_pct: number | null;
  weight_pct: number | null;
};

type Assessment = {
  id: string;
  course_id: string;
  name: string;
  type: string | null;
  score: number | null;
  max_score: number | null;
  weight_pct: number | null;
};

const ASSESSMENT_TYPES = ["Quiz", "Assignment", "Mid-Term", "Final Exam", "Lab"];

// Client mirror of the SQL roll-up (see migration 0004): weighted average of
// score/max by weight_pct, simple average when no weights, null when there are
// no scored assessments. Keeps the course grade in sync instantly; the DB
// trigger is the source of truth on the server.
function rollupGrade(list: Assessment[]): number | null {
  const scored = list.filter((a) => a.score != null && a.max_score != null && (a.max_score as number) > 0);
  if (scored.length === 0) return null;
  const pct = (a: Assessment) => ((a.score as number) / (a.max_score as number)) * 100;
  const totalWeight = scored.reduce((s, a) => s + (a.weight_pct ?? 0), 0);
  const g = totalWeight > 0
    ? scored.reduce((s, a) => s + pct(a) * (a.weight_pct ?? 0), 0) / totalWeight
    : scored.reduce((s, a) => s + pct(a), 0) / scored.length;
  return Math.round(g * 10) / 10;
}

// A scored practice attempt, exploded per topic from a quiz row.
type QuizRow = {
  course_id: string;
  topics: string | null;
  score: number | null;
  max_score: number | null;
  taken_on: string | null;
  created_at: string | null;
};

// Mastery weights recent attempts more heavily: an attempt's influence halves
// every HALF_LIFE_DAYS. A topic needs >=3 attempts to be "trusted"; if its most
// recent attempt is >14 days old it's flagged stale.
const HALF_LIFE_DAYS = 30;
const MASTERY_MIN_ATTEMPTS = 3;
const STALE_DAYS = 14;

function recencyLabel(days: number) {
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

export default function GradesPage() {
  const supabase = createClient();
  const toast = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Reference "now" for mastery recency, captured at load (kept out of render to
  // stay pure). Fine as a fixed point — the page reloads to refresh it.
  const [now, setNow] = useState(0);

  // Add-grade form (open/close + auto-scroll via the shared hook).
  const { open: formOpen, formRef, openForm, closeForm: collapseForm, scrollFormIntoView } = useCollapsibleForm();
  const [fCourse, setFCourse] = useState("");
  const [fName, setFName] = useState("");
  const [fType, setFType] = useState(ASSESSMENT_TYPES[0]);
  const [fScore, setFScore] = useState("");
  const [fMax, setFMax] = useState("");
  const [fWeight, setFWeight] = useState("");
  const [formError, setFormError] = useState("");

  const pending = useRef<Map<string, { item: Assessment; timeout: number }>>(new Map());

  useEffect(() => {
    (async () => {
      setNow(Date.now());
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const [{ data: courseRows }, { data: assessRows }, { data: quizRows }] = await Promise.all([
        supabase.from("courses").select("id, name, code, credits, semester, grade_pct, weight_pct").order("created_at", { ascending: true }),
        supabase.from("assessments").select("id, course_id, name, type, score, max_score, weight_pct").order("created_at", { ascending: true }),
        supabase.from("quizzes").select("course_id, topics, score, max_score, taken_on, created_at").order("created_at", { ascending: false }),
      ]);
      setCourses((courseRows as Course[]) ?? []);
      setAssessments((assessRows as Assessment[]) ?? []);
      setQuizzes((quizRows as QuizRow[]) ?? []);
      if (courseRows && courseRows.length) setFCourse((courseRows[0] as Course).id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect an assessment-list change into the affected course's grade_pct in
  // local state, matching what the DB trigger persists.
  function syncCourseGrade(courseId: string, list: Assessment[]) {
    const grade = rollupGrade(list.filter((a) => a.course_id === courseId));
    setCourses((xs) => xs.map((c) => (c.id === courseId ? { ...c, grade_pct: grade } : c)));
  }

  // Credit-weighted GPA over courses that have both a grade and credits.
  const gpaCourses = courses.filter((c) => c.grade_pct != null && (c.credits ?? 0) > 0);
  const gpaCredits = gpaCourses.reduce((s, c) => s + (c.credits ?? 0), 0);
  const gpa = gpaCredits
    ? (gpaCourses.reduce((s, c) => s + pctToGradePoint(c.grade_pct as number) * (c.credits ?? 0), 0) / gpaCredits).toFixed(1)
    : "—";

  // Dominant semester label for the GPA card subtitle.
  const semesterLabel = (() => {
    const counts = new Map<string, number>();
    for (const c of courses) if (c.semester) counts.set(c.semester, (counts.get(c.semester) ?? 0) + 1);
    let best = "";
    let bestN = 0;
    for (const [sem, n] of counts) if (n > bestN) { best = sem; bestN = n; }
    return best || "Current";
  })();

  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "—";

  // Topic-level mastery, aggregated from real quiz rows. Each quiz is exploded
  // across its comma-separated topics (a topic-less quiz falls under "General"),
  // then per (course, topic) we take a recency-weighted average of the attempt
  // percentages so recent practice dominates the score.
  const masteryRows = (() => {
    type Att = { pct: number; ageDays: number };
    const buckets = new Map<string, { course_id: string; topic: string; atts: Att[] }>();
    for (const q of quizzes) {
      if (q.score == null || q.max_score == null || !((q.max_score as number) > 0)) continue;
      const pct = ((q.score as number) / (q.max_score as number)) * 100;
      const dateStr = q.taken_on ?? (q.created_at ? q.created_at.slice(0, 10) : null);
      const t = dateStr ? new Date(dateStr + "T00:00:00").getTime() : now;
      const ageDays = Math.max(0, (now - t) / 86400000);
      const topics = (q.topics ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      for (const topic of topics.length ? topics : ["General"]) {
        const key = q.course_id + "||" + topic.toLowerCase();
        let b = buckets.get(key);
        if (!b) { b = { course_id: q.course_id, topic, atts: [] }; buckets.set(key, b); }
        b.atts.push({ pct, ageDays });
      }
    }
    const rows = [...buckets.values()].map((b) => {
      let wsum = 0;
      let wpct = 0;
      let minAge = Infinity;
      for (const a of b.atts) {
        const w = Math.pow(0.5, a.ageDays / HALF_LIFE_DAYS);
        wsum += w;
        wpct += w * a.pct;
        if (a.ageDays < minAge) minAge = a.ageDays;
      }
      const score = wsum ? Math.round(wpct / wsum) : 0;
      const lastDays = Math.round(minAge);
      const attempts = b.atts.length;
      const status: "active" | "stale" | "insufficient" =
        attempts < MASTERY_MIN_ATTEMPTS ? "insufficient" : lastDays > STALE_DAYS ? "stale" : "active";
      return { key: b.course_id + "||" + b.topic, course: courseName(b.course_id), topic: b.topic, attempts, score, lastDays, status };
    });
    const order = { active: 0, stale: 1, insufficient: 2 };
    rows.sort((a, b) => order[a.status] - order[b.status] || b.score - a.score);
    return rows;
  })();

  function openAdd() {
    setFormError("");
    openForm();
  }

  async function addGrade() {
    if (!userId) return;
    if (!fCourse) { setFormError("Add a course first."); return; }
    if (!fName.trim()) { setFormError("Name the assessment."); return; }
    const score = fScore === "" ? null : Number(fScore);
    const max = fMax === "" ? null : Number(fMax);
    if (score == null || max == null || !(max > 0)) { setFormError("Enter a score and a max score above 0."); return; }
    setFormError("");

    const payload = {
      user_id: userId,
      course_id: fCourse,
      name: fName.trim(),
      type: fType,
      score,
      max_score: max,
      weight_pct: fWeight === "" ? null : Number(fWeight),
    };
    const { data, error } = await supabase.from("assessments").insert(payload).select().single();
    if (error || !data) { setFormError("Could not save — please try again."); return; }

    const next = [...assessments, data as Assessment];
    setAssessments(next);
    syncCourseGrade(fCourse, next);
    // Keep the form open (same course) so several grades can be added in a row.
    setFName("");
    setFScore("");
    setFMax("");
    setFWeight("");
    scrollFormIntoView();
  }

  function requestDelete(a: Assessment) {
    const next = assessments.filter((x) => x.id !== a.id);
    setAssessments(next);
    syncCourseGrade(a.course_id, next);
    const timeout = window.setTimeout(async () => {
      pending.current.delete(a.id);
      await supabase.from("assessments").delete().eq("id", a.id);
    }, 5000);
    pending.current.set(a.id, { item: a, timeout });
    toast.show("Grade deleted", {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = pending.current.get(a.id);
        if (!p) return;
        clearTimeout(p.timeout);
        pending.current.delete(a.id);
        const restored = [...assessments.filter((x) => x.id !== a.id), p.item];
        setAssessments(restored);
        syncCourseGrade(a.course_id, restored);
      },
    });
  }

  return (
    <div className="page active">
      <PageHeader
        icon={<BookOpen size={22} />}
        title="Grades"
        subtitle="Monitor your academic performance"
        actions={!formOpen ? (
          <Button className="k-desktop-only" onClick={openAdd}>
            <Plus size={16} /> Add Grade
          </Button>
        ) : undefined}
      />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4 mb-6">
        <Card style={{ textAlign: "center" }}>
          <div className="gpa-val">{gpa}</div>
          <div className="gpa-label">Current GPA</div>
          <div className="wave-decoration" />
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{semesterLabel} Semester</div>
          <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.4rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Badge tone="olive">A = 4.0</Badge>
            <Badge tone="ochre">B = 3.0</Badge>
            <Badge tone="terracotta">C = 2.0</Badge>
          </div>
        </Card>
        <Card title="Course Grades Overview" icon={<BookOpen size={20} />}>
          {loading ? (
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
          ) : courses.length === 0 ? (
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>
              No courses yet — add courses (with a grade) on the Courses page and they&apos;ll show here.
            </div>
          ) : (
            courses.map((c) => {
              const n = assessments.filter((a) => a.course_id === c.id).length;
              return (
                <div className="grade-row" key={c.id}>
                  <div className="grade-name">
                    <strong>{c.name}</strong>{c.code ? ` ${c.code}` : ""}{c.credits != null ? ` · ${c.credits} credit${c.credits === 1 ? "" : "s"}` : ""}
                    {n > 0 && <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}> · {n} grade{n === 1 ? "" : "s"}</span>}
                  </div>
                  <div className="grade-weight">{c.weight_pct != null ? `${c.weight_pct}%` : "—"}</div>
                  <div className={"grade-score " + (c.grade_pct != null ? gradeClass(c.grade_pct) : "")} style={c.grade_pct != null ? undefined : { color: "var(--text-muted)" }}>{c.grade_pct != null ? `${c.grade_pct}%` : "—"}</div>
                </div>
              );
            })
          )}
        </Card>
      </div>

      {/* Recorded (official) grades */}
      <Card title="Recorded Grades" icon={<BookOpen size={20} />}>
        {assessments.length > 0 ? (
          assessments.map((a) => {
            const pct = a.score != null && a.max_score ? Math.round((a.score / a.max_score) * 1000) / 10 : null;
            return (
              <div className="grade-row" key={a.id}>
                <div className="grade-name">
                  <strong>{courseName(a.course_id)}</strong> · {a.name}
                  {a.type ? <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}> · {a.type}</span> : null}
                </div>
                <div className="grade-weight" style={{ width: "auto", fontSize: "0.72rem" }}>
                  {a.score}/{a.max_score}{a.weight_pct != null ? ` · ${a.weight_pct}% wt` : ""}
                </div>
                <div className={"grade-score " + (pct != null ? gradeClass(pct) : "")} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {pct != null ? `${pct}%` : "—"}
                  <button onClick={() => requestDelete(a)} aria-label="Delete grade" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2 }}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>
            No grades recorded yet — add your official syllabus grades below.
          </div>
        )}
      </Card>

      {/* Mobile: the "New" action sits at the bottom-left of the list. */}
      {!formOpen && (
        <div className="k-mobile-only k-mobile-add">
          <Button onClick={openAdd}><Plus size={16} /> Add Grade</Button>
        </div>
      )}

      {/* ADD COURSE GRADE ENTRY */}
      {formOpen && (
        <div ref={formRef} style={{ scrollMarginTop: "1rem", marginTop: "1rem" }}>
          <Card title="Add Course Grade Entry" icon={<BookOpen size={20} />}>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.85rem", fontStyle: "italic" }}>Official grades from your syllabus — these feed each course grade and your GPA.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "0.75rem" }}>
              <Field label="Course" htmlFor="g-course">
                <Select id="g-course" value={fCourse} onChange={(e) => { setFCourse(e.target.value); if (formError) setFormError(""); }}>
                  {courses.length ? courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>) : <option value="">Add a course first</option>}
                </Select>
              </Field>
              <Field label="Assessment Name" htmlFor="g-name"><Input id="g-name" value={fName} onChange={(e) => { setFName(e.target.value); if (formError) setFormError(""); }} placeholder="e.g., Quiz 1" /></Field>
              <Field label="Type" htmlFor="g-type"><Select id="g-type" value={fType} onChange={(e) => setFType(e.target.value)}>{ASSESSMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
              <Field label="Score" htmlFor="g-score"><Input id="g-score" type="number" min="0" value={fScore} onChange={(e) => { setFScore(e.target.value); if (formError) setFormError(""); }} placeholder="85" /></Field>
              <Field label="Max Score" htmlFor="g-max"><Input id="g-max" type="number" min="0" value={fMax} onChange={(e) => { setFMax(e.target.value); if (formError) setFormError(""); }} placeholder="100" /></Field>
              <Field label="Weight %" htmlFor="g-weight"><Input id="g-weight" type="number" min="0" max="100" value={fWeight} onChange={(e) => setFWeight(e.target.value)} placeholder="10" /></Field>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "1.1rem" }}>
              <Button onClick={(e) => { e.currentTarget.blur(); addGrade(); }}>Add Grade</Button>
              <Button variant="outline" onClick={collapseForm}>Done</Button>
              {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
            </div>
          </Card>
        </div>
      )}

      <Card
        style={{ marginTop: "1.5rem" }}
        title="Practice Grades — Mastery Score"
        icon={<Target size={20} />}
        action={<Badge tone="ochre">Separate from GPA</Badge>}
      >
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1rem", fontStyle: "italic" }}>
          Built from your quiz results in the Quizzes tab — a live read on how well you&apos;re actually retaining each topic, independent of what&apos;s on your transcript. Recent attempts count more than old ones.
        </div>
        {loading ? (
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
        ) : masteryRows.length === 0 ? (
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>
            No quiz results yet — record quizzes in the Quizzes tab and your topic mastery will show up here.
          </div>
        ) : (
          masteryRows.map((m) => {
            const dot = m.status === "active" ? "var(--forest)" : m.status === "stale" ? "var(--ochre)" : "var(--text-muted)";
            const meta = m.status === "insufficient"
              ? `${m.attempts} quiz${m.attempts === 1 ? "" : "zes"} · not enough data`
              : m.status === "stale"
                ? `Stale — last attempt ${recencyLabel(m.lastDays)}`
                : `${m.attempts} quizzes · updated ${recencyLabel(m.lastDays)}`;
            const cls = m.status === "active" ? gradeClass(m.score) : "";
            return (
              <div className="grade-row" key={m.key}>
                <div className="grade-name" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, display: "inline-block", flexShrink: 0 }} />
                  <span><strong>{m.course}</strong> · {m.topic}</span>
                </div>
                <div className="grade-weight" style={{ width: "auto", fontSize: "0.68rem" }}>{meta}</div>
                <div className={"grade-score " + cls} style={cls ? undefined : { color: "var(--text-muted)" }}>{m.score}%</div>
              </div>
            );
          })
        )}
        <div style={{ marginTop: "0.85rem", paddingTop: "0.75rem", borderTop: "1px dashed var(--border)", fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--forest)", display: "inline-block" }} /> Active — regularly reviewed</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ochre)", display: "inline-block" }} /> Stale — 14+ days since last attempt</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-muted)", display: "inline-block" }} /> Not enough data — fewer than 3 attempts</span>
        </div>
      </Card>
    </div>
  );
}
