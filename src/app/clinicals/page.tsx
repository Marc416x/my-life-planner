"use client";

import { useEffect, useRef, useState } from "react";
import { Target, PenLine, Plus, Pencil, Trash2, ChevronRight, FileText, StickyNote, Calendar } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import { useMediaQuery } from "@base-ui/react/unstable-use-media-query";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";

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

// Bottom-sheet snap heights (fractions of the viewport): opens at the lower one,
// drag up to the taller. Both are well under full-screen.
const SNAP_POINTS: (number | string)[] = [0.5, 0.85];

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
  session, onEdit, onDelete, onClose,
}: {
  session: ClinicalSession;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
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
        <button className="btn-add" onClick={onEdit} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}><Pencil size={14} /> Edit</button>
        <button className="btn-danger" onClick={onDelete}><Trash2 size={14} /> Delete</button>
        <button className="btn-outline sheet-action-spacer" onClick={onClose} style={{ padding: "0.5rem 1rem" }}>Close</button>
      </div>
    </>
  );
}

export default function ClinicalsPage() {
  const supabase = createClient();
  const toast = useToast();
  const isMobile = useMediaQuery("(max-width: 640px)", { defaultMatches: false, noSsr: true });

  const [sessions, setSessions] = useState<ClinicalSession[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Detail view (dialog on desktop, bottom sheet on mobile). `detail` is kept
  // set through the close animation so the body stays rendered while it exits.
  const [detail, setDetail] = useState<ClinicalSession | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[0]);

  // Add / edit form state.
  const [formOpen, setFormOpen] = useState(false);
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
  const formRef = useRef<HTMLDivElement>(null);
  const prevScrollY = useRef(0);
  const didToggle = useRef(false);
  const scrollAfterAdd = useRef(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const { data } = await supabase
        .from("clinical_sessions")
        .select(CLIN_COLS)
        .order("session_date", { ascending: false, nullsFirst: false });
      setSessions(sortSessions((data as ClinicalSession[]) ?? []));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expand → scroll the form into view. Collapse → scroll back to where the
  // "Log Clinical Session" / edit button was when it was clicked.
  useEffect(() => {
    if (formOpen) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (didToggle.current) {
      window.scrollTo({ top: prevScrollY.current, behavior: "smooth" });
    }
  }, [formOpen]);

  // After adding to the (above-the-form) list, the form gets pushed down —
  // pull it back into view so you stay on it for the next entry.
  useEffect(() => {
    if (scrollAfterAdd.current) {
      scrollAfterAdd.current = false;
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [sessions]);

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openDetail(s: ClinicalSession) {
    setDetail(s);
    setSnap(SNAP_POINTS[0]); // always open at the lower snap height
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
    prevScrollY.current = window.scrollY;
    didToggle.current = true;
    setEditingId(null);
    setFormError("");
    resetFields();
    setFormOpen(true);
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
    if (!formOpen) {
      prevScrollY.current = window.scrollY;
      didToggle.current = true;
      setFormOpen(true); // effect scrolls it into view
    } else {
      scrollToForm(); // already open — bring it into view now
    }
  }

  function closeForm() {
    didToggle.current = true;
    setEditingId(null);
    setFormError("");
    setFormOpen(false);
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
      const { data, error } = await supabase.from("clinical_sessions").insert({ user_id: userId, ...payload }).select(CLIN_COLS).single();
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
      scrollAfterAdd.current = true;
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

  return (
    <div className="page active">
      <div className="page-header">
        <h1>Clinicals</h1>
        <p>Bridge the gap between theory and practice</p>
      </div>

      {/* SUMMARY STATS — computed from the logged sessions */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total Clinical Hours</div><div className="stat-val">{fmtHours(totalHours)}h</div></div>
        <div className="stat-card"><div className="stat-label">Sessions Completed</div><div className="stat-val">{sessionCount}</div></div>
        <div className="stat-card"><div className="stat-label">Avg Session Length</div><div className="stat-val">{avgLength != null ? `${fmtHours(Math.round(avgLength * 10) / 10)}h` : "—"}</div></div>
        <div className="stat-card"><div className="stat-label">Avg Difficulty</div><div className="stat-val" style={avgDiffIdx != null ? { color: difficultyStyle(DIFFICULTIES[avgDiffIdx - 1]).color } : undefined}>{avgDiffIdx != null ? DIFF_SHORT[avgDiffIdx - 1] : "—"}</div></div>
      </div>

      {/* LOGGED SESSIONS — compact cards, click to open the detail view */}
      <div className="card-title" style={{ marginBottom: "1rem", fontFamily: "var(--font-caveat), cursive", fontSize: "1.1rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
        <PenLine size={18} /> Logged Sessions
      </div>

      {loading ? (
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
      ) : sessions.length === 0 ? (
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "2rem 1rem", fontStyle: "italic", textAlign: "center" }}>
          No clinical sessions logged yet — add your first one below.
        </div>
      ) : (
        sessions.map((s) => {
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
        })
      )}

      {/* LOG / EDIT SESSION — a plain button when collapsed, the full form when expanded */}
      <div style={{ marginTop: "1.25rem" }}>
        {!formOpen && (
          <button className="btn-add" onClick={openAdd} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <Plus size={16} /> Log Clinical Session
          </button>
        )}

        {formOpen && (
          <div className="form-section" ref={formRef} style={{ scrollMarginTop: "1rem", marginBottom: 0 }}>
            <h3>{editingId ? "Edit Clinical Session" : "Log Clinical Session"}</h3>
            <div className="input-row three">
              <div className="field-group"><div className="field-label">Date</div><input className="field-input" type="date" value={fDate} onChange={(e) => { setFDate(e.target.value); if (formError) setFormError(""); }} /></div>
              <div className="field-group"><div className="field-label">Time Spent (hrs)</div><input className="field-input" type="number" min="0" step="0.5" value={fHours} onChange={(e) => setFHours(e.target.value)} placeholder="4" /></div>
              <div className="field-group"><div className="field-label">Difficulty</div>
                <select className="field-select" value={fDifficulty} onChange={(e) => setFDifficulty(e.target.value)}>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="input-row">
              <div className="field-group"><div className="field-label">Supervisor/Professor</div><input className="field-input" value={fSupervisor} onChange={(e) => setFSupervisor(e.target.value)} placeholder="Dr. Williams" /></div>
              <div className="field-group"><div className="field-label">Department/Ward</div><input className="field-input" value={fDepartment} onChange={(e) => setFDepartment(e.target.value)} placeholder="e.g., Medical Ward 3" /></div>
            </div>
            <div className="input-row single"><div className="field-group"><div className="field-label">Goal for the Day</div><input className="field-input" value={fGoal} onChange={(e) => setFGoal(e.target.value)} placeholder="What do you aim to accomplish today?" /></div></div>
            <div className="input-row single"><div className="field-group"><div className="field-label">Things to Learn/Prepare Before Clinical</div><textarea className="field-textarea" value={fPrep} onChange={(e) => setFPrep(e.target.value)} placeholder="Medications, procedures, patient conditions to review..." /></div></div>
            <div className="input-row single"><div className="field-group"><div className="field-label">Reflections After Clinical</div><textarea className="field-textarea" value={fReflections} onChange={(e) => setFReflections(e.target.value)} placeholder="What did you observe? What did you learn? What will you improve?" /></div></div>
            <div className="input-row single"><div className="field-group"><div className="field-label">Key Takeaways / What to Consider</div><textarea className="field-textarea" value={fTakeaways} onChange={(e) => setFTakeaways(e.target.value)} placeholder="Important clinical notes, patient care insights..." /></div></div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn-add" onClick={(e) => { e.currentTarget.blur(); submit(); }}>{editingId ? "Save Changes" : "+ Log Session"}</button>
              <button className="btn-outline" onClick={closeForm} style={{ padding: "0.5rem 1rem" }}>{editingId ? "Cancel" : "Done"}</button>
              {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
            </div>
          </div>
        )}
      </div>

      {/* SESSION DETAIL — centered dialog on desktop, snap-point bottom sheet on mobile */}
      {isMobile ? (
        <Drawer.Root open={detailOpen} onOpenChange={setDetailOpen} snapPoints={SNAP_POINTS} snapPoint={snap} onSnapPointChange={(sp) => setSnap(sp)}>
          <Drawer.Portal>
            <Drawer.Backdrop className="sheet-backdrop" />
            <Drawer.Viewport className="sheet-viewport">
              <Drawer.Popup className="detail-sheet">
                <div className="sheet-drag">
                  <div className="sheet-grabber" />
                  <Drawer.Title className="sheet-title">{detail?.department || "Clinical Session"}</Drawer.Title>
                </div>
                <Drawer.Content className="sheet-scroll">
                  {detail && <DetailContent session={detail} onEdit={editFromDetail} onDelete={deleteFromDetail} onClose={() => setDetailOpen(false)} />}
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ) : (
        <Dialog.Root open={detailOpen} onOpenChange={setDetailOpen}>
          <Dialog.Portal>
            <Dialog.Backdrop className="sheet-backdrop" />
            <Dialog.Popup className="detail-dialog">
              <Dialog.Title className="sheet-title">{detail?.department || "Clinical Session"}</Dialog.Title>
              {detail && <DetailContent session={detail} onEdit={editFromDetail} onDelete={deleteFromDetail} onClose={() => setDetailOpen(false)} />}
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
