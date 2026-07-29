"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2, Plus, ChevronDown, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { useCollapsibleForm } from "@/lib/use-collapsible-form";
import { DetailSheet, DetailRow } from "@/components/detail-sheet";
import { PageHeader, Card, StatCard, Progress, Field, Input, Select, Textarea, Button, Badge, Tabs, EmptyState } from "@/components/kit";

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

const PRIORITY: Record<Priority, { label: string; tone: "terracotta" | "ochre" | "olive"; rank: number }> = {
  high: { label: "High", tone: "terracotta", rank: 0 },
  medium: { label: "Medium", tone: "ochre", rank: 1 },
  low: { label: "Low", tone: "olive", rank: 2 },
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
  const [detail, setDetail] = useState<Assignment | null>(null);

  const { open: formOpen, formRef, openForm, closeForm: collapseForm, scrollFormIntoView } = useCollapsibleForm();
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
    openForm();
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
    if (!formOpen) openForm();
    else scrollFormIntoView();
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
    collapseForm();
    resetForm();
  }

  async function cycleStatus(a: Assignment) {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(a.status) + 1) % 3];
    setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    await supabase.from("assignments").update({ status: next }).eq("id", a.id);
  }

  function requestDelete(a: Assignment) {
    if (editingId === a.id) { collapseForm(); resetForm(); }
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
      <PageHeader
        icon={<ClipboardList size={22} />}
        title="Assignments"
        subtitle="Stay ahead — never miss a deadline"
        actions={!formOpen ? (
          <Button className="k-desktop-only" onClick={openAdd}>
            <Plus size={16} /> New Assignment
          </Button>
        ) : undefined}
      />

      {/* Stats */}
      <div className="k-stats-grid" style={{ marginBottom: "1.5rem" }}>
        <StatCard tone="terracotta" label="Total" value={total} />
        <StatCard tone="ochre" label="In Progress" value={inProgress} />
        <StatCard tone="olive" label="Completed" value={counts.completed} />
        <StatCard tone="forest" label="Completion Rate" value={`${rate}%`}>
          <Progress value={rate} tone="olive" style={{ marginTop: "0.55rem" }} />
        </StatCard>
      </div>

      {/* Filter tabs */}
      <div style={{ marginBottom: "1rem", overflowX: "auto" }}>
        <Tabs
          aria-label="Filter assignments"
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          items={tabs.map((t) => ({ value: t.key, label: `${t.label} (${counts[t.key]})` }))}
        />
      </div>

      {/* List */}
      <Card>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem", fontStyle: "italic" }}>Loading…</div>
        ) : visible.length === 0 ? (
          total === 0 ? (
            <EmptyState
              icon={<ClipboardList size={26} />}
              title="No assignments yet"
              description="Add your first assignment to start tracking deadlines."
            />
          ) : (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem", fontStyle: "italic" }}>
              Nothing in this view.
            </div>
          )
        ) : (
          visible.map((a, i) => {
            const overdue = isOverdue(a);
            return (
              <div key={a.id} style={{ borderBottom: i < visible.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3" style={{ padding: "0.7rem 0" }}>
                  <div
                    onClick={() => setDetail(a)}
                    role="button"
                    aria-label={`${a.title} — view details`}
                    title="View details"
                    style={{ minWidth: 0, flex: 1, cursor: "pointer" }}
                  >
                    <div style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--text-primary)", textDecoration: a.status === "completed" ? "line-through" : "none", opacity: a.status === "completed" ? 0.65 : 1 }}>
                      {a.title}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: overdue ? "var(--terracotta)" : "var(--text-muted)" }}>
                      {a.course}
                      {a.due_date ? ` · Planner Due: ${fmtMD(plannerDue(a.due_date))} (Actual: ${fmtMD(parseDate(a.due_date))})` : " · No due date"}
                      {overdue ? " · Overdue" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-normal">
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <Badge tone={PRIORITY[a.priority].tone}>{PRIORITY[a.priority].label}</Badge>
                      <button
                        onClick={() => cycleStatus(a)}
                        title="Click to change status"
                        style={{ fontSize: "0.7rem", padding: "2px 8px 2px 10px", borderRadius: 20, background: STATUS[a.status].bg, color: STATUS[a.status].color, fontWeight: 500, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 2 }}
                      >
                        {STATUS[a.status].label}
                        <ChevronDown size={12} style={{ opacity: 0.7 }} />
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <button onClick={() => openEdit(a)} aria-label="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2 }}><Pencil size={15} /></button>
                      <button onClick={() => requestDelete(a)} aria-label="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2 }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Card>

      {/* Mobile: the "New" action sits at the bottom-left of the list. */}
      {!formOpen && (
        <div className="k-mobile-only k-mobile-add">
          <Button onClick={openAdd}><Plus size={16} /> New Assignment</Button>
        </div>
      )}

      {/* Add / Edit (below the list) */}
      {formOpen && (
        <div ref={formRef} style={{ marginTop: "1.5rem", scrollMarginTop: "1rem" }}>
          <Card title={editingId ? "Edit Assignment" : "Add Assignment"} icon={<ClipboardList size={20} />}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "0.75rem" }}>
              <Field label="Course" htmlFor="a-course">
                {courseNames.length === 0 && !fCourse ? (
                  <div className="k-input" style={{ color: "var(--text-muted)", fontStyle: "italic", display: "flex", alignItems: "center" }}>
                    No courses yet — add one on the Courses page.
                  </div>
                ) : (
                  <Select id="a-course" value={fCourse} onChange={(e) => setFCourse(e.target.value)}>
                    {/* Keep an already-saved course selectable even if it's no longer in the list. */}
                    {fCourse && !courseNames.includes(fCourse) && <option key={fCourse}>{fCourse}</option>}
                    {courseNames.map((c) => <option key={c}>{c}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Title" htmlFor="a-title">
                <Input id="a-title" value={fTitle} onChange={(e) => { setFTitle(e.target.value); if (formError) setFormError(""); }} placeholder="Assignment title" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ margin: "0.75rem 0" }}>
              <Field label="Actual Due Date" htmlFor="a-due"><Input id="a-due" type="date" value={fDue} onChange={(e) => setFDue(e.target.value)} /></Field>
              <Field label="Due Time" htmlFor="a-time"><Input id="a-time" type="time" value={fTime} onChange={(e) => setFTime(e.target.value)} /></Field>
              <Field label="Type" htmlFor="a-type"><Select id="a-type" value={fType} onChange={(e) => setFType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
              <Field label="Priority" htmlFor="a-priority">
                <Select id="a-priority" value={fPriority} onChange={(e) => setFPriority(e.target.value as Priority)}>
                  <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </Select>
              </Field>
            </div>
            <Field label="Description" htmlFor="a-desc">
              <Textarea id="a-desc" value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="Assignment details..." />
            </Field>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "1.1rem" }}>
              <Button onClick={(e) => { e.currentTarget.blur(); submit(); }}>{editingId ? "Save Changes" : "Add Assignment"}</Button>
              <Button variant="outline" onClick={() => { collapseForm(); resetForm(); }}>Cancel</Button>
              {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
            </div>
          </Card>
        </div>
      )}

      <DetailSheet
        open={!!detail}
        onOpenChange={(o) => { if (!o) setDetail(null); }}
        title={detail?.title ?? ""}
      >
        {detail && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", padding: "2px 10px", borderRadius: 20, background: STATUS[detail.status].bg, color: STATUS[detail.status].color, fontWeight: 500 }}>{STATUS[detail.status].label}</span>
              <Badge tone={PRIORITY[detail.priority].tone}>{PRIORITY[detail.priority].label}</Badge>
              {isOverdue(detail) && <Badge tone="terracotta">Overdue</Badge>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              {detail.course && <DetailRow label="Course">{detail.course}</DetailRow>}
              {detail.type && <DetailRow label="Type">{detail.type}</DetailRow>}
              {detail.due_date && <DetailRow label="Actual due">{fmtMD(parseDate(detail.due_date))}{detail.due_time ? ` · ${detail.due_time}` : ""}</DetailRow>}
              {detail.due_date && <DetailRow label="Planner due">{fmtMD(plannerDue(detail.due_date))}</DetailRow>}
            </div>
            {detail.description
              ? <DetailRow label="Description">{detail.description}</DetailRow>
              : <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic" }}>No description.</div>}
            <div style={{ marginTop: "0.25rem" }}>
              <Button size="sm" variant="outline" onClick={() => { const a = detail; setDetail(null); openEdit(a); }}><Pencil size={13} /> Edit</Button>
            </div>
          </div>
        )}
      </DetailSheet>
    </div>
  );
}
