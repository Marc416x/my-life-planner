"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { DetailSheet } from "@/components/detail-sheet";

type Course = { id: string; name: string; code: string | null };

type Block = {
  id: string;
  day: string;
  subject: string;
  type: string;
  start_min: number;
  end_min: number;
  course_id: string | null;
};

const BLOCK_COLS = "id, day, subject, type, start_min, end_min, course_id";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// The grid always spans at least this window so a single morning class doesn't
// shrink the whole week; it only grows for earlier/later entries.
const DEFAULT_START = 8 * 60;   // 8:00 AM
const DEFAULT_END = 17 * 60;    // 5:00 PM

const TYPES = [
  { v: "sch-lecture", label: "Lecture", color: "var(--terracotta)", tint: "rgba(196,112,74,0.2)" },
  { v: "sch-clinical", label: "Clinical", color: "var(--forest)", tint: "rgba(45,90,61,0.2)" },
  { v: "sch-lab", label: "Lab", color: "var(--ochre)", tint: "rgba(196,154,58,0.2)" },
  { v: "sch-study", label: "Study", color: "var(--olive)", tint: "rgba(107,124,74,0.15)" },
];
function typeMeta(v: string) {
  return TYPES.find((t) => t.v === v) ?? TYPES[0];
}

function courseLabel(c: Course) {
  return c.code ? `${c.code} ${c.name}` : c.name;
}

const HOUR_PX = 54;
const PX_PER_MIN = HOUR_PX / 60;

// "9:00 AM" from minutes-past-midnight (540).
function fmtMin(mins: number) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const h = h24 % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}
function fmtHour(mins: number) {
  const h24 = Math.floor(mins / 60);
  return `${h24 % 12 || 12} ${h24 < 12 ? "AM" : "PM"}`;
}
function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}
function parseTimeInput(v: string) {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}
function toTimeInput(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

// Assign overlapping blocks in a day to side-by-side lanes. Returns, per block
// id, which lane it sits in and how many lanes its overlap-cluster needs.
function laneLayout(dayBlocks: Block[]) {
  const sorted = [...dayBlocks].sort((a, b) => a.start_min - b.start_min || a.end_min - b.end_min);
  const out = new Map<string, { lane: number; lanes: number }>();
  let cluster: Block[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const laneEnds: number[] = [];
    for (const b of cluster) {
      let lane = laneEnds.findIndex((end) => end <= b.start_min);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(b.end_min); }
      else laneEnds[lane] = b.end_min;
      out.set(b.id, { lane, lanes: 0 });
    }
    for (const b of cluster) out.get(b.id)!.lanes = laneEnds.length;
    cluster = [];
    clusterEnd = -1;
  };

  for (const b of sorted) {
    if (cluster.length && b.start_min >= clusterEnd) flush();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.end_min);
  }
  flush();
  return out;
}

// Detail body for a schedule block (shown inside the shared DetailSheet).
function BlockDetail({ block, onEdit, onDelete, onClose }: {
  block: Block; onEdit: () => void; onDelete: () => void; onClose: () => void;
}) {
  const t = typeMeta(block.type);
  return (
    <>
      <div className="sheet-sub">
        <span>{block.day}</span>
        <span>{fmtMin(block.start_min)} – {fmtMin(block.end_min)}</span>
        <span>{fmtDuration(block.end_min - block.start_min)}</span>
      </div>
      <span className="sheet-badge" style={{ background: t.tint, color: t.color }}>{t.label}</span>
      <div className="sheet-actions">
        <button className="btn-add" onClick={onEdit} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}><Pencil size={14} /> Edit</button>
        <button className="btn-danger" onClick={onDelete}><Trash2 size={14} /> Delete</button>
        <button className="btn-outline sheet-action-spacer" onClick={onClose} style={{ padding: "0.5rem 1rem" }}>Close</button>
      </div>
    </>
  );
}

export default function SchedulePage() {
  const supabase = createClient();
  const toast = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Mobile agenda: which day is shown. Default to today.
  const [selectedDay, setSelectedDay] = useState(DAYS[(new Date().getDay() + 6) % 7]);

  // Detail sheet.
  const [detail, setDetail] = useState<Block | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Add / edit form (collapsible, at the top).
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fDay, setFDay] = useState("Monday");
  const [fStart, setFStart] = useState("09:00");
  const [fEnd, setFEnd] = useState("10:30");
  const [fCourse, setFCourse] = useState("");
  const [fType, setFType] = useState("sch-lecture");
  const [notice, setNotice] = useState("");

  const pending = useRef<Map<string, { item: Block; timeout: number }>>(new Map());
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const [{ data: courseRows }, { data: blockRows }] = await Promise.all([
        supabase.from("courses").select("id, name, code").order("created_at", { ascending: true }),
        supabase.from("schedule_blocks").select(BLOCK_COLS).order("start_min", { ascending: true }),
      ]);
      setCourses((courseRows as Course[]) ?? []);
      const rows = (blockRows as Block[]) ?? [];
      setBlocks(rows.filter((b) => b.start_min != null && b.end_min != null));
      if (courseRows && courseRows.length) setFCourse((courseRows[0] as Course).id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bring the form into view when it opens.
  useEffect(() => {
    if (formOpen) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [formOpen]);

  const courseById = new Map(courses.map((c) => [c.id, c]));
  // Live subject label: prefer the current course name, fall back to the stored
  // text (legacy rows created before the course link).
  function blockLabel(b: Block) {
    const c = b.course_id ? courseById.get(b.course_id) : undefined;
    return c ? courseLabel(c) : b.subject;
  }

  function openDetail(b: Block) {
    setDetail(b);
    setDetailOpen(true);
  }

  function openAdd() {
    setEditingId(null);
    setNotice("");
    if (courses.length) setFCourse(courses[0].id);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingId(null);
    setNotice("");
    setFormOpen(false);
  }

  function editFromDetail() {
    if (!detail) return;
    const b = detail;
    setDetailOpen(false);
    setEditingId(b.id);
    setFDay(b.day);
    setFStart(toTimeInput(b.start_min));
    setFEnd(toTimeInput(b.end_min));
    setFCourse(b.course_id ?? (courses[0]?.id ?? ""));
    setFType(b.type);
    setNotice("");
    setFormOpen(true);
  }

  async function submit() {
    if (!userId) return;
    if (!fCourse) { setNotice("Add a course in the Courses menu first, then pick it here."); return; }
    const course = courseById.get(fCourse);
    if (!course) { setNotice("Pick a subject."); return; }
    const sMin = parseTimeInput(fStart);
    const eMin = parseTimeInput(fEnd);
    if (Number.isNaN(sMin) || Number.isNaN(eMin)) { setNotice("Enter valid start and end times."); return; }
    if (eMin <= sMin) { setNotice("End time must be after start time."); return; }
    const clash = blocks.find((b) => b.day === fDay && b.id !== editingId && sMin < b.end_min && eMin > b.start_min);
    if (clash) { setNotice(`Overlaps ${blockLabel(clash)} (${fmtMin(clash.start_min)}–${fmtMin(clash.end_min)}) on ${fDay}.`); return; }
    setNotice("");

    const payload = {
      day: fDay,
      subject: courseLabel(course),
      course_id: fCourse,
      type: fType,
      start_min: sMin,
      end_min: eMin,
      start_label: fmtMin(sMin),
      end_label: fmtMin(eMin),
    };

    if (editingId) {
      const { data, error } = await supabase.from("schedule_blocks").update(payload).eq("id", editingId).select(BLOCK_COLS).single();
      if (error || !data) { setNotice("Could not save — please try again."); return; }
      setBlocks((bs) => bs.map((b) => (b.id === editingId ? (data as Block) : b)));
      closeForm();
    } else {
      const { data, error } = await supabase.from("schedule_blocks").insert({ user_id: userId, ...payload }).select(BLOCK_COLS).single();
      if (error || !data) { setNotice("Could not save — please try again."); return; }
      setBlocks((bs) => [...bs, data as Block]);
      // Keep the form open with the same subject/type for quick repeat entry.
    }
  }

  function requestDelete(b: Block) {
    if (editingId === b.id) closeForm();
    setBlocks((bs) => bs.filter((x) => x.id !== b.id));
    const timeout = window.setTimeout(async () => {
      pending.current.delete(b.id);
      await supabase.from("schedule_blocks").delete().eq("id", b.id);
    }, 5000);
    pending.current.set(b.id, { item: b, timeout });
    toast.show("Class removed", {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = pending.current.get(b.id);
        if (!p) return;
        clearTimeout(p.timeout);
        pending.current.delete(b.id);
        setBlocks((bs) => [...bs, p.item]);
      },
    });
  }
  function deleteFromDetail() {
    if (!detail) return;
    const b = detail;
    setDetailOpen(false);
    requestDelete(b);
  }

  // Grid time range: always covers 8:00–17:00, expanding to the hour around any
  // earlier/later blocks. (Math.min/max over an empty list = the defaults.)
  const hasBlocks = blocks.length > 0;
  const minStart = Math.min(DEFAULT_START, ...blocks.map((b) => b.start_min));
  const maxEnd = Math.max(DEFAULT_END, ...blocks.map((b) => b.end_min));
  const rangeStart = Math.floor(minStart / 60) * 60;
  const rangeEnd = Math.ceil(maxEnd / 60) * 60;
  const bodyPx = ((rangeEnd - rangeStart) / 60) * HOUR_PX;
  const hourMarks: number[] = [];
  for (let m = rangeStart; m <= rangeEnd; m += 60) hourMarks.push(m);
  const gridLines = `repeating-linear-gradient(to bottom, var(--border), var(--border) 1px, transparent 1px, transparent ${HOUR_PX}px)`;

  return (
    <div className="page active">
      <div className="page-header">
        <h1>Class Schedule</h1>
        <p>Your weekly academic timetable</p>
      </div>

      {/* ADD / EDIT — a plain button when collapsed, the full form when expanded */}
      {!formOpen && (
        <button className="btn-add" onClick={openAdd} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", marginBottom: "1rem" }}>
          <Plus size={16} /> Add Class
        </button>
      )}

      {formOpen && (
        <div className="form-section" ref={formRef} style={{ marginBottom: "1rem", scrollMarginTop: "1rem" }}>
          <h3>{editingId ? "Edit Class" : "Add Class"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "0.65rem", alignItems: "end" }}>
            <div className="field-group"><div className="field-label">Day</div>
              <select className="field-select" value={fDay} onChange={(e) => setFDay(e.target.value)} style={{ fontSize: "0.82rem", padding: "0.45rem" }}>
                {DAYS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="field-group"><div className="field-label">Subject</div>
              <select className="field-select" value={fCourse} onChange={(e) => { setFCourse(e.target.value); if (notice) setNotice(""); }} style={{ fontSize: "0.82rem", padding: "0.45rem" }}>
                {courses.length ? courses.map((c) => <option key={c.id} value={c.id}>{courseLabel(c)}</option>) : <option value="">Add a course first</option>}
              </select>
            </div>
            <div className="field-group"><div className="field-label">Start</div><input className="field-input" type="time" value={fStart} onChange={(e) => setFStart(e.target.value)} style={{ fontSize: "0.82rem", padding: "0.45rem" }} /></div>
            <div className="field-group"><div className="field-label">End</div><input className="field-input" type="time" value={fEnd} onChange={(e) => setFEnd(e.target.value)} style={{ fontSize: "0.82rem", padding: "0.45rem" }} /></div>
            <div className="field-group"><div className="field-label">Type</div>
              <select className="field-select" value={fType} onChange={(e) => setFType(e.target.value)} style={{ fontSize: "0.82rem", padding: "0.45rem" }}>
                {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.9rem" }}>
            <button className="btn-add" onClick={submit}>{editingId ? "Save Changes" : "+ Add Class"}</button>
            <button className="btn-outline" onClick={closeForm} style={{ padding: "0.5rem 1rem" }}>{editingId ? "Cancel" : "Done"}</button>
            {notice && <span style={{ fontSize: "0.82rem", color: "var(--terracotta-dark)" }}>{notice}</span>}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
          {loading ? "Loading your schedule…" : hasBlocks ? "Tap a class to edit or remove it." : "No classes yet — add your first one above."}
        </div>

        {/* MOBILE — day agenda (shown/hidden by CSS to avoid hydration flip) */}
        <div className="sched-mobile">
            <div className="agenda-tabs">
              {DAYS.map((d) => (
                <button key={d} className={"agenda-tab" + (d === selectedDay ? " active" : "")} onClick={() => setSelectedDay(d)}>{d.slice(0, 3)}</button>
              ))}
            </div>
            {(() => {
              const dayBlocks = blocks.filter((b) => b.day === selectedDay).sort((a, b) => a.start_min - b.start_min);
              if (!dayBlocks.length) {
                return <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1.5rem 0.5rem", fontStyle: "italic", textAlign: "center" }}>No classes on {selectedDay}.</div>;
              }
              const total = dayBlocks.reduce((s, b) => s + (b.end_min - b.start_min), 0);
              return (
                <>
                  <div className="agenda-day-total">{selectedDay} · {fmtDuration(total)} of class</div>
                  {dayBlocks.map((b) => {
                    const t = typeMeta(b.type);
                    return (
                      <button key={b.id} className="agenda-item" onClick={() => openDetail(b)} style={{ borderLeftColor: t.color }}>
                        <div className="agenda-time">{fmtMin(b.start_min)}<br />{fmtMin(b.end_min)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="agenda-subject">{blockLabel(b)}</div>
                          <div className="agenda-type">{t.label} · {fmtDuration(b.end_min - b.start_min)}</div>
                        </div>
                        <ChevronRight size={18} className="clinical-chevron" />
                      </button>
                    );
                  })}
                </>
              );
            })()}
          </div>

        {/* DESKTOP — weekly time grid */}
        <div className="sched-desktop schedule-wrapper">
            <div className="tt" style={{ ["--tt-days" as string]: DAYS.length, minWidth: 640 }}>
              <div className="tt-corner" />
              {DAYS.map((d) => <div className="tt-dayhead" key={d}>{d.slice(0, 3)}</div>)}

              <div className="tt-gutter" style={{ height: bodyPx }}>
                {hourMarks.map((m) => (
                  <div className="tt-hourlabel" key={m} style={{ top: (m - rangeStart) * PX_PER_MIN }}>{fmtHour(m)}</div>
                ))}
              </div>

              {DAYS.map((day) => {
                const dayBlocks = blocks.filter((b) => b.day === day);
                const lanes = laneLayout(dayBlocks);
                return (
                  <div className="tt-col" key={day} style={{ height: bodyPx, backgroundImage: gridLines }}>
                    {dayBlocks.map((b) => {
                      const { lane, lanes: n } = lanes.get(b.id)!;
                      const w = 100 / n;
                      return (
                        <button
                          key={b.id}
                          className={"tt-event " + b.type}
                          onClick={() => openDetail(b)}
                          style={{
                            top: (b.start_min - rangeStart) * PX_PER_MIN,
                            height: Math.max(16, (b.end_min - b.start_min) * PX_PER_MIN - 2),
                            left: `calc(${lane * w}% + 2px)`,
                            width: `calc(${w}% - 4px)`,
                          }}
                        >
                          <div className="tt-event-subject">{blockLabel(b)}</div>
                          <div className="tt-event-time">{fmtMin(b.start_min)} – {fmtMin(b.end_min)}</div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
        </div>
      </div>

      {/* LEGEND */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.72rem" }}>
        {TYPES.map((t) => (
          <span key={t.v} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: t.tint, borderLeft: `2px solid ${t.color}`, display: "inline-block" }} />{t.label}
          </span>
        ))}
      </div>

      {/* DETAIL — dialog on desktop, bottom sheet on mobile */}
      <DetailSheet open={detailOpen} onOpenChange={setDetailOpen} title={detail ? blockLabel(detail) : "Class"}>
        {detail && <BlockDetail block={detail} onEdit={editFromDetail} onDelete={deleteFromDetail} onClose={() => setDetailOpen(false)} />}
      </DetailSheet>
    </div>
  );
}
