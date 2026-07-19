import { BookOpen, Target } from "lucide-react";

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

const courses = [
  { name: "Pharmacology", code: "NUR301", credits: 4, weightPct: 30, gradePct: 82, cls: "grade-B" },
  { name: "Fundamentals of Nursing", code: "NUR201", credits: 3, weightPct: 35, gradePct: 91, cls: "grade-A" },
  { name: "Clinical Lab Sciences", code: "NUR310", credits: 3, weightPct: 25, gradePct: 88, cls: "grade-B" },
  { name: "Anatomy & Physiology", code: "NUR101", credits: 4, weightPct: 10, gradePct: 95, cls: "grade-A" },
];

function creditWeightedGPA() {
  const totalCredits = courses.reduce((s, c) => s + c.credits, 0);
  const points = courses.reduce((s, c) => s + pctToGradePoint(c.gradePct) * c.credits, 0);
  return totalCredits ? points / totalCredits : 0;
}

const mastery = [
  { course: "Pharmacology", topic: "Drug Classes & Mechanisms", meta: "8 quizzes · updated 2d ago", score: "78%", cls: "grade-B" },
  { course: "Pharmacology", topic: "Pharmacokinetics", meta: "4 quizzes · updated 6d ago", score: "64%", cls: "grade-C" },
  { course: "Fundamentals of Nursing", topic: "Patient Assessment", meta: "6 quizzes · updated 1d ago", score: "90%", cls: "grade-A" },
  { course: "Anatomy & Physiology", topic: "Nervous System", meta: "Stale — no attempt in 14+ days", score: "58%", cls: "" },
  { course: "Clinical Lab Sciences", topic: "Dosage Calculations", meta: "1 quiz · not enough data", score: "—", cls: "" },
];

export default function GradesPage() {
  const gpa = creditWeightedGPA().toFixed(1);

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
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Spring 2026 Semester</div>
          <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 20, background: "var(--olive-light)", color: "var(--olive-dark)" }}>A = 4.0</span>
            <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 20, background: "var(--ochre-light)", color: "#7A5A10" }}>B = 3.0</span>
            <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 20, background: "var(--terracotta-light)", color: "var(--terracotta-dark)" }}>C = 2.0</span>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}><BookOpen size={18} /> Course Grades Overview</div>
          {courses.map((c) => (
            <div className="grade-row" key={c.code}>
              <div className="grade-name"><strong>{c.name}</strong> {c.code} · {c.credits} credits</div>
              <div className="grade-weight">{c.weightPct}%</div>
              <div className={"grade-score " + c.cls}>{c.gradePct}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="form-section">
        <h3 style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}><BookOpen size={18} /> Add Course Grade Entry</h3>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem", fontStyle: "italic" }}>Official grades from your syllabus — these feed your GPA.</div>
        <div className="input-row three">
          <div className="field-group"><div className="field-label">Course</div><select className="field-select"><option>Pharmacology</option><option>Fundamentals</option><option>Clinical Lab</option><option>Anatomy</option></select></div>
          <div className="field-group"><div className="field-label">Assessment Name</div><input className="field-input" placeholder="e.g., Quiz 1" /></div>
          <div className="field-group"><div className="field-label">Type</div><select className="field-select"><option>Quiz</option><option>Assignment</option><option>Mid-Term</option><option>Final Exam</option><option>Lab</option></select></div>
        </div>
        <div className="input-row three">
          <div className="field-group"><div className="field-label">Score</div><input className="field-input" placeholder="85" /></div>
          <div className="field-group"><div className="field-label">Max Score</div><input className="field-input" placeholder="100" /></div>
          <div className="field-group"><div className="field-label">Weight %</div><input className="field-input" placeholder="10" /></div>
        </div>
        <button className="btn-add">+ Add Grade</button>
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
