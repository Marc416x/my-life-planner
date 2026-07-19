import { AlarmClock } from "lucide-react";

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
  return (
    <div className="page active">
      <div className="page-header">
        <h1>Exams</h1>
        <p>Prepare strategically, perform confidently</p>
      </div>

      <div className="form-section">
        <h3>Add Exam</h3>
        <div className="input-row three">
          <div className="field-group"><div className="field-label">Course</div><select className="field-select"><option>Pharmacology</option><option>Fundamentals</option><option>Clinical Lab</option><option>Anatomy</option></select></div>
          <div className="field-group"><div className="field-label">Exam Name</div><input className="field-input" placeholder="e.g., Mid-Term" /></div>
          <div className="field-group"><div className="field-label">Exam Date</div><input className="field-input" type="date" /></div>
        </div>
        <div className="input-row three">
          <div className="field-group"><div className="field-label">Weight %</div><input className="field-input" placeholder="e.g., 30" /></div>
          <div className="field-group"><div className="field-label">Planned Sessions</div><input className="field-input" type="number" placeholder="5" /></div>
          <div className="field-group"><div className="field-label">Confidence Level</div><select className="field-select"><option>1 - Very Low</option><option>2 - Low</option><option>3 - Medium</option><option>4 - High</option><option>5 - Very High</option></select></div>
        </div>
        <div className="input-row single">
          <div className="field-group"><div className="field-label">Topics to Cover</div><input className="field-input" placeholder="Enter topics separated by commas" /></div>
        </div>
        <button className="btn-add">+ Add Exam</button>
      </div>

      <div className="card-title" style={{ marginBottom: "1rem", fontFamily: "var(--font-caveat), cursive", fontSize: "1.1rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
        <AlarmClock size={18} /> Upcoming Exams
      </div>

      <div className="exam-card">
        <div className="exam-countdown"><div className="countdown-num">12</div><div className="countdown-label">Days</div></div>
        <div className="exam-info">
          <div className="exam-name">Pharmacology Mid-Term</div>
          <div className="exam-course">NUR301 · Weight: 30% · 3 sessions planned</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>Topics: Drug interactions, Dosage calculations, Adverse effects</div>
          <ConfDots filled={3} />
        </div>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Confidence</div><div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.2rem", color: "var(--olive)" }}>3/5</div></div>
      </div>

      <div className="exam-card">
        <div className="exam-countdown" style={{ background: "var(--olive-light)" }}><div className="countdown-num" style={{ color: "var(--olive)" }}>25</div><div className="countdown-label">Days</div></div>
        <div className="exam-info">
          <div className="exam-name">Fundamentals Final Exam</div>
          <div className="exam-course">NUR201 · Weight: 40% · 5 sessions planned</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>Topics: Patient assessment, Care planning, Documentation</div>
          <ConfDots filled={2} />
        </div>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Confidence</div><div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.2rem", color: "var(--ochre)" }}>2/5</div></div>
      </div>
    </div>
  );
}
