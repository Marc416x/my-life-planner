import { CheckCircle2, Clock } from "lucide-react";

export default function QuizzesPage() {
  return (
    <div className="page active">
      <div className="page-header">
        <h1>Quizzes</h1>
        <p>Track your quiz performance across all courses</p>
      </div>

      <div className="form-section">
        <h3>Add Quiz Result</h3>
        <div className="input-row three">
          <div className="field-group"><div className="field-label">Course</div><select className="field-select"><option>Pharmacology</option><option>Fundamentals</option><option>Clinical Lab</option><option>Anatomy</option></select></div>
          <div className="field-group"><div className="field-label">Quiz Name</div><input className="field-input" placeholder="e.g., Quiz 3 — Antibiotics" /></div>
          <div className="field-group"><div className="field-label">Date Taken</div><input className="field-input" type="date" /></div>
        </div>
        <div className="input-row three">
          <div className="field-group"><div className="field-label">Score</div><input className="field-input" placeholder="85" /></div>
          <div className="field-group"><div className="field-label">Max Score</div><input className="field-input" placeholder="100" /></div>
          <div className="field-group"><div className="field-label">Time Taken (min)</div><input className="field-input" placeholder="30" /></div>
        </div>
        <div className="input-row">
          <div className="field-group"><div className="field-label">Topics Covered</div><input className="field-input" placeholder="Antibiotics, Dosage, Side effects" /></div>
          <div className="field-group"><div className="field-label">Difficulty</div><select className="field-select"><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
        </div>
        <div className="input-row single"><div className="field-group"><div className="field-label">Notes</div><textarea className="field-textarea" placeholder="What was challenging? What went well?" /></div></div>
        <button className="btn-add">+ Add Quiz</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Pharmacology — Quiz 1</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Drug Classes &amp; Mechanisms</div>
              <div style={{ display: "flex", gap: "0.4rem", marginTop: 4 }}>
                <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 10, background: "var(--ochre-light)", color: "#7A5A10" }}>Medium</span>
                <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 10, background: "var(--forest-light)", color: "var(--forest)" }}>30 min</span>
              </div>
            </div>
            <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.5rem", fontWeight: 700, color: "var(--olive)" }}>91%</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={13} /> Score: 91/100</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={13} /> Time: 28 min</div>
          </div>
        </div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Pharmacology — Quiz 2</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Pharmacokinetics</div>
              <div style={{ display: "flex", gap: "0.4rem", marginTop: 4 }}>
                <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 10, background: "var(--terracotta-light)", color: "var(--terracotta-dark)" }}>Hard</span>
                <span style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: 10, background: "var(--forest-light)", color: "var(--forest)" }}>35 min</span>
              </div>
            </div>
            <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.5rem", fontWeight: 700, color: "var(--ochre)" }}>76%</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={13} /> Score: 76/100</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={13} /> Time: 32 min</div>
          </div>
        </div>
      </div>
    </div>
  );
}
