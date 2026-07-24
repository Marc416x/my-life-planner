"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Trash2, ChevronDown, Plus, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";

type Course = { id: string; name: string };

type Quiz = {
  id: string;
  course_id: string;
  name: string;
  topics: string | null;
  difficulty: string | null;
  score: number | null;
  max_score: number | null;
  time_min: number | null;
  taken_on: string | null;
  notes: string | null;
};

const DIFFICULTIES = ["Easy", "Medium", "Hard"];

// Score → the same grade colours the Grades page uses (via --olive/--ochre/…).
function scoreColor(pct: number) {
  if (pct >= 90) return "var(--olive)";
  if (pct >= 80) return "var(--forest)";
  if (pct >= 70) return "var(--ochre)";
  return "var(--terracotta)";
}

// Difficulty badge palette, matching the prototype cards.
function difficultyBadge(d: string | null): { bg: string; color: string } {
  switch (d) {
    case "Easy": return { bg: "var(--olive-light)", color: "var(--olive-dark)" };
    case "Hard": return { bg: "var(--terracotta-light)", color: "var(--terracotta-dark)" };
    default: return { bg: "var(--ochre-light)", color: "#7A5A10" }; // Medium / unknown
  }
}

export default function QuizzesPage() {
  const supabase = createClient();
  const toast = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add-quiz form state.
  const [formOpen, setFormOpen] = useState(false);
  const [fCourse, setFCourse] = useState("");
  const [fName, setFName] = useState("");
  const [fDate, setFDate] = useState("");
  const [fScore, setFScore] = useState("");
  const [fMax, setFMax] = useState("100");
  const [fTime, setFTime] = useState("");
  const [fTopics, setFTopics] = useState("");
  const [fDifficulty, setFDifficulty] = useState(DIFFICULTIES[1]);
  const [fNotes, setFNotes] = useState("");
  const [formError, setFormError] = useState("");

  const pending = useRef<Map<string, { item: Quiz; timeout: number }>>(new Map());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const [{ data: courseRows }, { data: quizRows }] = await Promise.all([
        supabase.from("courses").select("id, name").order("created_at", { ascending: true }),
        supabase.from("quizzes").select("id, course_id, name, topics, difficulty, score, max_score, time_min, taken_on, notes").order("taken_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
      ]);
      setCourses((courseRows as Course[]) ?? []);
      setQuizzes((quizRows as Quiz[]) ?? []);
      if (courseRows && courseRows.length) setFCourse((courseRows[0] as Course).id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "—";

  // Summary across all recorded attempts.
  const scored = quizzes.filter((q) => q.score != null && q.max_score != null && (q.max_score as number) > 0);
  const pctOf = (q: Quiz) => ((q.score as number) / (q.max_score as number)) * 100;
  const avgPct = scored.length
    ? Math.round((scored.reduce((s, q) => s + pctOf(q), 0) / scored.length) * 10) / 10
    : null;
  const bestPct = scored.length ? Math.round(Math.max(...scored.map(pctOf)) * 10) / 10 : null;
  const timed = quizzes.filter((q) => q.time_min != null);
  const avgTime = timed.length ? Math.round(timed.reduce((s, q) => s + (q.time_min as number), 0) / timed.length) : null;

  async function addQuiz() {
    if (!userId) return;
    if (!fCourse) { setFormError("Add a course first."); return; }
    if (!fName.trim()) { setFormError("Name the quiz."); return; }
    const score = fScore === "" ? null : Number(fScore);
    const max = fMax === "" ? null : Number(fMax);
    if (score == null || max == null || !(max > 0)) { setFormError("Enter a score and a max score above 0."); return; }
    setFormError("");

    const payload = {
      user_id: userId,
      course_id: fCourse,
      name: fName.trim(),
      topics: fTopics.trim() || null,
      difficulty: fDifficulty,
      score,
      max_score: max,
      time_min: fTime === "" ? null : Number(fTime),
      taken_on: fDate || null,
      notes: fNotes.trim() || null,
    };
    const { data, error } = await supabase.from("quizzes").insert(payload).select("id, course_id, name, topics, difficulty, score, max_score, time_min, taken_on, notes").single();
    if (error || !data) { setFormError("Could not save — please try again."); return; }

    setQuizzes((xs) => [data as Quiz, ...xs]);
    // Reset the per-attempt fields, keep course/difficulty for quick repeat entry.
    setFName("");
    setFDate("");
    setFScore("");
    setFTime("");
    setFTopics("");
    setFNotes("");
  }

  function requestDelete(q: Quiz) {
    setQuizzes((xs) => xs.filter((x) => x.id !== q.id));
    const timeout = window.setTimeout(async () => {
      pending.current.delete(q.id);
      await supabase.from("quizzes").delete().eq("id", q.id);
    }, 5000);
    pending.current.set(q.id, { item: q, timeout });
    toast.show("Quiz deleted", {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = pending.current.get(q.id);
        if (!p) return;
        clearTimeout(p.timeout);
        pending.current.delete(q.id);
        setQuizzes((xs) => [p.item, ...xs.filter((x) => x.id !== q.id)]);
      },
    });
  }

  return (
    <div className="page active">
      <div className="page-header">
        <h1>Quizzes</h1>
        <p>Track your quiz performance across all courses</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Quizzes Recorded</div>
          <div className="stat-val">{quizzes.length}</div>
          <div className="stat-sub">{scored.length} with a score</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Average Score</div>
          <div className="stat-val">{avgPct != null ? `${avgPct}%` : "—"}</div>
          <div className="stat-sub">Across all attempts</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Best Score</div>
          <div className="stat-val">{bestPct != null ? `${bestPct}%` : "—"}</div>
          <div className="stat-sub">Your top result</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Time</div>
          <div className="stat-val">{avgTime != null ? `${avgTime}m` : "—"}</div>
          <div className="stat-sub">Per attempt</div>
        </div>
      </div>

      <div className="form-section">
        <button
          onClick={() => setFormOpen((o) => !o)}
          aria-expanded={formOpen}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", color: "inherit", textAlign: "left" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 600, fontSize: "1.05rem" }}>
            {formOpen ? <ClipboardList size={18} /> : <Plus size={18} />} Add Quiz Result
          </span>
          <ChevronDown size={18} style={{ transition: "transform 0.15s", transform: formOpen ? "rotate(180deg)" : "none", color: "var(--text-muted)" }} />
        </button>

        {formOpen && (
        <div style={{ marginTop: "0.85rem" }}>
        <div className="input-row three">
          <div className="field-group"><div className="field-label">Course</div>
            <select className="field-select" value={fCourse} onChange={(e) => { setFCourse(e.target.value); if (formError) setFormError(""); }}>
              {courses.length ? courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>) : <option value="">Add a course first</option>}
            </select>
          </div>
          <div className="field-group"><div className="field-label">Quiz Name</div><input className="field-input" value={fName} onChange={(e) => { setFName(e.target.value); if (formError) setFormError(""); }} placeholder="e.g., Quiz 3 — Antibiotics" /></div>
          <div className="field-group"><div className="field-label">Date Taken</div><input className="field-input" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} /></div>
        </div>
        <div className="input-row three">
          <div className="field-group"><div className="field-label">Score</div><input className="field-input" type="number" min="0" value={fScore} onChange={(e) => { setFScore(e.target.value); if (formError) setFormError(""); }} placeholder="85" /></div>
          <div className="field-group"><div className="field-label">Max Score</div><input className="field-input" type="number" min="0" value={fMax} onChange={(e) => { setFMax(e.target.value); if (formError) setFormError(""); }} placeholder="100" /></div>
          <div className="field-group"><div className="field-label">Time Taken (min)</div><input className="field-input" type="number" min="0" value={fTime} onChange={(e) => setFTime(e.target.value)} placeholder="30" /></div>
        </div>
        <div className="input-row">
          <div className="field-group"><div className="field-label">Topics Covered</div><input className="field-input" value={fTopics} onChange={(e) => setFTopics(e.target.value)} placeholder="Antibiotics, Dosage, Side effects" /></div>
          <div className="field-group"><div className="field-label">Difficulty</div><select className="field-select" value={fDifficulty} onChange={(e) => setFDifficulty(e.target.value)}>{DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}</select></div>
        </div>
        <div className="input-row single"><div className="field-group"><div className="field-label">Notes</div><textarea className="field-textarea" value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="What was challenging? What went well?" /></div></div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn-add" onClick={(e) => { e.currentTarget.blur(); addQuiz(); }}>+ Add Quiz</button>
          {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
        </div>
        </div>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
      ) : quizzes.length === 0 ? (
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "2rem 1rem", fontStyle: "italic", textAlign: "center" }}>
          No quizzes yet — record your first result above to start tracking your practice performance.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.map((q) => {
            const pct = q.score != null && q.max_score ? Math.round((q.score / q.max_score) * 1000) / 10 : null;
            const badge = difficultyBadge(q.difficulty);
            const expanded = expandedId === q.id;
            const hasDetail = !!(q.notes || q.topics);
            return (
              <div
                key={q.id}
                onClick={() => hasDetail && setExpandedId(expanded ? null : q.id)}
                role={hasDetail ? "button" : undefined}
                aria-expanded={hasDetail ? expanded : undefined}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "1.25rem", cursor: hasDetail ? "pointer" : "default" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{courseName(q.course_id)} — {q.name}</div>
                    {q.topics && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{q.topics}</div>}
                    <div style={{ display: "flex", gap: "0.4rem", marginTop: 4, flexWrap: "wrap" }}>
                      {q.difficulty && <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 10, background: badge.bg, color: badge.color }}>{q.difficulty}</span>}
                      {q.time_min != null && <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 10, background: "var(--forest-light)", color: "var(--forest)" }}>{q.time_min} min</span>}
                      {q.taken_on && <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 10, background: "var(--bg-elevated, var(--ochre-light))", color: "var(--text-muted)" }}>{q.taken_on}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.5rem", fontWeight: 700, color: pct != null ? scoreColor(pct) : "var(--text-muted)" }}>{pct != null ? `${pct}%` : "—"}</div>
                    <button onClick={(e) => { e.stopPropagation(); requestDelete(q); }} aria-label="Delete quiz" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2 }}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={13} /> Score: {q.score}/{q.max_score}</div>
                  {q.time_min != null && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={13} /> Time: {q.time_min} min</div>}
                </div>
                {hasDetail && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: "0.6rem", fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    {expanded ? "Hide details" : "View details"}
                    <ChevronDown size={13} style={{ transition: "transform 0.15s", transform: expanded ? "rotate(180deg)" : "none" }} />
                  </div>
                )}
                {expanded && (
                  <div style={{ marginTop: "0.6rem", paddingTop: "0.75rem", borderTop: "1px dashed var(--border)", fontSize: "0.78rem", color: "var(--text-secondary, var(--text-muted))", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {q.topics && (
                      <div>
                        <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 2 }}>Topics Covered</div>
                        {q.topics}
                      </div>
                    )}
                    {q.notes && (
                      <div>
                        <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 2 }}>Notes</div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{q.notes}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
