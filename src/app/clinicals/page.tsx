import { Target, PenLine } from "lucide-react";

export default function ClinicalsPage() {
  return (
    <div className="page active">
      <div className="page-header">
        <h1>Clinicals</h1>
        <p>Bridge the gap between theory and practice</p>
      </div>

      <div className="form-section">
        <h3>Log Clinical Session</h3>
        <div className="input-row three">
          <div className="field-group"><div className="field-label">Date</div><input className="field-input" type="date" /></div>
          <div className="field-group"><div className="field-label">Time Spent (hrs)</div><input className="field-input" type="number" placeholder="4" step="0.5" /></div>
          <div className="field-group"><div className="field-label">Difficulty</div><select className="field-select"><option>Easy</option><option>Medium</option><option>Hard</option><option>Very Hard</option></select></div>
        </div>
        <div className="input-row">
          <div className="field-group"><div className="field-label">Supervisor/Professor</div><input className="field-input" placeholder="Dr. Williams" /></div>
          <div className="field-group"><div className="field-label">Department/Ward</div><input className="field-input" placeholder="e.g., Medical Ward 3" /></div>
        </div>
        <div className="input-row single"><div className="field-group"><div className="field-label">Goal for the Day</div><input className="field-input" placeholder="What do you aim to accomplish today?" /></div></div>
        <div className="input-row single"><div className="field-group"><div className="field-label">Things to Learn/Prepare Before Clinical</div><textarea className="field-textarea" placeholder="Medications, procedures, patient conditions to review..." /></div></div>
        <div className="input-row single"><div className="field-group"><div className="field-label">Reflections After Clinical</div><textarea className="field-textarea" placeholder="What did you observe? What did you learn? What will you improve?" /></div></div>
        <div className="input-row single"><div className="field-group"><div className="field-label">Key Takeaways / What to Consider</div><textarea className="field-textarea" placeholder="Important clinical notes, patient care insights..." /></div></div>
        <button className="btn-add">+ Log Clinical Session</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total Clinical Hours</div><div className="stat-val">24h</div><div className="progress-bar"><div className="progress-fill fill-forest" style={{ width: "48%" }} /></div><div className="stat-sub">Goal: 50h this semester</div></div>
        <div className="stat-card"><div className="stat-label">Sessions Completed</div><div className="stat-val">6</div></div>
        <div className="stat-card"><div className="stat-label">Avg Session Length</div><div className="stat-val">4h</div></div>
        <div className="stat-card"><div className="stat-label">Avg Difficulty</div><div className="stat-val" style={{ color: "var(--ochre)" }}>Med</div></div>
      </div>

      <div className="clinical-card">
        <div className="clinical-header">
          <div><div className="clinical-name">Medical-Surgical Ward</div><div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Supervisor: Dr. Williams · 4 hours</div></div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>May 5, 2026</div><div style={{ fontSize: "0.72rem", background: "var(--ochre-light)", color: "#7A5A10", padding: "2px 8px", borderRadius: 10, marginTop: 2 }}>Medium</div></div>
        </div>
        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: 6 }}><Target size={14} /> Goal: Practice wound dressing and vital sign monitoring</div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", alignItems: "flex-start", gap: 6 }}><PenLine size={14} style={{ marginTop: 3, flexShrink: 0 }} /> Observed 3 wound dressings, administered 2 medications under supervision, documented patient vitals.</div>
      </div>
    </div>
  );
}
