"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Target, Trash2, ChevronDown, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";

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

// Mastery scores are a separate, quiz-derived feature (placeholder for now).
const mastery = [
  { course: "Pharmacology", topic: "Drug Classes & Mechanisms", meta: "8 quizzes · updated 2d ago", score: "78%", cls: "grade-B" },
  { course: "Pharmacology", topic: "Pharmacokinetics", meta: "4 quizzes · updated 6d ago", score: "64%", cls: "grade-C" },
  { course: "Fundamentals of Nursing", topic: "Patient Assessment", meta: "6 quizzes · updated 1d ago", score: "90%", cls: "grade-A" },
  { course: "Anatomy & Physiology", topic: "Nervous System", meta: "Stale — no attempt in 14+ days", score: "58%", cls: "" },
  { course: "Clinical Lab Sciences", topic: "Dosage Calculations", meta: "1 quiz · not enough data", score: "—", cls: "" },
];

export default function GradesPage() {
  const supabase = createClient();
  const toast = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Add-grade form state.
  const [formOpen, setFormOpen] = useState(false);
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
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const [{ data: courseRows }, { data: assessRows }] = await Promise.all([
        supabase.from("courses").select("id, name, code, credits, semester, grade_pct, weight_pct").order("created_at", { ascending: true }),
        supabase.from("assessments").select("id, course_id, name, type, score, max_score, weight_pct").order("created_at", { ascending: true }),
      ]);
      setCourses((courseRows as Course[]) ?? []);
      setAssessments((assessRows as Assessment[]) ?? []);
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
      <div className="page-header">
        <h1>Grades</h1>
        <p>Monitor your academic performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4 mb-6">
        <div className="card" style={{ textAlign: "center" }}>
          <div className="gpa-val">{gpa}</div>
          <div className="gpa-label">Current GPA</div>
          <div className="wave-decoration" />
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{semesterLabel} Semester</div>
          <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 20, background: "var(--olive-light)", color: "var(--olive-dark)" }}>A = 4.0</span>
            <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 20, background: "var(--ochre-light)", color: "#7A5A10" }}>B = 3.0</span>
            <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 20, background: "var(--terracotta-light)", color: "var(--terracotta-dark)" }}>C = 2.0</span>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}><BookOpen size={18} /> Course Grades Overview</div>
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
        </div>
      </div>

      <div className="form-section" style={{ marginTop: "1.25rem" }}>
        <button
          onClick={() => setFormOpen((o) => !o)}
          aria-expanded={formOpen}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", color: "inherit", textAlign: "left" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 600, fontSize: "1.05rem" }}>
            {formOpen ? <BookOpen size={18} /> : <Plus size={18} />} Add Course Grade Entry
          </span>
          <ChevronDown size={18} style={{ transition: "transform 0.15s", transform: formOpen ? "rotate(180deg)" : "none", color: "var(--text-muted)" }} />
        </button>

        {formOpen && (
          <div style={{ marginTop: "0.85rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem", fontStyle: "italic" }}>Official grades from your syllabus — these feed each course grade and your GPA.</div>
            <div className="input-row three">
              <div className="field-group"><div className="field-label">Course</div>
                <select className="field-select" value={fCourse} onChange={(e) => { setFCourse(e.target.value); if (formError) setFormError(""); }}>
                  {courses.length ? courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>) : <option value="">Add a course first</option>}
                </select>
              </div>
              <div className="field-group"><div className="field-label">Assessment Name</div><input className="field-input" value={fName} onChange={(e) => { setFName(e.target.value); if (formError) setFormError(""); }} placeholder="e.g., Quiz 1" /></div>
              <div className="field-group"><div className="field-label">Type</div><select className="field-select" value={fType} onChange={(e) => setFType(e.target.value)}>{ASSESSMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            </div>
            <div className="input-row three">
              <div className="field-group"><div className="field-label">Score</div><input className="field-input" type="number" min="0" value={fScore} onChange={(e) => { setFScore(e.target.value); if (formError) setFormError(""); }} placeholder="85" /></div>
              <div className="field-group"><div className="field-label">Max Score</div><input className="field-input" type="number" min="0" value={fMax} onChange={(e) => { setFMax(e.target.value); if (formError) setFormError(""); }} placeholder="100" /></div>
              <div className="field-group"><div className="field-label">Weight %</div><input className="field-input" type="number" min="0" max="100" value={fWeight} onChange={(e) => setFWeight(e.target.value)} placeholder="10" /></div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn-add" onClick={(e) => { e.currentTarget.blur(); addGrade(); }}>+ Add Grade</button>
              {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
            </div>
          </div>
        )}

        {assessments.length > 0 && (
          <div style={{ marginTop: "1.25rem" }}>
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Recorded Grades</div>
            {assessments.map((a) => {
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
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <div className="card-title" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: "0.45rem" }}><Target size={18} /> Practice Grades — Mastery Score</div>
          <span style={{ fontSize: "0.6rem", background: "var(--ochre-light)", color: "#7A5A10", padding: "2px 8px", borderRadius: 10 }}>Separate from GPA</span>
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1rem", fontStyle: "italic" }}>
          Built from your quiz &amp; assignment results in the Quizzes tab — a live read on how well you&apos;re actually retaining each topic, independent of what&apos;s on your transcript. Recent attempts count more than old ones.
        </div>
        {mastery.map((m, i) => (
          <div className="grade-row" key={i}>
            <div className="grade-name"><strong>{m.course}</strong> · {m.topic}</div>
            <div className="grade-weight" style={{ width: "auto", fontSize: "0.68rem" }}>{m.meta}</div>
            <div className={"grade-score " + m.cls} style={m.cls ? undefined : { color: "var(--text-muted)" }}>{m.score}</div>
          </div>
        ))}
        <div style={{ marginTop: "0.85rem", paddingTop: "0.75rem", borderTop: "1px dashed var(--border)", fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--forest)", display: "inline-block" }} /> Active — regularly reviewed</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ochre)", display: "inline-block" }} /> Stale — 14+ days since last attempt</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-muted)", display: "inline-block" }} /> Not enough data — fewer than 3 attempts</span>
        </div>
      </div>
    </div>
  );
}
