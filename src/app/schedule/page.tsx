"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Block = {
  id: string;
  day: string;
  start_label: string;
  end_label: string | null;
  subject: string;
  type: string;
};

const TIMES = ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];
const COLS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fmt(t: string) {
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m || "00"} ${hr < 12 ? "AM" : "PM"}`;
}

export default function SchedulePage() {
  const supabase = createClient();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [day, setDay] = useState("Monday");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:30");
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("sch-lecture");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const { data } = await supabase
        .from("schedule_blocks")
        .select("*")
        .order("created_at", { ascending: true });
      setBlocks((data as Block[]) ?? []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addBlock() {
    if (!subject.trim() || !userId) return;
    const startLabel = fmt(start);
    // Prevent two blocks on the same day at the same start time (they'd overlap).
    if (blocks.some((b) => b.day === day && b.start_label === startLabel)) {
      setNotice(`You already have a class on ${day} at ${startLabel}. Remove it first or pick another time.`);
      return;
    }
    setNotice("");
    const { data, error } = await supabase
      .from("schedule_blocks")
      .insert({ user_id: userId, day, start_label: startLabel, end_label: fmt(end), subject: subject.trim(), type })
      .select()
      .single();
    if (!error && data) setBlocks((b) => [...b, data as Block]);
    setSubject("");
  }

  async function removeBlock(id: string) {
    setBlocks((b) => b.filter((x) => x.id !== id));
    await supabase.from("schedule_blocks").delete().eq("id", id);
  }

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
        {notice && (
          <div style={{ marginTop: "0.6rem", fontSize: "0.8rem", color: "var(--terracotta-dark)" }}>{notice}</div>
        )}
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
          {loading ? "Loading your schedule…" : "Your weekly class schedule · Click × to remove a block"}
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
                        .filter((b) => b.day === col && b.start_label === t)
                        .map((b) => (
                          <div
                            key={b.id}
                            className={"schedule-event " + b.type}
                            style={{ position: "absolute", top: 3, left: 3, right: 3, bottom: 3, overflow: "hidden", fontSize: "0.65rem" }}
                          >
                            {b.subject}
                            <br />
                            <span style={{ opacity: 0.7 }}>{b.start_label}–{b.end_label}</span>
                            <button
                              onClick={() => removeBlock(b.id)}
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
