"use client";

import { useEffect, useRef, useState } from "react";
import { Target, PenLine, Plus, Pencil, Trash2, ChevronRight, FileText, StickyNote, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { useProfile } from "@/components/profile-provider";
import { useCollapsibleForm } from "@/lib/use-collapsible-form";
import { groupByDay, groupByPeriod, periodLabel, type Granularity } from "@/lib/group-by-date";
import { applyTermScope } from "@/lib/term";
import { DetailSheet } from "@/components/detail-sheet";
import { ArchiveBanner } from "@/components/term-scope";
import { ProUpsell } from "@/components/pro-gate";
import { PageHeader, Card, StatCard, Section, Field, Input, Select, Textarea, Button, EmptyState, DateGroupHeader, PeriodRow } from "@/components/kit";

const GRANS: { v: Granularity; label: string }[] = [
  { v: "day", label: "Day" },
  { v: "week", label: "Week" },
  { v: "month", label: "Month" },
];

type ClinicalSession = {
  id: string;
  session_date: string | null;
  hours: number | null;
  difficulty: string | null;
  supervisor: string | null;
  department: string | null;
  goal: string | null;
  prep: string | null;
  reflections: string | null;
  takeaways: string | null;
};

const CLIN_COLS =
  "id, session_date, hours, difficulty, supervisor, department, goal, prep, reflections, takeaways";

const DIFFICULTIES = ["Easy", "Medium", "Hard", "Very Hard"];
const DIFF_NUM: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3, "Very Hard": 4 };
const DIFF_SHORT = ["Easy", "Med", "Hard", "V.Hard"];

type IconType = React.ComponentType<{ size?: number | string }>;

// Difficulty badge palette — easier is olive, harder trends terracotta.
function difficultyStyle(d: string | null) {
  switch (d) {
    case "Easy": return { bg: "var(--olive-light)", color: "var(--olive)" };
    case "Medium": return { bg: "var(--ochre-light)", color: "#7A5A10" };
    case "Hard": return { bg: "var(--terracotta-light)", color: "var(--terracotta)" };
    case "Very Hard": return { bg: "var(--terracotta-light)", color: "var(--terracotta-dark)" };
    default: return { bg: "var(--olive-light)", color: "var(--olive)" };
  }
}

// Trim a whole number to "4", keep one decimal otherwise ("4.5").
function fmtHours(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// Parse the date at local midnight so there's no UTC off-by-one, then format.
function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function sortSessions(xs: ClinicalSession[]) {
  // Most recent session first; undated sessions sink to the bottom.
  return [...xs].sort((a, b) => {
    if (!a.session_date) return 1;
    if (!b.session_date) return -1;
    return b.session_date.localeCompare(a.session_date);
  });
}

// One labelled block in the detail view; only rendered when there's content.
function DetailSection({ label, icon: Icon, value }: { label: string; icon: IconType; value: string }) {
  return (
    <div className="sheet-section">
      <div className="sheet-section-label"><Icon size={13} /> {label}</div>
      <div className="sheet-section-body">{value}</div>
    </div>
  );
}

// Detail body (everything below the title) — rendered inside either the desktop
// Dialog or the mobile Drawer's scroll area. The title is rendered separately by
// each surface so it can live in the Drawer's fixed drag-area header.
function DetailContent({
  session, onEdit, onDelete, onClose, readOnly,
}: {
  session: ClinicalSession;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const badge = difficultyStyle(session.difficulty);
  const hasNotes = !!(session.goal || session.prep || session.reflections || session.takeaways);
  return (
    <>
      <div className="sheet-sub">
        {session.session_date && <span><Calendar size={13} /> {formatDate(session.session_date)}</span>}
        {session.hours != null && <span>{fmtHours(session.hours)} hrs</span>}
        {session.supervisor && <span>Supervisor: {session.supervisor}</span>}
      </div>
      {session.difficulty && <span className="sheet-badge" style={{ background: badge.bg, color: badge.color }}>{session.difficulty}</span>}

      {session.goal && <DetailSection label="Goal for the day" icon={Target} value={session.goal} />}
      {session.prep && <DetailSection label="Prepare before" icon={FileText} value={session.prep} />}
      {session.reflections && <DetailSection label="Reflections after" icon={PenLine} value={session.reflections} />}
      {session.takeaways && <DetailSection label="Key takeaways" icon={StickyNote} value={session.takeaways} />}
      {!hasNotes && <div className="sheet-section-body" style={{ fontStyle: "italic", color: "var(--text-muted)" }}>No notes recorded for this session.</div>}

      <div className="sheet-actions">
        {!readOnly && <Button size="sm" onClick={onEdit}><Pencil size={14} /> Edit</Button>}
        {!readOnly && <Button size="sm" variant="danger" onClick={onDelete}><Trash2 size={14} /> Delete</Button>}
        <Button size="sm" variant="outline" className="sheet-action-spacer" onClick={onClose}>Close</Button>
      </div>
    </>
  );
}

export default function ClinicalsPage() {
  const supabase = createClient();
  const toast = useToast();
  const { isPro, viewTerm } = useProfile();

  const [sessions, setSessions] = useState<ClinicalSession[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Detail view (dialog on desktop, bottom sheet on mobile). `detail` is kept
  // set through the close animation so the body stays rendered while it exits.
  const [detail, setDetail] = useState<ClinicalSession | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Group-by (Day | Week | Month). The page holds its full history in memory, so
  // week/month roll-ups are grouped client-side (exact totals, no extra query).
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [openPeriods, setOpenPeriods] = useState<Set<string>>(new Set());

  // Add / edit form state. Open/close + auto-scroll handled by the shared hook.
  const { open: formOpen, formRef, openForm, closeForm: collapseForm, scrollFormIntoView } = useCollapsibleForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fDate, setFDate] = useState("");
  const [fHours, setFHours] = useState("");
  const [fDifficulty, setFDifficulty] = useState("Medium");
  const [fSupervisor, setFSupervisor] = useState("");
  const [fDepartment, setFDepartment] = useState("");
  const [fGoal, setFGoal] = useState("");
  const [fPrep, setFPrep] = useState("");
  const [fReflections, setFReflections] = useState("");
  const [fTakeaways, setFTakeaways] = useState("");
  const [formError, setFormError] = useState("");

  const pending = useRef<Map<string, { item: ClinicalSession; timeout: number }>>(new Map());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) { setLoading(false); return; }
      // Profile first — its `year` is the current term the session list filters on.
      const { data: profile } = await supabase.from("profiles").select("year").eq("id", user.id).single();
      const yr = (profile?.year as string) ?? null;
      setTerm(yr);
      const { data } = await applyTermScope(
        supabase.from("clinical_sessions").select(CLIN_COLS).order("session_date", { ascending: false, nullsFirst: false }),
        viewTerm, yr,
      );
      setSessions(sortSessions((data as ClinicalSession[]) ?? []));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openDetail(s: ClinicalSession) {
    setDetail(s);
    setDetailOpen(true);
  }

  function resetFields() {
    setFDate("");
    setFHours("");
    setFDifficulty("Medium");
    setFSupervisor("");
    setFDepartment("");
    setFGoal("");
    setFPrep("");
    setFReflections("");
    setFTakeaways("");
  }

  function openAdd() {
    setEditingId(null);
    setFormError("");
    resetFields();
    openForm();
  }

  function openEdit(s: ClinicalSession) {
    setEditingId(s.id);
    setFormError("");
    setFDate(s.session_date ?? "");
    setFHours(s.hours != null ? String(s.hours) : "");
    setFDifficulty(s.difficulty ?? "Medium");
    setFSupervisor(s.supervisor ?? "");
    setFDepartment(s.department ?? "");
    setFGoal(s.goal ?? "");
    setFPrep(s.prep ?? "");
    setFReflections(s.reflections ?? "");
    setFTakeaways(s.takeaways ?? "");
    if (!formOpen) openForm(); // effect scrolls it into view
    else scrollFormIntoView(); // already open — bring it into view now
  }

  function closeForm() {
    setEditingId(null);
    setFormError("");
    collapseForm();
  }

  async function submit() {
    if (!userId) return;
    if (!fDate) { setFormError("Pick a date for the session."); return; }
    setFormError("");

    const payload = {
      session_date: fDate,
      hours: fHours === "" ? null : Number(fHours),
      difficulty: fDifficulty,
      supervisor: fSupervisor.trim() || null,
      department: fDepartment.trim() || null,
      goal: fGoal.trim() || null,
      prep: fPrep.trim() || null,
      reflections: fReflections.trim() || null,
      takeaways: fTakeaways.trim() || null,
    };

    if (editingId) {
      const { data, error } = await supabase.from("clinical_sessions").update(payload).eq("id", editingId).select(CLIN_COLS).single();
      if (error || !data) { setFormError("Could not save — please try again."); return; }
      setSessions((xs) => sortSessions(xs.map((x) => (x.id === editingId ? (data as ClinicalSession) : x))));
      closeForm();
    } else {
      const { data, error } = await supabase.from("clinical_sessions").insert({ user_id: userId, term, ...payload }).select(CLIN_COLS).single();
      if (error || !data) { setFormError("Could not save — please try again."); return; }
      setSessions((xs) => sortSessions([...xs, data as ClinicalSession]));
      // Keep the rotation context (difficulty, supervisor, ward) for quick
      // repeat entry; clear the per-day fields and keep the form in view.
      setFDate("");
      setFHours("");
      setFGoal("");
      setFPrep("");
      setFReflections("");
      setFTakeaways("");
      scrollFormIntoView();
    }
  }

  function requestDelete(s: ClinicalSession) {
    if (editingId === s.id) closeForm();
    setSessions((xs) => xs.filter((x) => x.id !== s.id));
    const timeout = window.setTimeout(async () => {
      pending.current.delete(s.id);
      await supabase.from("clinical_sessions").delete().eq("id", s.id);
    }, 5000);
    pending.current.set(s.id, { item: s, timeout });
    toast.show("Clinical session deleted", {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = pending.current.get(s.id);
        if (!p) return;
        clearTimeout(p.timeout);
        pending.current.delete(s.id);
        setSessions((xs) => sortSessions([...xs, p.item]));
      },
    });
  }

  // Edit / delete launched from inside the detail view: close it first, then
  // hand off to the existing form / delete flows.
  function editFromDetail() {
    if (!detail) return;
    const s = detail;
    setDetailOpen(false);
    openEdit(s);
  }
  function deleteFromDetail() {
    if (!detail) return;
    const s = detail;
    setDetailOpen(false);
    requestDelete(s);
  }

  // ----- Stat cards, computed from the logged sessions -----
  const totalHours = sessions.reduce((sum, s) => sum + (s.hours ?? 0), 0);
  const sessionCount = sessions.length;
  const withHours = sessions.filter((s) => s.hours != null);
  const avgLength = withHours.length ? totalHours / withHours.length : null;
  const diffVals = sessions.map((s) => (s.difficulty ? DIFF_NUM[s.difficulty] : undefined)).filter((n): n is number => n != null);
  const avgDiffNum = diffVals.length ? diffVals.reduce((a, b) => a + b, 0) / diffVals.length : null;
  const avgDiffIdx = avgDiffNum != null ? Math.min(4, Math.max(1, Math.round(avgDiffNum))) : null;

  // Viewing an archived term (set globally in Settings) is read-only; non-Pro
  // users see the upsell instead.
  const readOnly = viewTerm !== null;
  const locked = readOnly && !isPro;

  // ----- Group-by: Day / Week / Month (all in-memory) -----
  function changeGranularity(g: Granularity) {
    if (g === granularity) return;
    setGranularity(g);
    setOpenPeriods(new Set());
  }
  function togglePeriod(key: string) {
    setOpenPeriods((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }

  const datedSessions = sessions.filter((s) => s.session_date);
  const undatedSessions = sessions.filter((s) => !s.session_date);

  function groupSummary(list: ClinicalSession[]) {
    const hrs = list.reduce((n, s) => n + (s.hours ?? 0), 0);
    const n = list.length;
    return `${n} ${n === 1 ? "session" : "sessions"}${hrs ? ` · ${fmtHours(hrs)}h` : ""}`;
  }

  function renderSessionCard(s: ClinicalSession) {
    const badge = difficultyStyle(s.difficulty);
    const meta = [
      s.supervisor ? `Supervisor: ${s.supervisor}` : null,
      s.hours != null ? `${fmtHours(s.hours)} hrs` : null,
    ].filter(Boolean).join(" · ");
    const hasNotes = !!(s.prep || s.reflections || s.takeaways);
    return (
      <button className="clinical-card" key={s.id} onClick={() => openDetail(s)}>
        <div className="clinical-card-main">
          <div className="clinical-name">{s.department || "Clinical Session"}</div>
          {meta && <div className="clinical-meta">{meta}</div>}
          {s.goal && <div className="clinical-goal">Goal: {s.goal}</div>}
          {hasNotes && <div className="clinical-notes-hint"><FileText size={12} /> Notes &amp; reflections</div>}
        </div>
        <div className="clinical-aside">
          {s.session_date && <div className="clinical-date">{formatDate(s.session_date)}</div>}
          {s.difficulty && <span className="clinical-diff" style={{ background: badge.bg, color: badge.color }}>{s.difficulty}</span>}
        </div>
        <ChevronRight className="clinical-chevron" size={18} />
      </button>
    );
  }

  function renderDayGroups(list: ClinicalSession[]) {
    const dated = list.filter((s) => s.session_date);
    const undated = list.filter((s) => !s.session_date);
    return (
      <>
        {groupByDay(dated, (s) => s.session_date as string).map((group) => (
          <div key={group.key} style={{ marginBottom: "1.25rem" }}>
            <DateGroupHeader label={group.label} summary={groupSummary(group.items)} />
            {group.items.map(renderSessionCard)}
          </div>
        ))}
        {undated.length > 0 && (
          <div style={{ marginBottom: "1.25rem" }}>
            <DateGroupHeader label="Undated" summary={groupSummary(undated)} />
            {undated.map(renderSessionCard)}
          </div>
        )}
      </>
    );
  }

  const groupByControl = (
    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Group by</span>
      {GRANS.map((g) => (
        <Button key={g.v} size="sm" variant={granularity === g.v ? "primary" : "ghost"} onClick={() => changeGranularity(g.v)}>{g.label}</Button>
      ))}
    </div>
  );

  return (
    <div className="page active">
      <PageHeader
        icon={<Target size={22} />}
        title="Clinicals"
        subtitle="Bridge the gap between theory and practice"
        actions={(!formOpen && !readOnly) ? (
          <Button className="k-desktop-only" onClick={openAdd}>
            <Plus size={16} /> Log Session
          </Button>
        ) : undefined}
      />

      {readOnly && <ArchiveBanner term={viewTerm} />}

      {/* SUMMARY STATS — computed from the (term-scoped) logged sessions */}
      {!locked && (
        <div className="k-stats-grid" style={{ marginBottom: "1.5rem" }}>
          <StatCard tone="terracotta" label="Total Clinical Hours" value={`${fmtHours(totalHours)}h`} />
          <StatCard tone="olive" label="Sessions Completed" value={sessionCount} />
          <StatCard tone="ochre" label="Avg Session Length" value={avgLength != null ? `${fmtHours(Math.round(avgLength * 10) / 10)}h` : "—"} />
          <StatCard
            tone="forest"
            label="Avg Difficulty"
            value={<span style={avgDiffIdx != null ? { color: difficultyStyle(DIFFICULTIES[avgDiffIdx - 1]).color } : undefined}>{avgDiffIdx != null ? DIFF_SHORT[avgDiffIdx - 1] : "—"}</span>}
          />
        </div>
      )}

      {/* LOGGED SESSIONS — compact cards, click to open the detail view */}
      <Section title={<span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}><PenLine size={18} /> Logged Sessions</span>}>
        {locked ? (
          <ProUpsell
            feature="The term archive"
            blurb={`Revisit your ${viewTerm} clinical sessions as read-only history — every logged hour and reflection stays with you.`}
            perks={["Browse every past term", "Read-only, never lost", "Week & month roll-ups per term"]}
          />
        ) : loading ? (
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
        ) : sessions.length === 0 ? (
          <Card>
            <EmptyState
              icon={<PenLine size={26} />}
              title={readOnly ? "Nothing logged this term" : "No clinical sessions logged yet"}
              description={readOnly ? "There are no clinical sessions recorded for this term." : "Log your first session to start tracking hours, supervisors and reflections."}
            />
          </Card>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              {groupByControl}
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{sessions.length} total</span>
            </div>

            {granularity === "day" ? (
              renderDayGroups(sessions)
            ) : (
              <>
                {groupByPeriod(datedSessions, (s) => s.session_date as string, granularity).map((p) => (
                  <PeriodRow
                    key={p.key}
                    label={periodLabel(p.key, granularity)}
                    summary={groupSummary(p.items)}
                    open={openPeriods.has(p.key)}
                    onToggle={() => togglePeriod(p.key)}
                  >
                    {renderDayGroups(p.items)}
                  </PeriodRow>
                ))}
                {undatedSessions.length > 0 && renderDayGroups(undatedSessions)}
              </>
            )}
          </>
        )}
      </Section>

      {/* Mobile: the "New" action sits at the bottom-left of the list. */}
      {!formOpen && !readOnly && (
        <div className="k-mobile-only k-mobile-add">
          <Button onClick={openAdd}><Plus size={16} /> Log Session</Button>
        </div>
      )}

      {/* LOG / EDIT SESSION */}
      {formOpen && !readOnly && (
        <div ref={formRef} style={{ scrollMarginTop: "1rem" }}>
          <Card title={editingId ? "Edit Clinical Session" : "Log Clinical Session"} icon={<PenLine size={20} />}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "0.75rem" }}>
              <Field label="Date" htmlFor="cl-date"><Input id="cl-date" type="date" value={fDate} onChange={(e) => { setFDate(e.target.value); if (formError) setFormError(""); }} /></Field>
              <Field label="Time Spent (hrs)" htmlFor="cl-hours"><Input id="cl-hours" type="number" min="0" step="0.5" value={fHours} onChange={(e) => setFHours(e.target.value)} placeholder="4" /></Field>
              <Field label="Difficulty" htmlFor="cl-diff">
                <Select id="cl-diff" value={fDifficulty} onChange={(e) => setFDifficulty(e.target.value)}>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
              <Field label="Supervisor/Professor" htmlFor="cl-sup"><Input id="cl-sup" value={fSupervisor} onChange={(e) => setFSupervisor(e.target.value)} placeholder="Dr. Williams" /></Field>
              <Field label="Department/Ward" htmlFor="cl-dept"><Input id="cl-dept" value={fDepartment} onChange={(e) => setFDepartment(e.target.value)} placeholder="e.g., Medical Ward 3" /></Field>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <Field label="Goal for the Day" htmlFor="cl-goal"><Input id="cl-goal" value={fGoal} onChange={(e) => setFGoal(e.target.value)} placeholder="What do you aim to accomplish today?" /></Field>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <Field label="Things to Learn/Prepare Before Clinical" htmlFor="cl-prep"><Textarea id="cl-prep" value={fPrep} onChange={(e) => setFPrep(e.target.value)} placeholder="Medications, procedures, patient conditions to review..." /></Field>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <Field label="Reflections After Clinical" htmlFor="cl-refl"><Textarea id="cl-refl" value={fReflections} onChange={(e) => setFReflections(e.target.value)} placeholder="What did you observe? What did you learn? What will you improve?" /></Field>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <Field label="Key Takeaways / What to Consider" htmlFor="cl-take"><Textarea id="cl-take" value={fTakeaways} onChange={(e) => setFTakeaways(e.target.value)} placeholder="Important clinical notes, patient care insights..." /></Field>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "1.1rem" }}>
              <Button onClick={(e) => { e.currentTarget.blur(); submit(); }}>{editingId ? "Save Changes" : "Log Session"}</Button>
              <Button variant="outline" onClick={closeForm}>{editingId ? "Cancel" : "Done"}</Button>
              {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
            </div>
          </Card>
        </div>
      )}

      {/* SESSION DETAIL — centered dialog on desktop, snap-point bottom sheet on mobile */}
      <DetailSheet open={detailOpen} onOpenChange={setDetailOpen} title={detail?.department || "Clinical Session"}>
        {detail && <DetailContent session={detail} onEdit={editFromDetail} onDelete={deleteFromDetail} onClose={() => setDetailOpen(false)} readOnly={readOnly} />}
      </DetailSheet>
    </div>
  );
}
