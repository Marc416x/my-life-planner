"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Trash2, Plus, Pencil, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { useCollapsibleForm } from "@/lib/use-collapsible-form";
import { DetailSheet, DetailRow } from "@/components/detail-sheet";
import { PageHeader, Card, StatCard, Field, Input, Select, Textarea, Button, EmptyState } from "@/components/kit";

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
  const [detail, setDetail] = useState<Quiz | null>(null);

  // Add-quiz form (open/close + auto-scroll via the shared hook).
  const { open: formOpen, formRef, openForm, closeForm: collapseForm, scrollFormIntoView } = useCollapsibleForm();
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
  const [editingId, setEditingId] = useState<string | null>(null);

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

  function resetForm() {
    setEditingId(null);
    setFormError("");
    setFName("");
    setFDate("");
    setFScore("");
    setFTime("");
    setFTopics("");
    setFNotes("");
  }

  function openAdd() {
    resetForm();
    openForm();
  }

  function openEditQuiz(q: Quiz) {
    setEditingId(q.id);
    setFormError("");
    setFCourse(q.course_id);
    setFName(q.name);
    setFDate(q.taken_on ?? "");
    setFScore(q.score != null ? String(q.score) : "");
    setFMax(q.max_score != null ? String(q.max_score) : "100");
    setFTime(q.time_min != null ? String(q.time_min) : "");
    setFTopics(q.topics ?? "");
    setFDifficulty(q.difficulty ?? DIFFICULTIES[1]);
    setFNotes(q.notes ?? "");
    setDetail(null);
    if (!formOpen) openForm();
    else scrollFormIntoView();
  }

  async function saveQuiz() {
    if (!userId) return;
    if (!fCourse) { setFormError("Add a course first."); return; }
    if (!fName.trim()) { setFormError("Name the quiz."); return; }
    const score = fScore === "" ? null : Number(fScore);
    const max = fMax === "" ? null : Number(fMax);
    if (score == null || max == null || !(max > 0)) { setFormError("Enter a score and a max score above 0."); return; }
    setFormError("");

    const fields = {
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
    const cols = "id, course_id, name, topics, difficulty, score, max_score, time_min, taken_on, notes";

    if (editingId) {
      const { data, error } = await supabase.from("quizzes").update(fields).eq("id", editingId).select(cols).single();
      if (error || !data) { setFormError("Could not save — please try again."); return; }
      setQuizzes((xs) => xs.map((x) => (x.id === editingId ? (data as Quiz) : x)));
      collapseForm();
      resetForm();
      return;
    }

    const { data, error } = await supabase.from("quizzes").insert({ user_id: userId, ...fields }).select(cols).single();
    if (error || !data) { setFormError("Could not save — please try again."); return; }
    setQuizzes((xs) => [data as Quiz, ...xs]);
    // Reset the per-attempt fields, keep course/difficulty for quick repeat entry.
    setFName("");
    setFDate("");
    setFScore("");
    setFTime("");
    setFTopics("");
    setFNotes("");
    scrollFormIntoView();
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
      <PageHeader
        icon={<ClipboardList size={22} />}
        title="Quizzes"
        subtitle="Track your quiz performance across all courses"
        actions={!formOpen ? (
          <Button className="k-desktop-only" onClick={openAdd}>
            <Plus size={16} /> New Quiz
          </Button>
        ) : undefined}
      />

      <div className="k-stats-grid" style={{ marginBottom: "1.5rem" }}>
        <StatCard tone="terracotta" label="Quizzes Recorded" value={quizzes.length} sub={`${scored.length} with a score`} />
        <StatCard tone="olive" label="Average Score" value={avgPct != null ? `${avgPct}%` : "—"} sub="Across all attempts" />
        <StatCard tone="forest" label="Best Score" value={bestPct != null ? `${bestPct}%` : "—"} sub="Your top result" />
        <StatCard tone="ochre" label="Avg Time" value={avgTime != null ? `${avgTime}m` : "—"} sub="Per attempt" />
      </div>

      {loading ? (
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
      ) : quizzes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList size={26} />}
            title="No quizzes yet"
            description="Record your first result to start tracking your practice performance."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.map((q) => {
            const pct = q.score != null && q.max_score ? Math.round((q.score / q.max_score) * 1000) / 10 : null;
            const badge = difficultyBadge(q.difficulty);
            return (
              <div
                key={q.id}
                onClick={() => setDetail(q)}
                role="button"
                aria-label={`${q.name} quiz — view details`}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--s-radius-sm)", padding: "1.25rem", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{courseName(q.course_id)} — {q.name}</div>
                    <div style={{ display: "flex", gap: "0.4rem", marginTop: 4, flexWrap: "wrap" }}>
                      {q.difficulty && <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 10, background: badge.bg, color: badge.color }}>{q.difficulty}</span>}
                      {q.time_min != null && <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 10, background: "var(--forest-light)", color: "var(--forest)" }}>{q.time_min} min</span>}
                      {q.taken_on && <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 10, background: "var(--bg-elevated, var(--ochre-light))", color: "var(--text-muted)" }}>{q.taken_on}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                    <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.5rem", fontWeight: 700, color: pct != null ? scoreColor(pct) : "var(--text-muted)" }}>{pct != null ? `${pct}%` : "—"}</div>
                    <button onClick={(e) => { e.stopPropagation(); requestDelete(q); }} aria-label="Delete quiz" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2 }}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={13} /> Score: {q.score}/{q.max_score}</div>
                  {q.time_min != null && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={13} /> Time: {q.time_min} min</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile: the "New" action sits at the bottom-left of the list. */}
      {!formOpen && (
        <div className="k-mobile-only k-mobile-add">
          <Button onClick={openAdd}><Plus size={16} /> New Quiz</Button>
        </div>
      )}

      {/* ADD QUIZ RESULT */}
      {formOpen && (
        <div ref={formRef} style={{ scrollMarginTop: "1rem", marginTop: "1.5rem" }}>
          <Card title={editingId ? "Edit Quiz Result" : "Add Quiz Result"} icon={editingId ? <Pencil size={20} /> : <ClipboardList size={20} />}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "0.75rem" }}>
              <Field label="Course" htmlFor="q-course">
                <Select id="q-course" value={fCourse} onChange={(e) => { setFCourse(e.target.value); if (formError) setFormError(""); }}>
                  {courses.length ? courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>) : <option value="">Add a course first</option>}
                </Select>
              </Field>
              <Field label="Quiz Name" htmlFor="q-name"><Input id="q-name" value={fName} onChange={(e) => { setFName(e.target.value); if (formError) setFormError(""); }} placeholder="e.g., Quiz 3 — Antibiotics" /></Field>
              <Field label="Date Taken" htmlFor="q-date"><Input id="q-date" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
              <Field label="Score" htmlFor="q-score"><Input id="q-score" type="number" min="0" value={fScore} onChange={(e) => { setFScore(e.target.value); if (formError) setFormError(""); }} placeholder="85" /></Field>
              <Field label="Max Score" htmlFor="q-max"><Input id="q-max" type="number" min="0" value={fMax} onChange={(e) => { setFMax(e.target.value); if (formError) setFormError(""); }} placeholder="100" /></Field>
              <Field label="Time Taken (min)" htmlFor="q-time"><Input id="q-time" type="number" min="0" value={fTime} onChange={(e) => setFTime(e.target.value)} placeholder="30" /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
              <Field label="Topics Covered" htmlFor="q-topics"><Input id="q-topics" value={fTopics} onChange={(e) => setFTopics(e.target.value)} placeholder="Antibiotics, Dosage, Side effects" /></Field>
              <Field label="Difficulty" htmlFor="q-diff"><Select id="q-diff" value={fDifficulty} onChange={(e) => setFDifficulty(e.target.value)}>{DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}</Select></Field>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <Field label="Notes" htmlFor="q-notes"><Textarea id="q-notes" value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="What was challenging? What went well?" /></Field>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "1.1rem" }}>
              <Button onClick={(e) => { e.currentTarget.blur(); saveQuiz(); }}>{editingId ? "Save changes" : "Add Quiz"}</Button>
              <Button variant="outline" onClick={() => { collapseForm(); resetForm(); }}>{editingId ? "Cancel" : "Done"}</Button>
              {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
            </div>
          </Card>
        </div>
      )}

      <DetailSheet
        open={!!detail}
        onOpenChange={(o) => { if (!o) setDetail(null); }}
        title={detail ? `${courseName(detail.course_id)} — ${detail.name}` : ""}
      >
        {detail && (() => {
          const pct = detail.score != null && detail.max_score ? Math.round((detail.score / detail.max_score) * 1000) / 10 : null;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <DetailRow label="Score">{detail.score != null && detail.max_score != null ? `${detail.score}/${detail.max_score}${pct != null ? ` (${pct}%)` : ""}` : "—"}</DetailRow>
                {detail.difficulty && <DetailRow label="Difficulty">{detail.difficulty}</DetailRow>}
                {detail.time_min != null && <DetailRow label="Time">{detail.time_min} min</DetailRow>}
                {detail.taken_on && <DetailRow label="Date taken">{detail.taken_on}</DetailRow>}
              </div>
              {detail.topics && <DetailRow label="Topics covered">{detail.topics}</DetailRow>}
              {detail.notes && <DetailRow label="Notes">{detail.notes}</DetailRow>}
              <div style={{ marginTop: "0.25rem" }}>
                <Button size="sm" variant="outline" onClick={() => openEditQuiz(detail)}><Pencil size={13} /> Edit</Button>
              </div>
            </div>
          );
        })()}
      </DetailSheet>
    </div>
  );
}
