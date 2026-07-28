"use client";

import { useEffect, useRef, useState } from "react";
import { AlarmClock, Plus, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { useCollapsibleForm } from "@/lib/use-collapsible-form";
import { PageHeader, Card, Section, Field, Input, Select, Button, EmptyState } from "@/components/kit";

type Course = { id: string; name: string; code: string | null };

type Exam = {
  id: string;
  course_id: string;
  name: string;
  exam_date: string | null;
  weight_pct: number | null;
  planned_sessions: number | null;
  confidence: number | null;
  topics: string | null;
};

const EXAM_COLS = "id, course_id, name, exam_date, weight_pct, planned_sessions, confidence, topics";

const CONFIDENCE = [
  { v: 1, label: "1 - Very Low" },
  { v: 2, label: "2 - Low" },
  { v: 3, label: "3 - Medium" },
  { v: 4, label: "4 - High" },
  { v: 5, label: "5 - Very High" },
];

// Whole days from local "today" to an exam date, parsed at local midnight so
// there's no UTC off-by-one. Negative = the exam is in the past.
function daysUntil(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// Countdown badge palette by urgency (past due & <=1wk are terracotta).
function countdownStyle(days: number | null) {
  if (days == null) return { bg: "var(--olive-light)", color: "var(--olive)" };
  if (days <= 7) return { bg: "var(--terracotta-light)", color: "var(--terracotta)" };
  if (days <= 21) return { bg: "var(--ochre-light)", color: "#7A5A10" };
  return { bg: "var(--olive-light)", color: "var(--olive)" };
}

function confColor(c: number) {
  if (c >= 3) return "var(--olive)";
  if (c === 2) return "var(--ochre)";
  return "var(--terracotta)";
}

function sortExams(xs: Exam[]) {
  // Soonest date first; undated exams sink to the bottom.
  return [...xs].sort((a, b) => {
    if (!a.exam_date) return 1;
    if (!b.exam_date) return -1;
    return a.exam_date.localeCompare(b.exam_date);
  });
}

function ConfDots({ filled }: { filled: number }) {
  return (
    <div className="confidence-bar">
      {[0, 1, 2, 3, 4].map((i) => (
        <div className={"conf-dot" + (i < filled ? " filled" : "")} key={i} />
      ))}
    </div>
  );
}

export default function ExamsPage() {
  const supabase = createClient();
  const toast = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Add / edit form state. Open/close + auto-scroll handled by the shared hook.
  const { open: formOpen, formRef, openForm, closeForm: collapseForm, scrollFormIntoView } = useCollapsibleForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fCourse, setFCourse] = useState("");
  const [fName, setFName] = useState("");
  const [fDate, setFDate] = useState("");
  const [fWeight, setFWeight] = useState("");
  const [fSessions, setFSessions] = useState("");
  const [fConfidence, setFConfidence] = useState(3);
  const [fTopics, setFTopics] = useState("");
  const [formError, setFormError] = useState("");

  const pending = useRef<Map<string, { item: Exam; timeout: number }>>(new Map());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const [{ data: courseRows }, { data: examRows }] = await Promise.all([
        supabase.from("courses").select("id, name, code").order("created_at", { ascending: true }),
        supabase.from("exams").select(EXAM_COLS).order("exam_date", { ascending: true, nullsFirst: false }),
      ]);
      setCourses((courseRows as Course[]) ?? []);
      setExams(sortExams((examRows as Exam[]) ?? []));
      if (courseRows && courseRows.length) setFCourse((courseRows[0] as Course).id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetFields() {
    setFName("");
    setFDate("");
    setFWeight("");
    setFSessions("");
    setFConfidence(3);
    setFTopics("");
    if (courses.length) setFCourse(courses[0].id);
  }

  function openAdd() {
    setEditingId(null);
    setFormError("");
    resetFields();
    openForm();
  }

  function openEdit(e: Exam) {
    setEditingId(e.id);
    setFormError("");
    setFCourse(e.course_id);
    setFName(e.name);
    setFDate(e.exam_date ?? "");
    setFWeight(e.weight_pct != null ? String(e.weight_pct) : "");
    setFSessions(e.planned_sessions != null ? String(e.planned_sessions) : "");
    setFConfidence(e.confidence ?? 3);
    setFTopics(e.topics ?? "");
    if (!formOpen) openForm(); // effect scrolls it into view
    else scrollFormIntoView(); // already open — bring it into view now
  }

  function closeForm() {
    setEditingId(null);
    setFormError("");
    collapseForm();
  }

  async function submit() {
    if (!userId) return;
    if (!fCourse) { setFormError("Add a course first."); return; }
    if (!fName.trim()) { setFormError("Name the exam."); return; }
    setFormError("");

    const payload = {
      course_id: fCourse,
      name: fName.trim(),
      exam_date: fDate || null,
      weight_pct: fWeight === "" ? null : Number(fWeight),
      planned_sessions: fSessions === "" ? null : Number(fSessions),
      confidence: fConfidence,
      topics: fTopics.trim() || null,
    };

    if (editingId) {
      const { data, error } = await supabase.from("exams").update(payload).eq("id", editingId).select(EXAM_COLS).single();
      if (error || !data) { setFormError("Could not save — please try again."); return; }
      setExams((xs) => sortExams(xs.map((x) => (x.id === editingId ? (data as Exam) : x))));
      closeForm();
    } else {
      const { data, error } = await supabase.from("exams").insert({ user_id: userId, ...payload }).select(EXAM_COLS).single();
      if (error || !data) { setFormError("Could not save — please try again."); return; }
      setExams((xs) => sortExams([...xs, data as Exam]));
      // Keep course & confidence for quick repeat entry; clear the rest and
      // keep the form in view (the list above just grew).
      setFName("");
      setFDate("");
      setFWeight("");
      setFSessions("");
      setFTopics("");
      scrollFormIntoView();
    }
  }

  function requestDelete(e: Exam) {
    if (editingId === e.id) closeForm();
    setExams((xs) => xs.filter((x) => x.id !== e.id));
    const timeout = window.setTimeout(async () => {
      pending.current.delete(e.id);
      await supabase.from("exams").delete().eq("id", e.id);
    }, 5000);
    pending.current.set(e.id, { item: e, timeout });
    toast.show("Exam deleted", {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = pending.current.get(e.id);
        if (!p) return;
        clearTimeout(p.timeout);
        pending.current.delete(e.id);
        setExams((xs) => sortExams([...xs, p.item]));
      },
    });
  }

  return (
    <div className="page active">
      <PageHeader
        icon={<AlarmClock size={22} />}
        title="Exams"
        subtitle="Prepare strategically, perform confidently"
        actions={!formOpen ? (
          <Button className="k-desktop-only" onClick={openAdd}>
            <Plus size={16} /> Add Exam
          </Button>
        ) : undefined}
      />

      {/* UPCOMING EXAMS */}
      <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}><AlarmClock size={18} /> Upcoming Exams</span>}>
        {loading ? (
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
        ) : exams.length === 0 ? (
          <Card>
            <EmptyState
              icon={<AlarmClock size={26} />}
              title="No exams scheduled yet"
              description="Add your first exam to start the countdown and plan your study sessions."
            />
          </Card>
        ) : (
          exams.map((e) => {
            const course = courses.find((c) => c.id === e.course_id);
            const days = e.exam_date ? daysUntil(e.exam_date) : null;
            const badge = countdownStyle(days);
            let numText: string | number = "—";
            let labelText = "No date";
            if (days != null) {
              if (days < 0) { numText = Math.abs(days); labelText = Math.abs(days) === 1 ? "day ago" : "days ago"; }
              else if (days === 0) { numText = 0; labelText = "Today"; }
              else { numText = days; labelText = days === 1 ? "day left" : "days left"; }
            }
            const meta = [
              course?.code,
              e.weight_pct != null ? `Weight: ${e.weight_pct}%` : null,
              e.planned_sessions != null ? `${e.planned_sessions} session${e.planned_sessions === 1 ? "" : "s"} planned` : null,
            ].filter(Boolean).join(" · ");
            const conf = e.confidence ?? 0;
            return (
              <div className="exam-card" key={e.id}>
                <div className="exam-countdown" style={{ background: badge.bg }}>
                  <div className="countdown-num" style={{ color: badge.color }}>{numText}</div>
                  <div className="countdown-label">{labelText}</div>
                </div>
                <div className="exam-info">
                  <div className="exam-name">{course?.name ? `${course.name} ` : ""}{e.name}</div>
                  {meta && <div className="exam-course">{meta}</div>}
                  {e.topics && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>Topics: {e.topics}</div>}
                  {conf > 0 && <ConfDots filled={conf} />}
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                  {conf > 0 && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Confidence</div>
                      <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.2rem", color: confColor(conf) }}>{conf}/5</div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    <button onClick={() => openEdit(e)} aria-label="Edit exam" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2 }}><Pencil size={15} /></button>
                    <button onClick={() => requestDelete(e)} aria-label="Delete exam" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2 }}><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Section>

      {/* Mobile: the "New" action sits at the bottom-left of the list. */}
      {!formOpen && (
        <div className="k-mobile-only k-mobile-add">
          <Button onClick={openAdd}><Plus size={16} /> Add Exam</Button>
        </div>
      )}

      {/* ADD / EDIT EXAM */}
      {formOpen && (
        <div ref={formRef} style={{ scrollMarginTop: "1rem" }}>
          <Card title={editingId ? "Edit Exam" : "Add Exam"} icon={<AlarmClock size={20} />}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "0.75rem" }}>
              <Field label="Course" htmlFor="e-course">
                <Select id="e-course" value={fCourse} onChange={(e) => { setFCourse(e.target.value); if (formError) setFormError(""); }}>
                  {courses.length ? courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>) : <option value="">Add a course first</option>}
                </Select>
              </Field>
              <Field label="Exam Name" htmlFor="e-name"><Input id="e-name" value={fName} onChange={(e) => { setFName(e.target.value); if (formError) setFormError(""); }} placeholder="e.g., Mid-Term" /></Field>
              <Field label="Exam Date" htmlFor="e-date"><Input id="e-date" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
              <Field label="Weight %" htmlFor="e-weight"><Input id="e-weight" type="number" min="0" max="100" value={fWeight} onChange={(e) => setFWeight(e.target.value)} placeholder="e.g., 30" /></Field>
              <Field label="Planned Sessions" htmlFor="e-sessions"><Input id="e-sessions" type="number" min="0" value={fSessions} onChange={(e) => setFSessions(e.target.value)} placeholder="5" /></Field>
              <Field label="Confidence Level" htmlFor="e-conf">
                <Select id="e-conf" value={fConfidence} onChange={(e) => setFConfidence(Number(e.target.value))}>
                  {CONFIDENCE.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                </Select>
              </Field>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <Field label="Topics to Cover" htmlFor="e-topics">
                <Input id="e-topics" value={fTopics} onChange={(e) => setFTopics(e.target.value)} placeholder="Enter topics separated by commas" />
              </Field>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "1.1rem" }}>
              <Button onClick={(e) => { e.currentTarget.blur(); submit(); }}>{editingId ? "Save Changes" : "Add Exam"}</Button>
              <Button variant="outline" onClick={closeForm}>{editingId ? "Cancel" : "Done"}</Button>
              {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
