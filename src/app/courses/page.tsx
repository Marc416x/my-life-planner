"use client";

import { useEffect, useRef, useState } from "react";
import { GraduationCap, CalendarDays, Dumbbell, PenLine, ClipboardList, BookOpen, Pencil, Trash2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";

const cardTitle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "0.45rem" };
const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, marginBottom: 2 };

const SEMESTERS = ["Spring 2026", "Summer 2026", "Fall 2026", "Spring 2027"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];

// Difficulty → accent colour for the "Difficulty" line.
const DIFF_COLOR: Record<string, string> = {
  Easy: "var(--olive)",
  Medium: "var(--ochre)",
  Hard: "var(--terracotta)",
};

// Card accent (top border + course-name colour), cycled by position so every
// course gets a distinct look without storing a colour in the DB.
const ACCENTS = [
  { top: "var(--terracotta)", name: "var(--terracotta)" },
  { top: "var(--olive)", name: "var(--olive-dark)" },
  { top: "var(--forest)", name: "var(--forest)" },
  { top: "var(--ochre)", name: "#7A5A10" },
];

// Grade-point mapping, matching the Grades page, for a projected GPA tile.
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

type Course = {
  id: string;
  name: string;
  code: string | null;
  credits: number | null;
  professor: string | null;
  semester: string | null;
  difficulty: string | null;
  grade_pct: number | null;
  weight_pct: number | null;
};

type AssignmentLite = { course: string | null };
type Book = { id: string; title: string; author: string | null; course: string | null; status: string | null };

// Assignments store a free-text course label ("Pharmacology"); course names may
// be fuller ("Pharmacology II"). Count with a loose, case-insensitive match.
function assignmentCount(courseName: string, assignments: AssignmentLite[]) {
  const n = courseName.trim().toLowerCase();
  if (!n) return 0;
  return assignments.filter((a) => {
    if (!a.course) return false;
    const c = a.course.trim().toLowerCase();
    return c === n || n.startsWith(c) || c.startsWith(n);
  }).length;
}

export default function CoursesPage() {
  const supabase = createClient();
  const toast = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<AssignmentLite[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Add / edit form state (trimmed to the real courses table columns).
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [fName, setFName] = useState("");
  const [fCode, setFCode] = useState("");
  const [fCredits, setFCredits] = useState("");
  const [fProf, setFProf] = useState("");
  const [fSem, setFSem] = useState(SEMESTERS[0]);
  const [fDiff, setFDiff] = useState(DIFFICULTIES[1]);
  const [fGrade, setFGrade] = useState("");
  const [fWeight, setFWeight] = useState("");

  const pending = useRef<Map<string, { item: Course; timeout: number }>>(new Map());
  const formRef = useRef<HTMLDivElement>(null);

  // Academic book library.
  const [books, setBooks] = useState<Book[]>([]);
  const [bookFormOpen, setBookFormOpen] = useState(false);
  const [bTitle, setBTitle] = useState("");
  const [bAuthor, setBAuthor] = useState("");
  const [bCourse, setBCourse] = useState("Pharmacology");
  const [bStatus, setBStatus] = useState("required");
  const bookPending = useRef<Map<string, { item: Book; timeout: number }>>(new Map());
  const bookFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const [{ data: courseRows }, { data: assignRows }, { data: bookRows }] = await Promise.all([
        supabase.from("courses").select("*").order("created_at", { ascending: true }),
        supabase.from("assignments").select("course"),
        supabase.from("reading_list").select("*").eq("kind", "academic").order("created_at", { ascending: true }),
      ]);
      setCourses((courseRows as Course[]) ?? []);
      setAssignments((assignRows as AssignmentLite[]) ?? []);
      setBooks((bookRows as Book[]) ?? []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll the add/edit form into view when it expands.
  useEffect(() => {
    if (formOpen) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [formOpen]);
  useEffect(() => {
    if (bookFormOpen) bookFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [bookFormOpen]);

  // Stats.
  const totalCredits = courses.reduce((s, c) => s + (c.credits ?? 0), 0);
  const graded = courses.filter((c) => c.grade_pct != null);
  const avgGrade = graded.length ? Math.round(graded.reduce((s, c) => s + (c.grade_pct ?? 0), 0) / graded.length) : 0;
  const gpaCourses = courses.filter((c) => c.grade_pct != null && (c.credits ?? 0) > 0);
  const gpaCredits = gpaCourses.reduce((s, c) => s + (c.credits ?? 0), 0);
  const gpa = gpaCredits
    ? (gpaCourses.reduce((s, c) => s + pctToGradePoint(c.grade_pct as number) * (c.credits ?? 0), 0) / gpaCredits).toFixed(2)
    : "—";

  function resetForm() {
    setEditingId(null);
    setFormError("");
    setFName("");
    setFCode("");
    setFCredits("");
    setFProf("");
    setFSem(SEMESTERS[0]);
    setFDiff(DIFFICULTIES[1]);
    setFGrade("");
    setFWeight("");
  }
  function openAdd() {
    resetForm();
    setFormOpen(true);
  }
  function openEdit(c: Course) {
    setFormError("");
    setEditingId(c.id);
    setFName(c.name);
    setFCode(c.code ?? "");
    setFCredits(c.credits != null ? String(c.credits) : "");
    setFProf(c.professor ?? "");
    setFSem(c.semester ?? SEMESTERS[0]);
    setFDiff(c.difficulty ?? DIFFICULTIES[1]);
    setFGrade(c.grade_pct != null ? String(c.grade_pct) : "");
    setFWeight(c.weight_pct != null ? String(c.weight_pct) : "");
    setFormOpen(true);
  }

  async function submit() {
    if (!fName.trim()) {
      setFormError("Please add a course name.");
      return;
    }
    if (!userId) return;
    setFormError("");
    const payload = {
      name: fName.trim(),
      code: fCode.trim() || null,
      credits: fCredits === "" ? null : Number(fCredits),
      professor: fProf.trim() || null,
      semester: fSem,
      difficulty: fDiff,
      grade_pct: fGrade === "" ? null : Number(fGrade),
      weight_pct: fWeight === "" ? null : Number(fWeight),
    };
    if (editingId) {
      const { data } = await supabase.from("courses").update(payload).eq("id", editingId).select().single();
      if (data) setCourses((xs) => xs.map((x) => (x.id === editingId ? (data as Course) : x)));
    } else {
      const { data } = await supabase.from("courses").insert({ user_id: userId, ...payload }).select().single();
      if (data) setCourses((xs) => [...xs, data as Course]);
    }
    setFormOpen(false);
    resetForm();
  }

  function requestDelete(c: Course) {
    if (editingId === c.id) { setFormOpen(false); resetForm(); }
    setCourses((xs) => xs.filter((x) => x.id !== c.id));
    const timeout = window.setTimeout(async () => {
      pending.current.delete(c.id);
      await supabase.from("courses").delete().eq("id", c.id);
    }, 5000);
    pending.current.set(c.id, { item: c, timeout });
    toast.show("Course deleted", {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = pending.current.get(c.id);
        if (!p) return;
        clearTimeout(p.timeout);
        pending.current.delete(c.id);
        setCourses((xs) => [...xs, p.item]);
      },
    });
  }

  async function addBook() {
    if (!bTitle.trim() || !userId) return;
    const { data, error } = await supabase
      .from("reading_list")
      .insert({ user_id: userId, title: bTitle.trim(), author: bAuthor.trim() || null, course: bCourse, status: bStatus, kind: "academic" })
      .select()
      .single();
    if (!error && data) setBooks((b) => [...b, data as Book]);
    // Keep the form open so several books can be added in a row.
    setBTitle("");
    setBAuthor("");
  }

  function requestDeleteBook(b: Book) {
    setBooks((xs) => xs.filter((x) => x.id !== b.id));
    const timeout = window.setTimeout(async () => {
      bookPending.current.delete(b.id);
      await supabase.from("reading_list").delete().eq("id", b.id);
    }, 5000);
    bookPending.current.set(b.id, { item: b, timeout });
    toast.show("Book deleted", {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = bookPending.current.get(b.id);
        if (!p) return;
        clearTimeout(p.timeout);
        bookPending.current.delete(b.id);
        setBooks((xs) => [...xs, p.item]);
      },
    });
  }

  return (
    <div className="page active">
      <div className="page-header">
        <h1>Courses</h1>
        <p>Manage your nursing subjects</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Courses</div><div className="stat-val">{courses.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total Credits</div><div className="stat-val">{totalCredits}</div></div>
        <div className="stat-card"><div className="stat-label">Avg Grade</div><div className="stat-val" style={{ color: "var(--olive)" }}>{graded.length ? `${avgGrade}%` : "—"}</div><div className="progress-bar"><div className="progress-fill fill-olive" style={{ width: `${avgGrade}%` }} /></div></div>
        <div className="stat-card"><div className="stat-label">Projected GPA</div><div className="stat-val">{gpa}</div></div>
      </div>

      {/* Course cards */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem", fontStyle: "italic" }}>Loading…</div>
        ) : courses.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem", fontStyle: "italic" }}>
            No courses yet — add your first one below.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map((c, i) => {
              const accent = ACCENTS[i % ACCENTS.length];
              const diffColor = c.difficulty ? DIFF_COLOR[c.difficulty] ?? "var(--text-muted)" : "var(--text-muted)";
              const count = assignmentCount(c.name, assignments);
              return (
                <div
                  key={c.id}
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "1.25rem", borderTop: `3px solid ${accent.top}` }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem", color: accent.name, fontFamily: "var(--font-caveat), cursive", marginBottom: 4 }}>{c.name}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {c.code || "—"}{c.credits != null ? ` · ${c.credits} credit${c.credits === 1 ? "" : "s"}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0 }}>
                      <button onClick={() => openEdit(c)} aria-label="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2 }}><Pencil size={15} /></button>
                      <button onClick={() => requestDelete(c)} aria-label="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2 }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <div className="wave-decoration" />
                  <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                    <div style={row}><GraduationCap size={14} /> Professor: <strong>{c.professor || "—"}</strong></div>
                    <div style={row}><CalendarDays size={14} /> Semester: <strong>{c.semester || "—"}</strong></div>
                    <div style={row}><Dumbbell size={14} /> Difficulty: <strong style={{ color: diffColor }}>{c.difficulty || "—"}</strong></div>
                    <div style={row}><PenLine size={14} /> Current Grade: <strong style={{ color: "var(--olive)" }}>{c.grade_pct != null ? `${c.grade_pct}%` : "—"}</strong></div>
                    <div style={row}><ClipboardList size={14} /> Assignments: <strong>{count}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit course */}
      {!formOpen && (
        <button className="btn-add" onClick={openAdd} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <Plus size={16} /> New Course
        </button>
      )}
      {formOpen && (
        <div className="form-section" ref={formRef} style={{ scrollMarginTop: "1rem" }}>
          <h3>{editingId ? "Edit Course" : "Add New Course"}</h3>
          <div className="input-row three">
            <div className="field-group"><div className="field-label">Course Name</div><input className="field-input" value={fName} onChange={(e) => { setFName(e.target.value); if (formError) setFormError(""); }} placeholder="e.g., Pharmacology" /></div>
            <div className="field-group"><div className="field-label">Course Code</div><input className="field-input" value={fCode} onChange={(e) => setFCode(e.target.value)} placeholder="e.g., NUR301" /></div>
            <div className="field-group"><div className="field-label">Credits</div><input className="field-input" type="number" min="0" value={fCredits} onChange={(e) => setFCredits(e.target.value)} placeholder="3" /></div>
          </div>
          <div className="input-row three">
            <div className="field-group"><div className="field-label">Professor Name</div><input className="field-input" value={fProf} onChange={(e) => setFProf(e.target.value)} placeholder="Dr. Smith" /></div>
            <div className="field-group"><div className="field-label">Semester</div><select className="field-select" value={fSem} onChange={(e) => setFSem(e.target.value)}>{SEMESTERS.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="field-group"><div className="field-label">Difficulty</div><select className="field-select" value={fDiff} onChange={(e) => setFDiff(e.target.value)}>{DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}</select></div>
          </div>
          <div className="input-row">
            <div className="field-group"><div className="field-label">Current Grade %</div><input className="field-input" type="number" min="0" max="100" value={fGrade} onChange={(e) => setFGrade(e.target.value)} placeholder="e.g., 88" /></div>
            <div className="field-group"><div className="field-label">Weight % (of GPA)</div><input className="field-input" type="number" min="0" max="100" value={fWeight} onChange={(e) => setFWeight(e.target.value)} placeholder="e.g., 30" /></div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn-add" onClick={(e) => { e.currentTarget.blur(); submit(); }}>{editingId ? "Save Changes" : "+ Add Course"}</button>
            <button className="btn-outline" onClick={() => { setFormOpen(false); resetForm(); }} style={{ padding: "0.5rem 1rem" }}>Cancel</button>
            {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
          </div>
        </div>
      )}

      {/* ACADEMIC BOOKS */}
      <div className="form-section" style={{ marginTop: "1.5rem" }}>
        <h3 style={cardTitle}><BookOpen size={18} /> Academic Book Library</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1rem", fontStyle: "italic" }}>
          Add required and recommended books for your nursing courses
        </p>

        {!bookFormOpen && (
          <button className="btn-add" onClick={() => setBookFormOpen(true)} style={{ padding: "0.5rem 0.75rem", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <Plus size={15} /> New Book
          </button>
        )}
        {bookFormOpen && (
          <div ref={bookFormRef} style={{ scrollMarginTop: "1rem" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ alignItems: "end", marginBottom: "0.75rem" }}>
              <div className="field-group"><div className="field-label">Book Title</div><input className="field-input" value={bTitle} onChange={(e) => setBTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addBook(); }} placeholder="e.g., Nursing Pharmacology" style={{ fontSize: "0.82rem", padding: "0.45rem" }} /></div>
              <div className="field-group"><div className="field-label">Author</div><input className="field-input" value={bAuthor} onChange={(e) => setBAuthor(e.target.value)} placeholder="Author name" style={{ fontSize: "0.82rem", padding: "0.45rem" }} /></div>
              <div className="field-group"><div className="field-label">Course</div>
                <select className="field-select" value={bCourse} onChange={(e) => setBCourse(e.target.value)} style={{ fontSize: "0.82rem", padding: "0.45rem" }}>
                  <option>Pharmacology</option><option>Fundamentals</option><option>Clinical Lab</option><option>Anatomy</option><option>General</option>
                </select>
              </div>
              <div className="field-group"><div className="field-label">Status</div>
                <select className="field-select" value={bStatus} onChange={(e) => setBStatus(e.target.value)} style={{ fontSize: "0.82rem", padding: "0.45rem" }}>
                  <option value="required">Required</option>
                  <option value="recommended">Recommended</option>
                  <option value="reading">Currently Reading</option>
                  <option value="done">Completed</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn-add" onClick={addBook} style={{ padding: "0.5rem 0.75rem", fontSize: "0.82rem" }}>+ Add Book</button>
              <button className="btn-outline" onClick={() => { setBookFormOpen(false); setBTitle(""); setBAuthor(""); }} style={{ padding: "0.5rem 1rem", fontSize: "0.82rem" }}>Done</button>
            </div>
          </div>
        )}

        {books.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "0.75rem", marginTop: "1rem" }}>
            {books.map((b) => (
              <div key={b.id} className="card" style={{ padding: "0.85rem", position: "relative" }}>
                <button onClick={() => requestDeleteBook(b)} aria-label="Delete book" style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2 }}><Trash2 size={14} /></button>
                <div style={{ fontWeight: 600, fontSize: "0.88rem", paddingRight: "1.25rem" }}>{b.title}</div>
                {b.author && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{b.author}</div>}
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>{b.course} · {b.status}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center", padding: "1.5rem", fontStyle: "italic" }}>
            No books added yet. Add your required textbooks above.
          </div>
        )}
      </div>
    </div>
  );
}
