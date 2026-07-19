import { Clock } from "lucide-react";

const pill = (bg: string, color: string): React.CSSProperties => ({
  fontSize: "0.7rem", padding: "2px 8px", borderRadius: 20, background: bg, color, fontWeight: 500,
});

export default function AssignmentsPage() {
  return (
    <div className="page active">
      <div className="page-header">
        <h1>Assignments</h1>
        <p>Stay ahead — never miss a deadline</p>
      </div>

      <div style={{ background: "rgba(196,112,74,0.08)", border: "1px solid rgba(196,112,74,0.2)", borderRadius: "var(--radius-sm)", padding: "0.85rem 1.25rem", marginBottom: "1rem", fontSize: "0.82rem", color: "var(--terracotta-dark)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Clock size={16} style={{ flexShrink: 0 }} />
        <span><strong>Smart Due Dates:</strong> Planner sets your deadline 2 days before the actual due date. You&apos;ll also receive a notification 2 days before your original due date.</span>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total</div><div className="stat-val">3</div></div>
        <div className="stat-card"><div className="stat-label">In Progress</div><div className="stat-val" style={{ color: "var(--ochre)" }}>1</div></div>
        <div className="stat-card"><div className="stat-label">Completed</div><div className="stat-val" style={{ color: "var(--olive)" }}>0</div></div>
        <div className="stat-card"><div className="stat-label">Completion Rate</div><div className="stat-val">0%</div><div className="progress-bar"><div className="progress-fill fill-olive" style={{ width: "0%" }} /></div></div>
      </div>

      <div className="form-section">
        <h3>Add Assignment</h3>
        <div className="input-row">
          <div className="field-group"><div className="field-label">Course</div><select className="field-select"><option>Pharmacology</option><option>Fundamentals</option><option>Clinical Lab</option><option>Anatomy</option></select></div>
          <div className="field-group"><div className="field-label">Title</div><input className="field-input" placeholder="Assignment title" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: "0.75rem" }}>
          <div className="field-group"><div className="field-label">Actual Due Date</div><input className="field-input" type="date" /></div>
          <div className="field-group"><div className="field-label">Due Time</div><input className="field-input" type="time" defaultValue="23:59" /></div>
          <div className="field-group"><div className="field-label">Type</div><select className="field-select"><option>Essay</option><option>Case Study</option><option>Lab Report</option><option>Presentation</option><option>Homework</option></select></div>
          <div className="field-group"><div className="field-label">Priority</div><select className="field-select"><option>High</option><option>Medium</option><option>Low</option></select></div>
        </div>
        <div className="input-row single"><div className="field-group"><div className="field-label">Description</div><textarea className="field-textarea" placeholder="Assignment details..." /></div></div>
        <button className="btn-add">+ Add Assignment</button>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button className="tab-btn" style={{ flex: "none", padding: "0.4rem 1rem", border: "1px solid var(--border)", borderRadius: 20, background: "var(--terracotta)", color: "white", fontSize: "0.78rem" }}>All (3)</button>
        <button className="tab-btn" style={{ flex: "none", padding: "0.4rem 1rem", border: "1px solid var(--border)", borderRadius: 20, background: "none", color: "var(--text-muted)", fontSize: "0.78rem" }}>Upcoming (2)</button>
        <button className="tab-btn" style={{ flex: "none", padding: "0.4rem 1rem", border: "1px solid var(--border)", borderRadius: 20, background: "none", color: "var(--text-muted)", fontSize: "0.78rem" }}>Overdue (0)</button>
        <button className="tab-btn" style={{ flex: "none", padding: "0.4rem 1rem", border: "1px solid var(--border)", borderRadius: 20, background: "none", color: "var(--text-muted)", fontSize: "0.78rem" }}>Completed (0)</button>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.65rem 0", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--text-primary)" }}>Nursing Assessment Case Study</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Fundamentals of Nursing · Planner Due: May 7 (Actual: May 9)</div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span className="priority-high">High</span>
            <span style={pill("var(--ochre-light)", "#7A5A10")}>In Progress</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.65rem 0", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--text-primary)" }}>Pharmacology Drug Chart</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Pharmacology · Planner Due: May 10 (Actual: May 12)</div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span className="priority-med">Medium</span>
            <span style={pill("var(--border)", "var(--text-muted)")}>Pending</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.65rem 0" }}>
          <div>
            <div style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--text-primary)" }}>Lab Report — Blood Analysis</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Clinical Lab Sciences · Planner Due: May 17 (Actual: May 19)</div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span className="priority-low">Low</span>
            <span style={pill("var(--border)", "var(--text-muted)")}>Pending</span>
          </div>
        </div>
      </div>
    </div>
  );
}
