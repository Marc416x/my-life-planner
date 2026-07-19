"use client";

import { useState } from "react";

type Block = { day: string; start: string; end: string; subject: string; type: string };

const TIMES = ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];
const COLS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEFAULT_BLOCKS: Block[] = [
  { day: "Monday", start: "9:00 AM", end: "10:30 AM", subject: "NUR301 Pharmacology", type: "sch-lecture" },
  { day: "Tuesday", start: "11:00 AM", end: "12:30 PM", subject: "NUR310 Clinical Lab", type: "sch-clinical" },
  { day: "Wednesday", start: "9:00 AM", end: "10:30 AM", subject: "NUR301 Pharmacology", type: "sch-lecture" },
  { day: "Wednesday", start: "11:00 AM", end: "12:00 PM", subject: "NUR310 Lab", type: "sch-lab" },
  { day: "Thursday", start: "2:00 PM", end: "3:00 PM", subject: "Study Session — Library", type: "sch-study" },
  { day: "Friday", start: "10:00 AM", end: "11:30 AM", subject: "NUR201 Fundamentals", type: "sch-lecture" },
];

function fmt(t: string) {
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m || "00"} ${hr < 12 ? "AM" : "PM"}`;
}

export default function SchedulePage() {
  const [blocks, setBlocks] = useState<Block[]>(DEFAULT_BLOCKS);
  const [day, setDay] = useState("Monday");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:30");
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("sch-lecture");

  const addBlock = () => {
    if (!subject.trim()) return;
    setBlocks([...blocks, { day, start: fmt(start), end: fmt(end), subject: subject.trim(), type }]);
    setSubject("");
  };

  const removeBlock = (idx: number) => setBlocks(blocks.filter((_, i) => i !== idx));

  return (
    <div className="page active">
      <div className="page-header">
        <h1>Class Schedule</h1>
        <p>Your weekly academic timetable</p>
      </div>

      <div className="form-section" style={{ marginBottom: "1rem" }}>
        <h3>Add Schedule Block</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "0.65rem", alignItems: "end" }}>
          <div className="field-group"><div className="field-label">Day</div>
            <select className="field-select" value={day} onChange={(e) => setDay(e.target.value)} style={{ fontSize: "0.82rem", padding: "0.45rem" }}>
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="field-group"><div className="field-label">Start Time</div><input className="field-input" type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ fontSize: "0.82rem", padding: "0.45rem" }} /></div>
          <div className="field-group"><div className="field-label">End Time</div><input className="field-input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ fontSize: "0.82rem", padding: "0.45rem" }} /></div>
          <div className="field-group"><div className="field-label">Subject</div><input className="field-input" value={subject} onChange={(e) => setSubject(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addBlock(); }} placeholder="e.g., NUR301 Pharmacology" style={{ fontSize: "0.82rem", padding: "0.45rem" }} /></div>
          <div className="field-group"><div className="field-label">Type</div>
            <select className="field-select" value={type} onChange={(e) => setType(e.target.value)} style={{ fontSize: "0.82rem", padding: "0.45rem" }}>
              <option value="sch-lecture">Lecture</option><option value="sch-clinical">Clinical</option><option value="sch-lab">Lab</option><option value="sch-study">Study</option>
            </select>
          </div>
          <button className="btn-add" onClick={addBlock} style={{ padding: "0.5rem 0.75rem", fontSize: "0.82rem", whiteSpace: "nowrap" }}>+ Add</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
          Your weekly class schedule · Click × to remove a block
        </div>
        <div className="schedule-wrapper">
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="time-col">Time</th>
                {COLS.map((c) => <th key={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {TIMES.map((t) => (
                <tr key={t}>
                  <td className="time-col">{t}</td>
                  {COLS.map((col) => (
                    <td key={col} style={{ position: "relative" }}>
                      {blocks
                        .map((b, i) => ({ b, i }))
                        .filter(({ b }) => b.day === col && b.start === t)
                        .map(({ b, i }) => (
                          <div
                            key={i}
                            className={"schedule-event " + b.type}
                            style={{ position: "absolute", top: 3, left: 3, right: 3, bottom: 3, overflow: "hidden", fontSize: "0.65rem" }}
                          >
                            {b.subject}
                            <br />
                            <span style={{ opacity: 0.7 }}>{b.start}–{b.end}</span>
                            <button
                              onClick={() => removeBlock(i)}
                              aria-label="Remove block"
                              style={{ position: "absolute", top: 2, right: 2, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: "0.7rem", lineHeight: 1 }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.72rem" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(196,112,74,0.3)", borderLeft: "2px solid var(--terracotta)", display: "inline-block" }} />Lecture</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(45,90,61,0.3)", borderLeft: "2px solid var(--forest)", display: "inline-block" }} />Clinical</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(196,154,58,0.2)", borderLeft: "2px solid var(--ochre)", display: "inline-block" }} />Lab</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(107,124,74,0.15)", borderLeft: "2px solid var(--olive)", display: "inline-block" }} />Study Session</span>
      </div>
    </div>
  );
}
