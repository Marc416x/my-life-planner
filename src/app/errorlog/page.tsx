"use client";

import { useEffect, useRef, useState } from "react";
import { CircleX, Plus, Pencil, Trash2, Check, RotateCcw, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { useProfile } from "@/components/profile-provider";
import { useCollapsibleForm } from "@/lib/use-collapsible-form";
import { toISODate } from "@/lib/streak";
import { groupByDay, periodLabel, periodRange, type Granularity } from "@/lib/group-by-date";
import { applyTermScope } from "@/lib/term";
import { DetailSheet, DetailRow } from "@/components/detail-sheet";
import { ArchiveBanner } from "@/components/term-scope";
import { ProUpsell } from "@/components/pro-gate";
import { PageHeader, Card, StatCard, Field, Input, Select, Textarea, Button, Badge, EmptyState, DateGroupHeader, PeriodRow } from "@/components/kit";

type Course = { id: string; name: string };

type ErrorEntry = {
  id: string;
  course_id: string | null;
  topic: string | null;
  prompt: string;
  correct: string | null;
  reason: string | null;
  source: string | null;
  resolved: boolean;
  notes: string | null;
  occurred_on: string;
};

type Filter = "all" | "open" | "resolved";
type Period = { period_start: string; cnt: number; open_cnt: number };

const GRANS: { v: Granularity; label: string }[] = [
  { v: "day", label: "Day" },
  { v: "week", label: "Week" },
  { v: "month", label: "Month" },
];

// A window of the list, not the whole history — "Load more" fetches the next slice.
const PAGE = 15;

const REASONS = [
  { v: "misread", label: "Misread the question" },
  { v: "knowledge_gap", label: "Knowledge gap" },
  { v: "careless", label: "Careless mistake" },
  { v: "timing", label: "Ran out of time" },
  { v: "other", label: "Other" },
];
const SOURCES = ["Quiz", "Exam", "Clinical", "Practice", "Lecture", "Other"];

const REASON_LABEL: Record<string, string> = Object.fromEntries(REASONS.map((r) => [r.v, r.label]));
function reasonTone(r: string | null): "terracotta" | "olive" | "ochre" | "forest" | "neutral" {
  switch (r) {
    case "knowledge_gap": return "terracotta";
    case "misread": return "ochre";
    case "careless": return "forest";
    case "timing": return "olive";
    default: return "neutral";
  }
}

export default function ErrorLogPage() {
  const supabase = createClient();
  const toast = useToast();
  const { isPro, viewTerm } = useProfile();

  const [userId, setUserId] = useState<string | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [items, setItems] = useState<ErrorEntry[]>([]);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detail, setDetail] = useState<ErrorEntry | null>(null);

  // Group-by (Day | Week | Month). Week/Month use DB roll-ups; the All/Open/Resolved
  // filter applies to Day view only (roll-ups always cover every entry in the period).
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [openPeriods, setOpenPeriods] = useState<Set<string>>(new Set());
  const [periodItems, setPeriodItems] = useState<Record<string, ErrorEntry[]>>({});

  // Global counts (cheap head-count queries) — independent of the current filter.
  const [openCount, setOpenCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const { open: formOpen, formRef, openForm, closeForm: collapseForm, scrollFormIntoView } = useCollapsibleForm();
  const [fCourse, setFCourse] = useState("");
  const [fTopic, setFTopic] = useState("");
  const [fPrompt, setFPrompt] = useState("");
  const [fCorrect, setFCorrect] = useState("");
  const [fReason, setFReason] = useState(REASONS[1].v);
  const [fSource, setFSource] = useState(SOURCES[0]);
  const [fDate, setFDate] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const pending = useRef<Map<string, { item: ErrorEntry; timeout: number }>>(new Map());

  const listCols = "id, course_id, topic, prompt, correct, reason, source, resolved, notes, occurred_on";

  // `s` is the term scope (null = current). `t` lets callers pass a freshly
  // fetched current term before `term` state has settled (initial load).
  async function fetchList(f: Filter, p: number, append: boolean, s: string | null, t: string | null = term) {
    const from = p * PAGE;
    let q = applyTermScope(
      supabase
        .from("error_log")
        .select(listCols, { count: "exact" })
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1),
      s, t,
    );
    if (f === "open") q = q.eq("resolved", false);
    if (f === "resolved") q = q.eq("resolved", true);
    const { data, count } = await q;
    setFilteredTotal(count ?? 0);
    setItems((xs) => (append ? [...xs, ...((data as ErrorEntry[]) ?? [])] : ((data as ErrorEntry[]) ?? [])));
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) { setLoading(false); return; }
      // Profile first — its `year` is the current term the counts + list filter on.
      const { data: profile } = await supabase.from("profiles").select("year").eq("id", user.id).single();
      const yr = (profile?.year as string) ?? null;
      setTerm(yr);
      const [{ data: courseRows }, openRes, totalRes] = await Promise.all([
        supabase.from("courses").select("id, name").order("created_at", { ascending: true }),
        applyTermScope(supabase.from("error_log").select("id", { count: "exact", head: true }).eq("resolved", false), null, yr),
        applyTermScope(supabase.from("error_log").select("id", { count: "exact", head: true }), null, yr),
      ]);
      const cs = (courseRows as Course[]) ?? [];
      setCourses(cs);
      if (cs.length) setFCourse(cs[0].id);
      setOpenCount(openRes.count ?? 0);
      setTotalCount(totalRes.count ?? 0);
      await fetchList("all", 0, false, viewTerm, yr);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const courseName = (id: string | null) => (id ? courses.find((c) => c.id === id)?.name ?? "General" : "General");
  const resolvedCount = Math.max(0, totalCount - openCount);
  const reviewRate = totalCount ? Math.round((resolvedCount / totalCount) * 100) : 0;

  function changeFilter(f: Filter) {
    if (f === filter) return;
    setFilter(f);
    setPage(0);
    fetchList(f, 0, false, viewTerm);
  }

  async function loadMore() {
    const next = page + 1;
    setLoadingMore(true);
    await fetchList(filter, next, true, viewTerm);
    setPage(next);
    setLoadingMore(false);
  }

  function resetForm() {
    setEditingId(null);
    setFormError("");
    setFTopic("");
    setFPrompt("");
    setFCorrect("");
    setFNotes("");
    setFDate("");
  }

  function openEditError(e: ErrorEntry) {
    setEditingId(e.id);
    setFormError("");
    setFCourse(e.course_id ?? "");
    setFTopic(e.topic ?? "");
    setFPrompt(e.prompt);
    setFCorrect(e.correct ?? "");
    setFReason(e.reason ?? REASONS[1].v);
    setFSource(e.source ?? SOURCES[0]);
    setFDate(e.occurred_on);
    setFNotes(e.notes ?? "");
    setDetail(null);
    if (!formOpen) openForm();
    else scrollFormIntoView();
  }

  async function saveEntry() {
    if (!userId) return;
    if (!fPrompt.trim()) { setFormError("Describe what you got wrong."); return; }
    setFormError("");
    const fields = {
      course_id: fCourse || null,
      topic: fTopic.trim() || null,
      prompt: fPrompt.trim(),
      correct: fCorrect.trim() || null,
      reason: fReason,
      source: fSource,
      notes: fNotes.trim() || null,
      occurred_on: fDate || toISODate(new Date()),
    };

    if (editingId) {
      const { data, error } = await supabase.from("error_log").update(fields).eq("id", editingId).select(listCols).single();
      if (error || !data) { setFormError("Could not save — please try again."); return; }
      setItems((xs) => xs.map((x) => (x.id === editingId ? (data as ErrorEntry) : x)));
      collapseForm();
      resetForm();
      return;
    }

    // New errors are always "open" → show up under All and Open, not Resolved.
    const { data, error } = await supabase.from("error_log").insert({ user_id: userId, term, resolved: false, ...fields }).select(listCols).single();
    if (error || !data) { setFormError("Could not save — please try again."); return; }
    if (filter !== "resolved") { setItems((xs) => [data as ErrorEntry, ...xs]); setFilteredTotal((n) => n + 1); }
    setOpenCount((n) => n + 1);
    setTotalCount((n) => n + 1);
    setFTopic("");
    setFPrompt("");
    setFCorrect("");
    setFNotes("");
    setFDate("");
    scrollFormIntoView();
  }

  async function toggleResolved(entry: ErrorEntry) {
    const next = !entry.resolved;
    setItems((xs) => xs.map((x) => (x.id === entry.id ? { ...x, resolved: next } : x)));
    setOpenCount((n) => Math.max(0, n + (next ? -1 : 1)));
    await supabase.from("error_log").update({ resolved: next }).eq("id", entry.id);
  }

  function requestDelete(entry: ErrorEntry) {
    setItems((xs) => xs.filter((x) => x.id !== entry.id));
    setFilteredTotal((n) => Math.max(0, n - 1));
    setTotalCount((n) => Math.max(0, n - 1));
    if (!entry.resolved) setOpenCount((n) => Math.max(0, n - 1));
    const timeout = window.setTimeout(async () => {
      pending.current.delete(entry.id);
      await supabase.from("error_log").delete().eq("id", entry.id);
    }, 5000);
    pending.current.set(entry.id, { item: entry, timeout });
    toast.show("Error deleted", {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = pending.current.get(entry.id);
        if (!p) return;
        clearTimeout(p.timeout);
        pending.current.delete(entry.id);
        setItems((xs) => [p.item, ...xs.filter((x) => x.id !== entry.id)]);
        setFilteredTotal((n) => n + 1);
        setTotalCount((n) => n + 1);
        if (!entry.resolved) setOpenCount((n) => n + 1);
      },
    });
  }

  function openAdd() { resetForm(); openForm(); }

  // ---- Group-by: Day / Week / Month ----
  async function loadPeriods(g: "week" | "month") {
    setPeriodsLoading(true);
    const { data } = await supabase.rpc("error_log_periods", { p_gran: g, p_scope: viewTerm });
    setPeriods((data as Period[]) ?? []);
    setPeriodsLoading(false);
  }

  function changeGranularity(g: Granularity) {
    if (g === granularity) return;
    setGranularity(g);
    setOpenPeriods(new Set());
    setPeriodItems({});
    if (g !== "day") loadPeriods(g);
  }

  // Expand a week/month → lazily load that period's individual errors (all of them,
  // regardless of the day-view filter).
  async function togglePeriod(key: string) {
    setOpenPeriods((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
    if (!periodItems[key] && granularity !== "day") {
      const { start, end } = periodRange(key, granularity);
      const { data } = await applyTermScope(
        supabase
          .from("error_log")
          .select(listCols)
          .gte("occurred_on", start).lte("occurred_on", end)
          .order("occurred_on", { ascending: false })
          .order("created_at", { ascending: false }),
        viewTerm, term,
      );
      setPeriodItems((prev) => ({ ...prev, [key]: (data as ErrorEntry[]) ?? [] }));
    }
  }

  // Viewing an archived term (set globally in Settings) is read-only; non-Pro
  // users see the upsell instead.
  const readOnly = viewTerm !== null;
  const locked = readOnly && !isPro;

  function renderErrorCard(e: ErrorEntry) {
    return (
      <div
        key={e.id}
        onClick={() => setDetail(e)}
        role="button"
        aria-label={`Error in ${courseName(e.course_id)} — view details`}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--s-radius-sm)", padding: "1.1rem", cursor: "pointer", opacity: e.resolved ? 0.72 : 1, display: "flex", flexDirection: "column" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{courseName(e.course_id)}{e.topic ? ` — ${e.topic}` : ""}</div>
            <div style={{ display: "flex", gap: "0.35rem", marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
              {e.reason && <Badge tone={reasonTone(e.reason)}>{REASON_LABEL[e.reason] ?? e.reason}</Badge>}
              {e.source && <Badge tone="neutral">{e.source}</Badge>}
            </div>
          </div>
          {!readOnly && <button onClick={(ev) => { ev.stopPropagation(); requestDelete(e); }} aria-label="Delete error" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2, flexShrink: 0 }}><Trash2 size={14} /></button>}
        </div>

        <div style={{ fontSize: "0.82rem", color: "var(--text-primary, var(--text))", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.prompt}</div>

        {!readOnly && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 4, marginTop: "auto", paddingTop: "0.7rem" }}>
            <Button size="sm" variant={e.resolved ? "ghost" : "outline"} onClick={(ev) => { ev.stopPropagation(); toggleResolved(e); }}>
              {e.resolved ? <><RotateCcw size={13} /> Reopen</> : <><Check size={13} /> Mark resolved</>}
            </Button>
          </div>
        )}
      </div>
    );
  }

  function renderDayGroups(list: ErrorEntry[]) {
    return groupByDay(list, (e) => e.occurred_on).map((group) => {
      const openInGroup = group.items.filter((e) => !e.resolved).length;
      const n = group.items.length;
      return (
        <div key={group.key} style={{ marginBottom: "1.25rem" }}>
          <DateGroupHeader
            label={group.label}
            summary={`${n} ${n === 1 ? "error" : "errors"}${openInGroup ? ` · ${openInGroup} open` : ""}`}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.items.map(renderErrorCard)}
          </div>
        </div>
      );
    });
  }

  const groupByControl = (
    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Group by</span>
      {GRANS.map((g) => (
        <Button key={g.v} size="sm" variant={granularity === g.v ? "primary" : "ghost"} onClick={() => changeGranularity(g.v)}>{g.label}</Button>
      ))}
    </div>
  );

  const FILTERS: { v: Filter; label: string }[] = [
    { v: "all", label: "All" },
    { v: "open", label: "Open" },
    { v: "resolved", label: "Resolved" },
  ];

  return (
    <div className="page active">
      <PageHeader
        icon={<CircleX size={22} />}
        title="Error Log"
        subtitle="Capture every mistake, review it, and turn it into a win."
        actions={(!formOpen && !readOnly) ? (
          <Button className="k-desktop-only" onClick={openAdd}><Plus size={16} /> Log an error</Button>
        ) : undefined}
      />

      {readOnly && <ArchiveBanner term={viewTerm} />}

      {!readOnly && (
        <div className="k-stats-grid" style={{ marginBottom: "1.5rem" }}>
          <StatCard tone="terracotta" label="Open Errors" value={openCount} sub="still to review" icon={<AlertCircle size={18} />} />
          <StatCard tone="forest" label="Resolved" value={resolvedCount} sub="reviewed & mastered" icon={<Check size={18} />} />
          <StatCard tone="ochre" label="Total Logged" value={totalCount} sub="mistakes captured" icon={<CircleX size={18} />} />
          <StatCard tone="olive" label="Review Rate" value={`${reviewRate}%`} sub="of errors resolved" />
        </div>
      )}

      {/* Controls: group-by + (day-only) status filter */}
      {!loading && !locked && (viewTerm !== null || totalCount > 0) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          {groupByControl}
          {granularity === "day" && (
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {FILTERS.map((f) => (
                <Button key={f.v} size="sm" variant={filter === f.v ? "primary" : "ghost"} onClick={() => changeFilter(f.v)}>
                  {f.label}
                  {f.v === "open" && openCount > 0 ? ` (${openCount})` : ""}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {locked ? (
        <ProUpsell
          feature="The term archive"
          blurb={`Revisit your ${viewTerm} error log as read-only history — every mistake you logged stays reviewable.`}
          perks={["Browse every past term", "Read-only, never lost", "Week & month roll-ups per term"]}
        />
      ) : loading ? (
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
      ) : (viewTerm === null && totalCount === 0) ? (
        <Card>
          <EmptyState
            icon={<CircleX size={26} />}
            title="No errors logged yet"
            description="Every mistake you record here becomes a targeted review item before your next exam."
          />
        </Card>
      ) : granularity !== "day" ? (
        periodsLoading ? (
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
        ) : periods.length === 0 ? (
          <Card><EmptyState icon={<CircleX size={26} />} title="Nothing to roll up" description="Log an error to see it grouped here." /></Card>
        ) : (
          periods.map((p) => (
            <PeriodRow
              key={p.period_start}
              label={periodLabel(p.period_start, granularity)}
              summary={`${p.cnt} ${p.cnt === 1 ? "error" : "errors"}${p.open_cnt ? ` · ${p.open_cnt} open` : ""}`}
              open={openPeriods.has(p.period_start)}
              onToggle={() => togglePeriod(p.period_start)}
            >
              {periodItems[p.period_start]
                ? renderDayGroups(periodItems[p.period_start])
                : <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic", padding: "0.5rem" }}>Loading…</div>}
            </PeriodRow>
          ))
        )
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={<Check size={26} />} title={filter === "open" ? "Nothing open — you're all caught up!" : "No entries here"} description={filter === "open" ? "You've reviewed every mistake. Keep it up." : "Try a different filter."} />
        </Card>
      ) : (
        <>
          {renderDayGroups(items)}
          {items.length < filteredTotal && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "1.25rem" }}>
              <Button variant="outline" onClick={loadMore} loading={loadingMore}>Load more</Button>
            </div>
          )}
        </>
      )}

      {/* Mobile: the add action sits below the list. */}
      {!formOpen && !readOnly && (
        <div className="k-mobile-only k-mobile-add">
          <Button onClick={openAdd}><Plus size={16} /> Log an error</Button>
        </div>
      )}

      {/* ADD ERROR */}
      {formOpen && !readOnly && (
        <div ref={formRef} style={{ scrollMarginTop: "1rem", marginTop: "1.5rem" }}>
          <Card title={editingId ? "Edit error" : "Log an error"} icon={editingId ? <Pencil size={20} /> : <CircleX size={20} />}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "0.75rem" }}>
              <Field label="Course" htmlFor="e-course">
                <Select id="e-course" value={fCourse} onChange={(e) => setFCourse(e.target.value)}>
                  <option value="">General</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Topic" htmlFor="e-topic"><Input id="e-topic" value={fTopic} onChange={(e) => setFTopic(e.target.value)} placeholder="e.g., Beta blockers" /></Field>
              <Field label="Date" htmlFor="e-date"><Input id="e-date" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} /></Field>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <Field label="What did you get wrong?" htmlFor="e-prompt"><Textarea id="e-prompt" value={fPrompt} onChange={(e) => { setFPrompt(e.target.value); if (formError) setFormError(""); }} placeholder="The question, or a description of the mistake…" /></Field>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <Field label="Correct answer" htmlFor="e-correct"><Textarea id="e-correct" value={fCorrect} onChange={(e) => setFCorrect(e.target.value)} placeholder="What it should have been, and why…" /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
              <Field label="Why did you miss it?" htmlFor="e-reason"><Select id="e-reason" value={fReason} onChange={(e) => setFReason(e.target.value)}>{REASONS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}</Select></Field>
              <Field label="Source" htmlFor="e-source"><Select id="e-source" value={fSource} onChange={(e) => setFSource(e.target.value)}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <Field label="Notes (optional)" htmlFor="e-notes"><Textarea id="e-notes" value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="A memory hook, a rule, anything to make it stick…" /></Field>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "1.1rem" }}>
              <Button onClick={(e) => { e.currentTarget.blur(); saveEntry(); }}>{editingId ? "Save changes" : "Add error"}</Button>
              <Button variant="outline" onClick={() => { collapseForm(); resetForm(); }}>{editingId ? "Cancel" : "Done"}</Button>
              {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
            </div>
          </Card>
        </div>
      )}

      <DetailSheet
        open={!!detail}
        onOpenChange={(o) => { if (!o) setDetail(null); }}
        title={detail ? `${courseName(detail.course_id)}${detail.topic ? ` — ${detail.topic}` : ""}` : ""}
      >
        {detail && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
              {detail.reason && <Badge tone={reasonTone(detail.reason)}>{REASON_LABEL[detail.reason] ?? detail.reason}</Badge>}
              {detail.source && <Badge tone="neutral">{detail.source}</Badge>}
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{detail.occurred_on}</span>
            </div>
            <DetailRow label="What went wrong">{detail.prompt}</DetailRow>
            {detail.correct && <DetailRow label="Correct answer">{detail.correct}</DetailRow>}
            {detail.notes && <DetailRow label="Notes">{detail.notes}</DetailRow>}
            {!readOnly && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                <Button
                  size="sm"
                  variant={detail.resolved ? "ghost" : "primary"}
                  onClick={() => { toggleResolved(detail); setDetail({ ...detail, resolved: !detail.resolved }); }}
                >
                  {detail.resolved ? <><RotateCcw size={13} /> Reopen</> : <><Check size={13} /> Mark resolved</>}
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEditError(detail)}><Pencil size={13} /> Edit</Button>
              </div>
            )}
          </div>
        )}
      </DetailSheet>
    </div>
  );
}
