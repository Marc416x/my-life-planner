"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";

type Status = "pending" | "in_progress" | "completed";
type Priority = "high" | "medium" | "low";
type Tab = "all" | "upcoming" | "overdue" | "completed";

type Assignment = {
  id: string;
  title: string;
  course: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: Priority;
  status: Status;
  type: string | null;
  description: string | null;
};

const TYPES = ["Essay", "Case Study", "Lab Report", "Presentation", "Homework"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PRIORITY: Record<Priority, { label: string; cls: string; rank: number }> = {
  high: { label: "High", cls: "priority-high", rank: 0 },
  medium: { label: "Medium", cls: "priority-med", rank: 1 },
  low: { label: "Low", cls: "priority-low", rank: 2 },
};

const STATUS: Record<Status, { label: string; bg: string; color: string }> = {
  pending: { label: "Pending", bg: "var(--border)", color: "var(--text-muted)" },
  in_progress: { label: "In Progress", bg: "var(--ochre-light)", color: "#7A5A10" },
  completed: { label: "Completed", bg: "var(--forest-light)", color: "var(--forest)" },
};
const STATUS_ORDER: Status[] = ["pending", "in_progress", "completed"];

function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fmtMD(d: Date) {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}
function plannerDue(dueDate: string) {
  const d = parseDate(dueDate);
  d.setDate(d.getDate() - 2);
  return d;
}
function sortAssignments(list: Assignment[]) {
  return [...list].sort((a, b) => {
    const pr = PRIORITY[a.priority].rank - PRIORITY[b.priority].rank;
    if (pr !== 0) return pr;
    const ad = a.due_date ? parseDate(a.due_date).getTime() : Infinity;
    const bd = b.due_date ? parseDate(b.due_date).getTime() : Infinity;
    return ad - bd;
  });
}

export default function AssignmentsPage() {
  const supabase = createClient();
  const toast = useToast();
  const [items, setItems] = useState<Assignment[]>([]);
  const [courseNames, setCourseNames] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fCourse, setFCourse] = useState("");
  const [fDue, setFDue] = useState("");
  const [fTime, setFTime] = useState("23:59");
  const [fType, setFType] = useState(TYPES[0]);
  const [fPriority, setFPriority] = useState<Priority>("medium");
  const [fDesc, setFDesc] = useState("");

  const pending = useRef<Map<string, { item: Assignment; timeout: number }>>(new Map());
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const [{ data }, { data: courseRows }] = await Promise.all([
        supabase.from("assignments").select("*"),
        supabase.from("courses").select("name").order("created_at", { ascending: true }),
      ]);
      setItems((data as Assignment[]) ?? []);
      setCourseNames(((courseRows as { name: string }[]) ?? []).map((c) => c.name).filter(Boolean));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll the add/edit form into view when it expands.
  useEffect(() => {
    if (formOpen) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [formOpen]);

  const today0 = (() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t.getTime(); })();
  const isOverdue = (a: Assignment) =>
    a.status !== "completed" && !!a.due_date && parseDate(a.due_date).getTime() < today0;

  const counts = {
    all: items.length,
    upcoming: items.filter((a) => a.status !== "completed" && !isOverdue(a)).length,
    overdue: items.filter(isOverdue).length,
    completed: items.filter((a) => a.status === "completed").length,
  };

  const visible = sortAssignments(
    items.filter((a) => {
      if (tab === "all") return true;
      if (tab === "completed") return a.status === "completed";
      if (tab === "overdue") return isOverdue(a);
      return a.status !== "completed" && !isOverdue(a); // upcoming
    }),
  );

  const total = items.length;
  const inProgress = items.filter((a) => a.status === "in_progress").length;
  const rate = total ? Math.round((counts.completed / total) * 100) : 0;

  function resetForm() {
    setEditingId(null);
    setFormError("");
    setFTitle("");
    setFCourse(courseNames[0] ?? "");
    setFDue("");
    setFTime("23:59");
    setFType(TYPES[0]);
    setFPriority("medium");
    setFDesc("");
  }
  function openAdd() {
    resetForm();
    setFormOpen(true);
  }
  function openEdit(a: Assignment) {
    setFormError("");
    setEditingId(a.id);
    setFTitle(a.title);
    setFCourse(a.course ?? courseNames[0] ?? "");
    setFDue(a.due_date ?? "");
    setFTime(a.due_time ?? "23:59");
    setFType(a.type ?? TYPES[0]);
    setFPriority(a.priority);
    setFDesc(a.description ?? "");
    setFormOpen(true);
  }

  async function submit() {
    if (!fTitle.trim()) {
      setFormError("Please add an assignment title.");
      return;
    }
    if (!userId) return;
    setFormError("");
    const payload = {
      title: fTitle.trim(),
      course: fCourse || null,
      due_date: fDue || null,
      due_time: fTime || null,
      type: fType,
      priority: fPriority,
      description: fDesc.trim() || null,
    };
    if (editingId) {
      const { data } = await supabase.from("assignments").update(payload).eq("id", editingId).select().single();
      if (data) setItems((xs) => xs.map((x) => (x.id === editingId ? (data as Assignment) : x)));
    } else {
      const { data } = await supabase.from("assignments").insert({ user_id: userId, ...payload }).select().single();
      if (data) setItems((xs) => [...xs, data as Assignment]);
    }
    setFormOpen(false);
    resetForm();
  }

  function toggleExpand(id: string) {
    setExpandedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function cycleStatus(a: Assignment) {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(a.status) + 1) % 3];
    setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    await supabase.from("assignments").update({ status: next }).eq("id", a.id);
  }

  function requestDelete(a: Assignment) {
    if (editingId === a.id) { setFormOpen(false); resetForm(); }
    setItems((xs) => xs.filter((x) => x.id !== a.id));
    const timeout = window.setTimeout(async () => {
      pending.current.delete(a.id);
      await supabase.from("assignments").delete().eq("id", a.id);
    }, 5000);
    pending.current.set(a.id, { item: a, timeout });
    toast.show("Assignment deleted", {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = pending.current.get(a.id);
        if (!p) return;
        clearTimeout(p.timeout);
        pending.current.delete(a.id);
        setItems((xs) => [...xs, p.item]);
      },
    });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "upcoming", label: "Upcoming" },
    { key: "overdue", label: "Overdue" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div className="page active">
      <div className="page-header">
        <h1>Assignments</h1>
        <p>Stay ahead — never miss a deadline</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total</div><div className="stat-val">{total}</div></div>
        <div className="stat-card"><div className="stat-label">In Progress</div><div className="stat-val" style={{ color: "var(--ochre)" }}>{inProgress}</div></div>
        <div className="stat-card"><div className="stat-label">Completed</div><div className="stat-val" style={{ color: "var(--olive)" }}>{counts.completed}</div></div>
        <div className="stat-card"><div className="stat-label">Completion Rate</div><div className="stat-val">{rate}%</div><div className="progress-bar"><div className="progress-fill fill-olive" style={{ width: `${rate}%` }} /></div></div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: "none", padding: "0.4rem 1rem", borderRadius: 20, fontSize: "0.78rem", cursor: "pointer",
                border: "1px solid var(--border)",
                background: active ? "var(--terracotta)" : "none",
                color: active ? "white" : "var(--text-muted)",
              }}
            >
              {t.label} ({counts[t.key]})
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem", fontStyle: "italic" }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem", fontStyle: "italic" }}>
            {total === 0 ? "No assignments yet — add your first one below." : "Nothing in this view."}
          </div>
        ) : (
          visible.map((a, i) => {
            const overdue = isOverdue(a);
            const hasDesc = !!(a.description && a.description.trim());
            const expanded = expandedIds.has(a.id);
            return (
              <div key={a.id} style={{ borderBottom: i < visible.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0.7rem 0", flexWrap: "wrap" }}>
                  <div
                    onClick={hasDesc ? () => toggleExpand(a.id) : undefined}
                    title={hasDesc ? (expanded ? "Hide description" : "Show description") : undefined}
                    style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "flex-start", gap: 6, cursor: hasDesc ? "pointer" : "default" }}
                  >
                    {hasDesc && (
                      <ChevronRight
                        size={15}
                        style={{ marginTop: 3, flexShrink: 0, color: "var(--text-muted)", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                      />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--text-primary)", textDecoration: a.status === "completed" ? "line-through" : "none", opacity: a.status === "completed" ? 0.65 : 1 }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: overdue ? "var(--terracotta)" : "var(--text-muted)" }}>
                        {a.course}
                        {a.due_date ? ` · Planner Due: ${fmtMD(plannerDue(a.due_date))} (Actual: ${fmtMD(parseDate(a.due_date))})` : " · No due date"}
                        {overdue ? " · Overdue" : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    <span className={PRIORITY[a.priority].cls}>{PRIORITY[a.priority].label}</span>
                    <button
                      onClick={() => cycleStatus(a)}
                      title="Click to change status"
                      style={{ fontSize: "0.7rem", padding: "2px 8px 2px 10px", borderRadius: 20, background: STATUS[a.status].bg, color: STATUS[a.status].color, fontWeight: 500, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 2 }}
                    >
                      {STATUS[a.status].label}
                      <ChevronDown size={12} style={{ opacity: 0.7 }} />
                    </button>
                    <button onClick={() => openEdit(a)} aria-label="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2 }}><Pencil size={15} /></button>
                    <button onClick={() => requestDelete(a)} aria-label="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2 }}><Trash2 size={15} /></button>
                  </div>
                </div>
                {hasDesc && expanded && (
                  <div style={{ padding: "0 0 0.7rem 21px", fontSize: "0.8rem", color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {a.description}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit (below the list) */}
      {!formOpen && (
        <button className="btn-add" onClick={openAdd} style={{ marginTop: "1rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <Plus size={16} /> New Assignment
        </button>
      )}
      {formOpen && (
        <div className="form-section" ref={formRef} style={{ marginTop: "1rem", scrollMarginTop: "1rem" }}>
          <h3>{editingId ? "Edit Assignment" : "Add Assignment"}</h3>
          <div className="input-row">
            <div className="field-group"><div className="field-label">Course</div>
              {courseNames.length === 0 && !fCourse ? (
                <div className="field-input" style={{ color: "var(--text-muted)", fontStyle: "italic", display: "flex", alignItems: "center" }}>
                  No courses yet — add one on the Courses page.
                </div>
              ) : (
                <select className="field-select" value={fCourse} onChange={(e) => setFCourse(e.target.value)}>
                  {/* Keep an already-saved course selectable even if it's no longer in the list. */}
                  {fCourse && !courseNames.includes(fCourse) && <option key={fCourse}>{fCourse}</option>}
                  {courseNames.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}
            </div>
            <div className="field-group"><div className="field-label">Title</div>
              <input className="field-input" value={fTitle} onChange={(e) => { setFTitle(e.target.value); if (formError) setFormError(""); }} placeholder="Assignment title" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: "0.75rem" }}>
            <div className="field-group"><div className="field-label">Actual Due Date</div><input className="field-input" type="date" value={fDue} onChange={(e) => setFDue(e.target.value)} /></div>
            <div className="field-group"><div className="field-label">Due Time</div><input className="field-input" type="time" value={fTime} onChange={(e) => setFTime(e.target.value)} /></div>
            <div className="field-group"><div className="field-label">Type</div><select className="field-select" value={fType} onChange={(e) => setFType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field-group"><div className="field-label">Priority</div>
              <select className="field-select" value={fPriority} onChange={(e) => setFPriority(e.target.value as Priority)}>
                <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="input-row single"><div className="field-group"><div className="field-label">Description</div><textarea className="field-textarea" value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="Assignment details..." /></div></div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn-add" onClick={(e) => { e.currentTarget.blur(); submit(); }}>{editingId ? "Save Changes" : "+ Add Assignment"}</button>
            <button className="btn-outline" onClick={() => { setFormOpen(false); resetForm(); }} style={{ padding: "0.5rem 1rem" }}>Cancel</button>
            {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
