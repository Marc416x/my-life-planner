"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { parseISO, toISO } from "@/lib/group-by-date";
import { affirmationFor } from "@/lib/affirmations";
import {
  type CalendarEvent,
  type EventKind,
  DEFAULT_MONTH_KINDS,
  KIND_META,
  KIND_ORDER,
  compareEvents,
  fetchCalendarEvents,
  indexByDate,
  yearRange,
} from "@/lib/calendar-events";
import {
  type PlannerNote,
  addNote,
  deleteNote,
  fetchNotes,
  periodFor,
  saveSingleton,
  setNoteDone,
} from "@/lib/planner-notes";
import { useToast } from "@/components/toast-provider";
import { DetailSheet } from "@/components/detail-sheet";
import { GratitudeCard } from "@/components/gratitude-card";
import {
  Target,
  Ban,
  BookOpen,
  Zap,
  FileText,
  Save,
  NotebookPen,
  Clock,
  Smile,
  Heart,
  ListChecks,
  CalendarDays,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
} from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const cardTitle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "0.45rem" };

// Shared card-chrome metrics. `.card-title` carries margin-bottom: 0.75rem, so a
// card that wraps its title in a header row has to restate that gap — otherwise
// side-by-side cards sit their captions at different heights and read as skewed.
const cardHeaderRow: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  gap: "0.5rem", marginBottom: "0.75rem", minHeight: 26,
};
const cardCaption: React.CSSProperties = {
  fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.75rem",
};
const emptyNote: React.CSSProperties = {
  fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center",
  padding: "0.75rem", fontStyle: "italic",
};

type Tab = "yearly" | "monthly" | "weekly" | "daily";

/** Chips rendered inline in a month cell before collapsing into "+N more". */
const MONTH_CHIP_LIMIT = 3;

type Book = { id: string; title: string; author: string | null; status: string | null };
type Course = { id: string; name: string; code: string | null };

/**
 * Kinds the day sheet can create. Forward-looking only — `study` and `quiz` are
 * records of something that already happened, so they're logged on their own
 * pages rather than scheduled here.
 */
type AddKind = "task" | "assign" | "exam" | "clinical";
const ADD_KINDS: {
  value: AddKind; label: string; noun: string; placeholder: string; needsCourse: boolean;
}[] = [
  { value: "task", label: "Task", noun: "Tasks", placeholder: "What needs doing?", needsCourse: false },
  { value: "assign", label: "Assignment", noun: "Assignments", placeholder: "Assignment title", needsCourse: false },
  { value: "exam", label: "Exam", noun: "Exams", placeholder: "Exam name", needsCourse: true },
  { value: "clinical", label: "Clinical", noun: "Clinicals", placeholder: "Department / ward", needsCourse: false },
];
type Goal = { id: string; text: string; done: boolean };
type DailyTask = { id: string; text: string; tag: string | null; tag_class: string | null; done: boolean };

const BOOK_STATUSES = [
  { value: "to-read", label: "To Read" },
  { value: "reading", label: "Reading" },
  { value: "done", label: "Done" },
] as const;

/** Category tags for daily tasks — the same `tag_class` values the dashboard renders. */
const TASK_TAGS = [
  { label: "Study", cls: "tag-study" },
  { label: "Exam", cls: "tag-exam" },
  { label: "Assignment", cls: "tag-assign" },
  { label: "Clinical", cls: "tag-clinical" },
] as const;

const MOOD_SCALE = [
  { value: 1, emoji: "😢", label: "Very Bad" },
  { value: 2, emoji: "😔", label: "Bad" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "🤩", label: "Excellent" },
] as const;

/** Small round icon-button used for the delete affordance on list rows. */
function IconBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        background: "none", border: "none", cursor: "pointer", padding: 2,
        color: "var(--text-muted)", display: "inline-flex", alignItems: "center",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

/** Checkbox styled like the dashboard's task check. */
function CheckBtn({ done, onClick, label }: { done: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={done}
      className={"task-check" + (done ? " done" : "")}
      style={{ cursor: "pointer", flexShrink: 0 }}
    />
  );
}

/**
 * Growable lists scroll inside the card rather than pushing it — and, in a grid
 * row, its neighbour — taller without bound. Same treatment the books card
 * already used; `items-start` on the grids handles the rest.
 */
const listScroll: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: "0.15rem",
  maxHeight: 260, overflowY: "auto",
};

/**
 * A list row: optional check · text · optional trailing slot · edit · delete.
 *
 * Editing is inline and self-contained — a pencil swaps the text for an input
 * (Enter/blur commits, Escape reverts). Every other page pairs delete with edit;
 * this is that pattern at the scale of a one-line row, where opening the shared
 * collapsible form would be far heavier than the content deserves.
 */
function ListRow({
  done, text, onToggle, onDelete, onSave, trailing, toggleLabel, icon,
}: {
  done: boolean;
  text: string;
  onToggle?: () => void;
  onDelete: () => void;
  onSave?: (next: string) => void;
  trailing?: React.ReactNode;
  toggleLabel: string;
  icon?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  function begin() { setDraft(text); setEditing(true); }
  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== text) onSave?.(next);
  }

  if (editing) {
    return (
      <div className="data-item">
        <input
          className="field-input"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(text); setEditing(false); }
          }}
          style={{ flex: 1, fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
        />
      </div>
    );
  }

  return (
    <div className="data-item">
      {onToggle && <CheckBtn done={done} onClick={onToggle} label={toggleLabel} />}
      {icon}
      <span
        style={{
          flex: 1, fontSize: "0.85rem", minWidth: 0,
          opacity: done ? 0.55 : 1,
          textDecoration: done ? "line-through" : "none",
        }}
      >
        {text}
      </span>
      {trailing}
      {onSave && <IconBtn onClick={begin} label="Edit"><Pencil size={14} /></IconBtn>}
      <IconBtn onClick={onDelete} label="Delete"><Trash2 size={14} /></IconBtn>
    </div>
  );
}

/** Calendar-day arithmetic (DST-safe, unlike adding 86_400_000 ms). */
function shiftDay(d: Date, delta: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}

/** One row of the day agenda — a chip that deep-links to the page owning the row. */
function AgendaRow({ e }: { e: CalendarEvent }) {
  const meta = KIND_META[e.kind];
  return (
    <Link
      href={meta.href}
      className="data-item"
      style={{ textDecoration: "none", color: "inherit", alignItems: "flex-start" }}
    >
      <span
        style={{
          width: 8, height: 8, borderRadius: "50%", background: meta.color,
          flexShrink: 0, marginTop: 6,
        }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: "0.85rem",
            display: "block",
            opacity: e.done ? 0.6 : 1,
            textDecoration: e.done ? "line-through" : "none",
          }}
        >
          {e.title}
        </span>
        {(e.detail || e.time) && (
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            {[e.time, e.detail].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", flexShrink: 0 }}>
        {meta.label.replace(/s$/, "")}
      </span>
    </Link>
  );
}

/** The aggregated agenda for one day, or an empty note. */
function DayAgenda({ events, empty }: { events: CalendarEvent[]; empty: string }) {
  if (!events.length) {
    return (
      <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "0.75rem" }}>
        {empty}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
      {events.map((e) => <AgendaRow key={e.id} e={e} />)}
    </div>
  );
}

export default function CalendarPage() {
  const [tab, setTab] = useState<Tab>("yearly");

  // "Today" is state, not a mount-time constant: a session left open across
  // midnight must move the highlight rather than freeze on yesterday.
  const [todayISO, setTodayISO] = useState(() => toISO(new Date()));
  useEffect(() => {
    const tick = () => setTodayISO((prev) => {
      const next = toISO(new Date());
      return next === prev ? prev : next;
    });
    const iv = window.setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(iv); window.removeEventListener("focus", tick); };
  }, []);
  const now = useMemo(() => parseISO(todayISO), [todayISO]);

  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [weekOffset, setWeekOffset] = useState(0);
  const [day, setDay] = useState(() => new Date());

  const supabase = createClient();
  const toast = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  /** Academic term stamp (profiles.year) — needed when writing tracker entries. */
  const [term, setTerm] = useState<string | null>(null);
  /** The user's "Mood" tracker, so the daily mood buttons write real entries. */
  const [moodTracker, setMoodTracker] = useState<{ id: string } | null>(null);
  /** Courses, for the quick-add form (exams require one; assignments store the name). */
  const [courses, setCourses] = useState<Course[]>([]);

  // The Yearly grid can be walked back/forward; the yearly objectives + anti-goals
  // follow it, so you can review last year's list or set next year's early.
  const [yearOffset, setYearOffset] = useState(0);
  const year = now.getFullYear() + yearOffset;

  const weekMonday = useMemo(() => {
    const d = parseISO(todayISO);
    const dow = d.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + mondayOffset + weekOffset * 7);
    return d;
  }, [weekOffset, todayISO]);
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekMonday);
        d.setDate(weekMonday.getDate() + i);
        return d;
      }),
    [weekMonday],
  );
  const weekEnd = weekDays[6];
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  // ---- Aggregated events (the real calendar data) -------------------------
  //
  // The fetch window follows the active view. Month/week/day windows are padded
  // a month either side so ordinary nav inside the current month never refetches;
  // the yearly grid pulls the whole year in one go.
  const range = useMemo(() => {
    if (tab === "yearly") return yearRange(year);
    const anchor = tab === "monthly" ? month : tab === "weekly" ? weekMonday : day;
    return {
      start: toISO(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1)),
      end: toISO(new Date(anchor.getFullYear(), anchor.getMonth() + 2, 0)),
    };
  }, [tab, year, month, weekMonday, day]);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [kinds, setKinds] = useState<EventKind[]>(DEFAULT_MONTH_KINDS);
  /** Bumped after a quick-add so the grid re-reads the range and shows the new chip. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEventsLoading(true);
      try {
        const { events: rows, failed } = await fetchCalendarEvents(supabase, range.start, range.end);
        if (cancelled) return;
        setEvents(rows);
        // A failed source is missing, not empty — say so rather than showing a
        // clean grid that implies the user has nothing scheduled.
        setEventsError(
          failed.length ? `Couldn't load ${failed.join(", ")} — those items are missing from this view.` : "",
        );
      } catch {
        if (!cancelled) setEventsError("Couldn't load your calendar. Check your connection and try again.");
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end, reloadKey]);

  /** Month/Year grids honour the legend filter; Weekly and Daily show everything. */
  const filtered = useMemo(() => events.filter((e) => kinds.includes(e.kind)), [events, kinds]);
  const byDateFiltered = useMemo(() => indexByDate(filtered), [filtered]);
  const byDateAll = useMemo(() => indexByDate(events), [events]);

  const toggleKind = useCallback((k: EventKind) => {
    setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  }, []);

  /**
   * Peek at a date from any grid. Opens the detail sheet rather than jumping to
   * the Daily tab — you keep your place in the month while scanning — and syncs
   * `day` so the sheet's "Open full day view" lands on the right date.
   */
  const [sheetOpen, setSheetOpen] = useState(false);
  const openDay = useCallback((d: Date) => {
    setDay(d);
    setSheetOpen(true);
  }, []);

  const dayISO = toISO(day);
  const dayEvents = byDateAll.get(dayISO) ?? [];
  const weekISO = toISO(weekMonday);
  const monthISO = toISO(new Date(month.getFullYear(), month.getMonth(), 1));
  const yearISO = toISO(new Date(year, 0, 1));

  // ---- Editable stores -----------------------------------------------------
  // Each surface writes to the table that already owns its concept:
  //   objectives / anti-goals / gratitude / journal / reflection → planner_notes (0020)
  //   books   → reading_list (month-scoped by period_date, added in 0020)
  //   goals   → weekly_goals (week_start finally set)
  //   tasks   → daily_tasks (the same rows the dashboard shows)
  //   mood    → tracker_entries, against the user's real "Mood" tracker
  const [books, setBooks] = useState<Book[]>([]);
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookStatus, setBookStatus] = useState("to-read");

  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalText, setGoalText] = useState("");

  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [taskText, setTaskText] = useState("");
  const [taskTag, setTaskTag] = useState<string>(TASK_TAGS[0].label);

  const [objectives, setObjectives] = useState<PlannerNote[]>([]);
  const [objectiveText, setObjectiveText] = useState("");
  const [avoids, setAvoids] = useState<PlannerNote[]>([]);
  const [avoidText, setAvoidText] = useState("");

  const [journal, setJournal] = useState("");
  const [reflection, setReflection] = useState("");
  const [saving, setSaving] = useState("");

  const [mood, setMood] = useState<number | null>(null);

  // Identity + the two lookups that never change with the view.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) return;
      const [{ data: profile }, { data: trackers }, { data: courseRows }] = await Promise.all([
        supabase.from("profiles").select("year").eq("id", user.id).single(),
        // Deterministic: `limit(1)` with no ORDER BY returns an ARBITRARY row, so
        // before 0021 (which de-duplicates trackers) this could pick a different
        // "Mood" than the Trackers page logged against, and the two never agreed.
        // Archived trackers are excluded — logging into one would be invisible.
        supabase
          .from("trackers")
          .select("id, name")
          .eq("name", "Mood")
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(1),
        supabase.from("courses").select("id, name, code").order("created_at", { ascending: true }),
      ]);
      setTerm((profile?.year as string) ?? null);
      const t = (trackers as { id: string }[] | null)?.[0];
      setMoodTracker(t ? { id: t.id } : null);
      setCourses((courseRows as Course[]) ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Year scope: objectives + things not to repeat.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await fetchNotes(supabase, ["objective", "avoid"], [yearISO]);
      if (cancelled) return;
      setObjectives(rows.filter((r) => r.kind === "objective"));
      setAvoids(rows.filter((r) => r.kind === "avoid"));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearISO]);

  // Month scope: this month's reading list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("reading_list")
        .select("id, title, author, status")
        .eq("kind", "monthly")
        .eq("period_date", monthISO)
        .order("created_at", { ascending: true });
      if (!cancelled) setBooks((data as Book[]) ?? []);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthISO]);

  // Week scope: this week's goals + reflection.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data }, notes] = await Promise.all([
        supabase
          .from("weekly_goals")
          .select("id, text, done")
          .eq("week_start", weekISO)
          .order("created_at", { ascending: true }),
        fetchNotes(supabase, ["reflection"], [weekISO]),
      ]);
      if (cancelled) return;
      setGoals((data as Goal[]) ?? []);
      setReflection(notes[0]?.body ?? "");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekISO]);

  // Day scope: tasks + journal (gratitude is self-contained in GratitudeCard).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: taskRows }, notes] = await Promise.all([
        supabase
          .from("daily_tasks")
          .select("id, text, tag, tag_class, done")
          .eq("task_date", dayISO)
          .order("created_at", { ascending: true }),
        fetchNotes(supabase, ["journal"], [dayISO]),
      ]);
      if (cancelled) return;
      setTasks((taskRows as DailyTask[]) ?? []);
      setJournal(notes.find((n) => n.kind === "journal")?.body ?? "");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayISO]);

  // Mood is its own effect: the tracker id resolves after mount, and folding it
  // into the day effect would refetch tasks + notes a second time on every load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!moodTracker) { setMood(null); return; }
      const { data } = await supabase
        .from("tracker_entries")
        .select("value")
        .eq("tracker_id", moodTracker.id)
        .eq("entry_date", dayISO);
      if (cancelled) return;
      const v = (data as { value: number }[] | null)?.[0]?.value;
      setMood(v === undefined ? null : Number(v));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayISO, moodTracker]);

  // ---- Undoable delete -----------------------------------------------------
  //
  // The app-wide pattern (Exams, Clinicals, Courses, Drugs, Error Log, …): drop
  // the row from the UI immediately, hold the actual DELETE for 5s behind a
  // counting-down "Undo" toast, and restore it AT ITS ORIGINAL INDEX if undone.
  // Nothing here deleted instantly before — a mis-tap was unrecoverable.
  type PendingDelete = { timeout: number; commit: () => PromiseLike<{ error: unknown }> };
  const pendingDeletes = useRef(new Map<string, PendingDelete>());
  useEffect(() => {
    const pending = pendingDeletes.current;
    // Leaving mid-countdown FLUSHES the pending deletes rather than dropping the
    // timers. Just clearing them would cancel the delete, so a row you deleted
    // and navigated away from would silently reappear on the next visit.
    return () => {
      pending.forEach(({ timeout, commit }) => {
        window.clearTimeout(timeout);
        void commit();
      });
      pending.clear();
    };
  }, []);

  function undoableDelete<T>({
    id, label, list, setList, commit,
  }: {
    id: string;
    label: string;
    list: T[];
    setList: (fn: (cur: T[]) => T[]) => void;
    // PromiseLike, not Promise: PostgREST's builders are thenables, not real
    // Promises, so requiring `.catch`/`.finally` would reject them.
    commit: () => PromiseLike<{ error: unknown }>;
  }) {
    const index = list.findIndex((r) => (r as { id: string }).id === id);
    if (index < 0) return;
    const item = list[index];

    setList((cur) => cur.filter((r) => (r as { id: string }).id !== id));

    const timeout = window.setTimeout(async () => {
      pendingDeletes.current.delete(id);
      const { error } = await commit();
      if (error) {
        setList((cur) => [...cur.slice(0, index), item, ...cur.slice(index)]);
        toast.show(`Couldn't delete that ${label.toLowerCase()} — it's back.`);
      }
    }, 5000);
    pendingDeletes.current.set(id, { timeout, commit });

    toast.show(`${label} deleted`, {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = pendingDeletes.current.get(id);
        if (!p) return;
        window.clearTimeout(p.timeout);
        pendingDeletes.current.delete(id);
        setList((cur) => [...cur.slice(0, index), item, ...cur.slice(index)]);
      },
    });
  }

  /** Guard every write: no session → the insert would fail RLS silently. */
  function requireUser(): string | null {
    if (!userId) {
      toast.show("Still signing you in — try again in a moment.");
      return null;
    }
    return userId;
  }

  // ---- Planner-note writes (objectives, anti-goals, gratitude) -------------
  async function addPlannerNote(
    kind: "objective" | "avoid" | "gratitude",
    text: string,
    list: PlannerNote[],
    setList: (fn: (cur: PlannerNote[]) => PlannerNote[]) => void,
    clear: () => void,
  ) {
    const uid = requireUser();
    if (!uid || !text.trim()) return;
    const period = periodFor(kind, kind === "gratitude" ? day : now);
    const row = await addNote(supabase, uid, kind, period, text.trim(), list.length);
    if (!row) { toast.show("Couldn't save that — please try again."); return; }
    setList((cur) => [...cur, row]);
    clear();
  }

  async function toggleNote(
    note: PlannerNote,
    setList: (fn: (cur: PlannerNote[]) => PlannerNote[]) => void,
  ) {
    const next = !note.done;
    setList((cur) => cur.map((n) => (n.id === note.id ? { ...n, done: next } : n)));
    if (!(await setNoteDone(supabase, note.id, next))) {
      setList((cur) => cur.map((n) => (n.id === note.id ? { ...n, done: !next } : n)));
      toast.show("Couldn't update that — please try again.");
    }
  }

  function removeNote(
    note: PlannerNote,
    label: string,
    list: PlannerNote[],
    setList: (fn: (cur: PlannerNote[]) => PlannerNote[]) => void,
  ) {
    undoableDelete({
      id: note.id, label, list, setList,
      commit: async () => ({ error: (await deleteNote(supabase, note.id)) ? null : true }),
    });
  }

  async function editNote(
    note: PlannerNote,
    body: string,
    setList: (fn: (cur: PlannerNote[]) => PlannerNote[]) => void,
  ) {
    setList((cur) => cur.map((n) => (n.id === note.id ? { ...n, body } : n)));
    const { error } = await supabase.from("planner_notes").update({ body }).eq("id", note.id);
    if (error) {
      setList((cur) => cur.map((n) => (n.id === note.id ? { ...n, body: note.body } : n)));
      toast.show("Couldn't save that edit — please try again.");
    }
  }

  /** Save a journal/reflection textarea. Only claims success when it succeeded. */
  async function saveText(kind: "journal" | "reflection", body: string) {
    const uid = requireUser();
    if (!uid) return;
    const period = periodFor(kind, kind === "journal" ? day : weekMonday);
    setSaving(kind);
    const ok = await saveSingleton(supabase, uid, kind, period, body);
    setSaving("");
    toast.show(ok ? "Saved." : "Couldn't save — please try again.");
  }

  // ---- Reading list --------------------------------------------------------
  async function addBook() {
    const uid = requireUser();
    if (!uid || !bookTitle.trim()) return;
    const { data, error } = await supabase
      .from("reading_list")
      .insert({
        user_id: uid,
        title: bookTitle.trim(),
        author: bookAuthor.trim() || null,
        status: bookStatus,
        kind: "monthly",
        period_date: monthISO,
      })
      .select("id, title, author, status")
      .single();
    if (error || !data) { toast.show("Couldn't add that book — please try again."); return; }
    setBooks((x) => [...x, data as Book]);
    setBookTitle("");
    setBookAuthor("");
  }

  async function cycleBookStatus(b: Book) {
    const order: string[] = BOOK_STATUSES.map((s) => s.value);
    const next = order[(order.indexOf(b.status ?? "to-read") + 1) % order.length];
    setBooks((x) => x.map((r) => (r.id === b.id ? { ...r, status: next } : r)));
    const { error } = await supabase.from("reading_list").update({ status: next }).eq("id", b.id);
    if (error) {
      setBooks((x) => x.map((r) => (r.id === b.id ? { ...r, status: b.status } : r)));
      toast.show("Couldn't update that book — please try again.");
    }
  }

  function removeBook(b: Book) {
    undoableDelete({
      id: b.id, label: "Book", list: books, setList: setBooks,
      commit: () => supabase.from("reading_list").delete().eq("id", b.id),
    });
  }

  async function editBook(b: Book, title: string) {
    setBooks((x) => x.map((r) => (r.id === b.id ? { ...r, title } : r)));
    const { error } = await supabase.from("reading_list").update({ title }).eq("id", b.id);
    if (error) {
      setBooks((x) => x.map((r) => (r.id === b.id ? { ...r, title: b.title } : r)));
      toast.show("Couldn't save that edit — please try again.");
    }
  }

  // ---- Weekly goals --------------------------------------------------------
  async function addGoal() {
    const uid = requireUser();
    if (!uid || !goalText.trim()) return;
    const { data, error } = await supabase
      .from("weekly_goals")
      // week_start was never set before, which made every "weekly" goal global.
      .insert({ user_id: uid, text: goalText.trim(), week_start: weekISO })
      .select("id, text, done")
      .single();
    if (error || !data) { toast.show("Couldn't add that goal — please try again."); return; }
    setGoals((x) => [...x, data as Goal]);
    setGoalText("");
  }

  async function toggleGoal(g: Goal) {
    const next = !g.done;
    setGoals((x) => x.map((r) => (r.id === g.id ? { ...r, done: next } : r)));
    const { error } = await supabase.from("weekly_goals").update({ done: next }).eq("id", g.id);
    if (error) {
      setGoals((x) => x.map((r) => (r.id === g.id ? { ...r, done: !next } : r)));
      toast.show("Couldn't update that goal.");
    }
  }

  function removeGoal(g: Goal) {
    undoableDelete({
      id: g.id, label: "Goal", list: goals, setList: setGoals,
      commit: () => supabase.from("weekly_goals").delete().eq("id", g.id),
    });
  }

  async function editGoal(g: Goal, text: string) {
    setGoals((x) => x.map((r) => (r.id === g.id ? { ...r, text } : r)));
    const { error } = await supabase.from("weekly_goals").update({ text }).eq("id", g.id);
    if (error) {
      setGoals((x) => x.map((r) => (r.id === g.id ? { ...r, text: g.text } : r)));
      toast.show("Couldn't save that edit — please try again.");
    }
  }

  // ---- Daily tasks (the dashboard's rows, scoped to the selected day) -------
  async function addTask() {
    const uid = requireUser();
    if (!uid || !taskText.trim()) return;
    const tag = TASK_TAGS.find((t) => t.label === taskTag) ?? TASK_TAGS[0];
    const { data, error } = await supabase
      .from("daily_tasks")
      .insert({
        user_id: uid,
        text: taskText.trim(),
        tag: tag.label,
        tag_class: tag.cls,
        task_date: dayISO,
      })
      .select("id, text, tag, tag_class, done")
      .single();
    if (error || !data) { toast.show("Couldn't add that task — please try again."); return; }
    setTasks((x) => [...x, data as DailyTask]);
    setTaskText("");
  }

  async function toggleTask(t: DailyTask) {
    const next = !t.done;
    setTasks((x) => x.map((r) => (r.id === t.id ? { ...r, done: next } : r)));
    const { error } = await supabase.from("daily_tasks").update({ done: next }).eq("id", t.id);
    if (error) {
      setTasks((x) => x.map((r) => (r.id === t.id ? { ...r, done: !next } : r)));
      toast.show("Couldn't update that task.");
    }
  }

  function removeTask(t: DailyTask) {
    undoableDelete({
      id: t.id, label: "Task", list: tasks, setList: setTasks,
      commit: () => supabase.from("daily_tasks").delete().eq("id", t.id),
    });
  }

  async function editTask(t: DailyTask, text: string) {
    setTasks((x) => x.map((r) => (r.id === t.id ? { ...r, text } : r)));
    const { error } = await supabase.from("daily_tasks").update({ text }).eq("id", t.id);
    if (error) {
      setTasks((x) => x.map((r) => (r.id === t.id ? { ...r, text: t.text } : r)));
      toast.show("Couldn't save that edit — please try again.");
    }
  }

  // ---- Quick add (from the day sheet) --------------------------------------
  //
  // The Calendar stores no events, so "add" writes into the table that owns the
  // kind and the grid re-reads it. Only FORWARD-LOOKING kinds are offered: study
  // sessions and quizzes are logged after the fact on their own pages, so
  // scheduling them here would create rows that claim something already happened.
  const [addKind, setAddKind] = useState<AddKind>("task");
  const [addTitle, setAddTitle] = useState("");
  const [addCourse, setAddCourse] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const activeAddKind = ADD_KINDS.find((k) => k.value === addKind) ?? ADD_KINDS[0];

  async function quickAdd() {
    const uid = requireUser();
    if (!uid || !addTitle.trim() || addBusy) return;
    const title = addTitle.trim();

    setAddBusy(true);
    let error: unknown = null;
    if (addKind === "task") {
      ({ error } = await supabase
        .from("daily_tasks")
        .insert({ user_id: uid, text: title, task_date: dayISO }));
    } else if (addKind === "assign") {
      // `addCourse` empty means the user picked "No course" — honour that rather
      // than silently attaching the first one.
      const courseName = addCourse ? courses.find((c) => c.id === addCourse)?.name ?? null : null;
      ({ error } = await supabase
        .from("assignments")
        .insert({ user_id: uid, title, course: courseName, due_date: dayISO }));
    } else if (addKind === "exam") {
      // exams.course_id is NOT NULL; the form hides this branch without a course.
      const courseId = addCourse || courses[0]?.id;
      if (!courseId) { setAddBusy(false); toast.show("Add a course first."); return; }
      ({ error } = await supabase
        .from("exams")
        .insert({ user_id: uid, name: title, course_id: courseId, exam_date: dayISO }));
    } else {
      ({ error } = await supabase
        .from("clinical_sessions")
        .insert({ user_id: uid, department: title, session_date: dayISO }));
    }
    setAddBusy(false);

    if (error) { toast.show("Couldn't add that — please try again."); return; }
    setAddTitle("");
    // Re-read the range so the new row shows as a chip immediately.
    setReloadKey((k) => k + 1);
    if (addKind === "task") {
      const { data } = await supabase
        .from("daily_tasks")
        .select("id, text, tag, tag_class, done")
        .eq("task_date", dayISO)
        .order("created_at", { ascending: true });
      setTasks((data as DailyTask[]) ?? []);
    }
    toast.show(`Added to ${ADD_KINDS.find((k) => k.value === addKind)?.noun}.`);
  }

  // ---- Mood (one entry per tracker per day — upsert, same as Trackers) ------
  async function logMood(value: number) {
    const uid = requireUser();
    if (!uid || !moodTracker) return;
    const prev = mood;
    setMood(value);
    const { error } = await supabase
      .from("tracker_entries")
      .upsert(
        { user_id: uid, tracker_id: moodTracker.id, entry_date: dayISO, value, term },
        { onConflict: "tracker_id,entry_date" },
      );
    if (error) { setMood(prev); toast.show("Couldn't save your mood — please try again."); }
  }

  /** Deadline-shaped events landing in the visible week, chronological. */
  const weekDeadlines = useMemo(() => {
    const inWeek = new Set(weekDays.map(toISO));
    return events
      .filter((e) => inWeek.has(e.date) && (e.kind === "assign" || e.kind === "exam" || e.kind === "quiz"))
      .sort((a, b) => a.date.localeCompare(b.date) || compareEvents(a, b));
  }, [events, weekDays]);

  /** Headline counts for the Yearly tab (only meaningful while that tab's range is loaded). */
  const yearStats = useMemo(() => {
    const count = (k: EventKind) => events.filter((e) => e.kind === k).length;
    return {
      exams: count("exam"),
      assigns: count("assign"),
      clinicals: count("clinical"),
      studyDays: new Set(events.filter((e) => e.kind === "study").map((e) => e.date)).size,
    };
  }, [events]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "yearly", label: "Yearly" },
    { key: "monthly", label: "Monthly" },
    { key: "weekly", label: "Weekly" },
    { key: "daily", label: "Daily" },
  ];

  return (
    <div className="page active">
      <div className="page-header">
        <h1>Calendar</h1>
        <p>Your academic timeline at a glance</p>
      </div>

      <div className="tab-bar">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={"tab-btn" + (tab === t.key ? " active" : "")}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {eventsError && (
        <div
          role="alert"
          style={{
            fontSize: "0.8rem", color: "var(--terracotta-dark)",
            background: "color-mix(in srgb, var(--terracotta) 10%, transparent)",
            border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)",
            padding: "0.5rem 0.75rem", marginBottom: "1rem",
          }}
        >
          {eventsError}
        </div>
      )}

      {/* ============ YEARLY ============ */}
      {tab === "yearly" && (
        <div className="tab-content active">
          <div className="affirmation-banner" style={{ marginBottom: "1.5rem" }}>
            <Sparkles size={20} style={{ flexShrink: 0 }} />
            <p>{`"${affirmationFor("year", new Date(year, 0, 1))}"`}</p>
          </div>

          {/* Extra bottom gap: the objectives card ends on its add-input, which
              visually crowds the Overview card below it at the standard 1.5rem. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start" style={{ marginBottom: "2.25rem" }}>
            <div className="card">
              {/* Both yearly cards share this exact header block so their titles,
                  captions and first rows line up across the grid row. */}
              <div style={cardHeaderRow}>
                <div className="card-title" style={{ ...cardTitle, marginBottom: 0 }}>
                  <Target size={18} /> {year} Objectives
                </div>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  {objectives.length ? `${objectives.filter((o) => o.done).length}/${objectives.length} done` : ""}
                </span>
              </div>
              <div style={cardCaption}>What do you want to achieve this year?</div>
              {objectives.length ? (
                <div style={listScroll}>
                  {objectives.map((o) => (
                    <ListRow
                      key={o.id}
                      done={o.done}
                      text={o.body}
                      toggleLabel={o.done ? "Mark as active" : "Mark as achieved"}
                      onToggle={() => toggleNote(o, setObjectives)}
                      onSave={(next) => editNote(o, next, setObjectives)}
                      onDelete={() => removeNote(o, "Objective", objectives, setObjectives)}
                      trailing={
                        <span className={o.done ? "review-done" : "review-pending"}>
                          {o.done ? "Achieved" : "Active"}
                        </span>
                      }
                    />
                  ))}
                </div>
              ) : (
                <div style={emptyNote}>No objectives set for {year} yet</div>
              )}
              <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                <input
                  className="field-input"
                  placeholder="Add new objective..."
                  value={objectiveText}
                  onChange={(e) => setObjectiveText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addPlannerNote("objective", objectiveText, objectives, setObjectives, () => setObjectiveText("")); }}
                  style={{ flex: 1, fontSize: "0.82rem", padding: "0.4rem 0.75rem" }}
                />
                <button
                  className="btn-add"
                  onClick={() => addPlannerNote("objective", objectiveText, objectives, setObjectives, () => setObjectiveText(""))}
                  style={{ padding: "0.4rem 0.75rem", fontSize: "0.82rem" }}
                >
                  +
                </button>
              </div>
            </div>
            <div className="card">
              <div style={cardHeaderRow}>
                <div className="card-title" style={{ ...cardTitle, marginBottom: 0 }}>
                  <Ban size={18} /> Things Not to Repeat
                </div>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  {avoids.length ? `${avoids.length} logged` : ""}
                </span>
              </div>
              <div style={cardCaption}>Learn from past patterns</div>
              {avoids.length ? (
                <div style={listScroll}>
                  {avoids.map((a) => (
                    <ListRow
                      key={a.id}
                      done={false}
                      text={a.body}
                      toggleLabel=""
                      icon={<span style={{ color: "var(--terracotta)", flexShrink: 0 }}>●</span>}
                      onSave={(next) => editNote(a, next, setAvoids)}
                      onDelete={() => removeNote(a, "Entry", avoids, setAvoids)}
                    />
                  ))}
                </div>
              ) : (
                <div style={emptyNote}>Nothing logged yet — add the patterns you want to break</div>
              )}
              <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                <input
                  className="field-input"
                  placeholder="What to avoid..."
                  value={avoidText}
                  onChange={(e) => setAvoidText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addPlannerNote("avoid", avoidText, avoids, setAvoids, () => setAvoidText("")); }}
                  style={{ flex: 1, fontSize: "0.82rem", padding: "0.4rem 0.75rem" }}
                />
                <button
                  className="btn-add"
                  onClick={() => addPlannerNote("avoid", avoidText, avoids, setAvoids, () => setAvoidText(""))}
                  style={{ padding: "0.4rem 0.75rem", fontSize: "0.82rem" }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
              <div className="card-title" style={{ ...cardTitle, marginBottom: 0 }}>
                <CalendarDays size={18} /> {year} Overview
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <button className="cal-nav" onClick={() => setYearOffset(yearOffset - 1)} aria-label="Previous year"><ChevronLeft size={18} /></button>
                {yearOffset !== 0 && (
                  <button
                    className="btn-outline"
                    onClick={() => setYearOffset(0)}
                    style={{ padding: "0.2rem 0.6rem", fontSize: "0.72rem" }}
                  >
                    This year
                  </button>
                )}
                <button className="cal-nav" onClick={() => setYearOffset(yearOffset + 1)} aria-label="Next year"><ChevronRight size={18} /></button>
              </div>
            </div>
            <div className="year-grid">
              {MONTHS.map((m, mi) => {
                const firstDay = new Date(year, mi, 1).getDay();
                const adjFirst = firstDay === 0 ? 6 : firstDay - 1;
                const daysInMo = new Date(year, mi + 1, 0).getDate();
                return (
                  <div className="mini-cal" key={m}>
                    <div className="mini-cal-header">{m}</div>
                    <div className="mini-cal-days">
                      {["M", "T", "W", "T", "F", "S", "S"].map((d, idx) => (
                        <div className="mini-day-name" key={idx}>{d}</div>
                      ))}
                      {Array.from({ length: adjFirst }).map((_, i) => (
                        <div className="mini-day" key={"b" + i} />
                      ))}
                      {Array.from({ length: daysInMo }).map((_, i) => {
                        const d = i + 1;
                        // Year matters now that the grid navigates years.
                        const isToday =
                          year === now.getFullYear() && mi === now.getMonth() && d === now.getDate();
                        const date = new Date(year, mi, d);
                        const evs = byDateFiltered.get(toISO(date)) ?? [];
                        return (
                          <div
                            role="button"
                            tabIndex={0}
                            title={evs.length ? evs.map((e) => e.title).join(", ") : undefined}
                            aria-label={`${m} ${d}${evs.length ? `, ${evs.length} event${evs.length > 1 ? "s" : ""}` : ""}`}
                            className={"mini-day" + (isToday ? " today" : "") + (evs.length ? " has-event" : "")}
                            key={d}
                            onClick={() => openDay(date)}
                            onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openDay(date); } }}
                          >
                            {d}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real counts for the year in view, from the same aggregation. Held at
              "…" until the year range lands, so they never label a narrower
              window's numbers as the year's. */}
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label">Exams</div><div className="stat-val">{eventsLoading ? "…" : yearStats.exams}</div></div>
            <div className="stat-card"><div className="stat-label">Assignments</div><div className="stat-val">{eventsLoading ? "…" : yearStats.assigns}</div></div>
            <div className="stat-card"><div className="stat-label">Clinicals</div><div className="stat-val">{eventsLoading ? "…" : yearStats.clinicals}</div></div>
            <div className="stat-card"><div className="stat-label">Study Days</div><div className="stat-val">{eventsLoading ? "…" : yearStats.studyDays}</div></div>
          </div>
        </div>
      )}

      {/* ============ MONTHLY ============ */}
      {tab === "monthly" && (
        <div className="tab-content active">
          <div className="affirmation-banner" style={{ marginBottom: "1rem" }}>
            <Sparkles size={20} style={{ flexShrink: 0 }} />
            <p>{`"${affirmationFor("month", month)}"`}</p>
          </div>
          <div className="month-cal">
            <div className="month-cal-header">
              <button className="cal-nav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
              <h3>{MONTHS[month.getMonth()]} {month.getFullYear()}</h3>
              <button className="cal-nav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
            </div>
            <div className="cal-grid">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div className="cal-day-name" key={d}>{d}</div>
              ))}
              {(() => {
                const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
                const adj = firstDay === 0 ? 6 : firstDay - 1;
                const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
                const cells: React.ReactNode[] = [];
                for (let i = 0; i < adj; i++) {
                  cells.push(<div className="cal-day" key={"b" + i} style={{ background: "var(--bg-main)", opacity: 0.4 }} />);
                }
                for (let d = 1; d <= total; d++) {
                  const date = new Date(month.getFullYear(), month.getMonth(), d);
                  const isToday =
                    month.getFullYear() === now.getFullYear() &&
                    month.getMonth() === now.getMonth() &&
                    d === now.getDate();
                  const evs = byDateFiltered.get(toISO(date)) ?? [];
                  const shown = evs.slice(0, MONTH_CHIP_LIMIT);
                  const hidden = evs.length - shown.length;
                  cells.push(
                    <button
                      type="button"
                      className={
                        "cal-day" + (isToday ? " today" : "") + (isSameDay(date, day) ? " selected" : "")
                      }
                      key={d}
                      onClick={() => openDay(date)}
                      aria-label={`${MONTHS[month.getMonth()]} ${d}${evs.length ? `, ${evs.length} event${evs.length > 1 ? "s" : ""}` : ""}`}
                    >
                      <div className="cal-day-num">{d}</div>
                      {shown.map((e) => (
                        <div
                          className={"cal-event " + KIND_META[e.kind].cls + (e.done ? " is-done" : "")}
                          key={e.id}
                          title={[e.title, e.time, e.detail].filter(Boolean).join(" · ")}
                        >
                          {e.title}
                        </div>
                      ))}
                      {hidden > 0 && <div className="cal-more">+{hidden} more</div>}
                    </button>,
                  );
                }
                return cells;
              })()}
            </div>
          </div>
          {/* Legend doubles as a filter — click a kind to show/hide it in the grid. */}
          <div className="cal-legend">
            {KIND_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                className="cal-legend-btn"
                aria-pressed={kinds.includes(k)}
                onClick={() => toggleKind(k)}
              >
                <span className="swatch" style={{ background: KIND_META[k].color }} />
                {KIND_META[k].label}
              </button>
            ))}
          </div>

          <div className="card" style={{ marginTop: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
              <div className="card-title" style={{ ...cardTitle, marginBottom: 0 }}>
                <BookOpen size={18} /> Books to Read · {MONTHS[month.getMonth()]}
              </div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {books.length} book{books.length === 1 ? "" : "s"}
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
              <input
                className="field-input"
                placeholder="Book title..."
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addBook(); }}
                style={{ flex: 2, minWidth: 120, fontSize: "0.82rem", padding: "0.4rem 0.75rem" }}
              />
              <input
                className="field-input"
                placeholder="Author (optional)"
                value={bookAuthor}
                onChange={(e) => setBookAuthor(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addBook(); }}
                style={{ flex: 1.5, minWidth: 100, fontSize: "0.82rem", padding: "0.4rem 0.75rem" }}
              />
              <select
                className="field-select"
                value={bookStatus}
                onChange={(e) => setBookStatus(e.target.value)}
                style={{ fontSize: "0.8rem", padding: "0.4rem" }}
              >
                {BOOK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <button className="btn-add" onClick={addBook} style={{ padding: "0.4rem 0.75rem", fontSize: "0.82rem" }}>+ Add</button>
            </div>
            {books.length ? (
              <div style={listScroll}>
                {books.map((b) => (
                  <ListRow
                    key={b.id}
                    done={b.status === "done"}
                    text={b.title}
                    toggleLabel=""
                    icon={<BookOpen size={14} style={{ flexShrink: 0 }} />}
                    onSave={(next) => editBook(b, next)}
                    onDelete={() => removeBook(b)}
                    trailing={
                      /* Click to cycle To Read → Reading → Done. */
                      <button
                        type="button"
                        onClick={() => cycleBookStatus(b)}
                        title="Change status"
                        className={b.status === "done" ? "review-done" : "review-pending"}
                        style={{ border: "none", cursor: "pointer", font: "inherit", flexShrink: 0 }}
                      >
                        {BOOK_STATUSES.find((s) => s.value === (b.status ?? "to-read"))?.label ?? "To Read"}
                      </button>
                    }
                  />
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "0.75rem", fontStyle: "italic" }}>
                No books added for {MONTHS[month.getMonth()]} yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ WEEKLY ============ */}
      {tab === "weekly" && (
        <div className="tab-content active">
          <div className="affirmation-banner" style={{ marginBottom: "1rem" }}>
            <Sparkles size={20} style={{ flexShrink: 0 }} />
            <p>{`"${affirmationFor("week", weekMonday)}"`}</p>
          </div>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <button className="cal-nav" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Previous week"><ChevronLeft size={18} /></button>
              <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1rem" }}>
                Week of {MONTHS_SHORT[weekMonday.getMonth()]} {weekMonday.getDate()} – {MONTHS_SHORT[weekEnd.getMonth()]} {weekEnd.getDate()}, {weekEnd.getFullYear()}
              </div>
              <button className="cal-nav" onClick={() => setWeekOffset(weekOffset + 1)} aria-label="Next week"><ChevronRight size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "0.5rem" }}>
              {weekDays.map((d, i) => {
                const today = isSameDay(d, now);
                const evs = byDateAll.get(toISO(d)) ?? [];
                // One dot per distinct kind, capped — a density hint, not a count.
                const dotKinds = KIND_ORDER.filter((k) => evs.some((e) => e.kind === k)).slice(0, 4);
                return (
                  <div style={{ textAlign: "center" }} key={i}>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4 }}>
                      {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][i]}
                    </div>
                    <button
                      type="button"
                      onClick={() => openDay(d)}
                      aria-label={`${DAY_NAMES[d.getDay()]} ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}${evs.length ? `, ${evs.length} event${evs.length > 1 ? "s" : ""}` : ""}`}
                      style={{
                        width: 36, height: 36, borderRadius: "50%",
                        border: today ? "1.5px solid var(--terracotta)" : "1.5px solid var(--border-strong)",
                        background: today ? "var(--terracotta)" : "transparent",
                        color: today ? "white" : "var(--text-muted)",
                        fontWeight: today ? 600 : 400,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.82rem", margin: "auto", cursor: "pointer",
                        fontFamily: "inherit", padding: 0,
                      }}
                    >
                      {d.getDate()}
                    </button>
                    <span className="week-dots">
                      {dotKinds.map((k) => (
                        <i key={k} style={{ background: KIND_META[k].color }} />
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* THIS WEEK — the aggregated agenda, day by day */}
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div className="card-title" style={cardTitle}><CalendarDays size={18} /> This Week</div>
            {eventsLoading ? (
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
            ) : weekDays.every((d) => !(byDateAll.get(toISO(d)) ?? []).length) ? (
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "0.75rem" }}>
                Nothing scheduled this week. Exams, assignments, clinicals and classes show up here automatically.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {weekDays.map((d) => {
                  const evs = byDateAll.get(toISO(d)) ?? [];
                  if (!evs.length) return null;
                  return (
                    <div key={toISO(d)}>
                      <button
                        type="button"
                        onClick={() => openDay(d)}
                        style={{
                          background: "none", border: "none", padding: 0, cursor: "pointer",
                          fontFamily: "var(--font-caveat), cursive", fontSize: "0.95rem",
                          color: isSameDay(d, now) ? "var(--terracotta)" : "var(--text-secondary)",
                          marginBottom: "0.25rem",
                        }}
                      >
                        {DAY_NAMES[d.getDay()]} · {MONTHS_SHORT[d.getMonth()]} {d.getDate()}
                        {isSameDay(d, now) ? " · Today" : ""}
                      </button>
                      <DayAgenda events={evs} empty="" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Masonry for the same reason as Daily: a 2fr/1fr grid left a tall
              column of dead space beside whichever card happened to be shorter. */}
          <div className="k-masonry">
            {/* Was a dead "Priority Tasks This Week" form that would have become a
                THIRD task store. Assignments already carry priority + course + due
                date, so this reads them instead of duplicating them. */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
                <div className="card-title" style={{ ...cardTitle, marginBottom: 0 }}><Zap size={18} /> Due This Week</div>
                <Link href="/assignments" style={{ fontSize: "0.72rem", color: "var(--terracotta)" }}>Manage →</Link>
              </div>
              {eventsLoading ? (
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
              ) : weekDeadlines.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                  {weekDeadlines.map((e) => <AgendaRow key={e.id} e={e} />)}
                </div>
              ) : (
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center", padding: "1rem" }}>
                  Nothing due this week. Assignments, exams and quizzes appear here as their dates land in the week.
                </div>
              )}
            </div>
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <div className="card-title" style={{ ...cardTitle, marginBottom: 0 }}><Target size={18} /> Weekly Goals</div>
                  {goals.length > 0 && (
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {goals.filter((g) => g.done).length}/{goals.length}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem" }}>
                  <input
                    className="field-input"
                    placeholder="Add weekly goal..."
                    value={goalText}
                    onChange={(e) => setGoalText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addGoal(); }}
                    style={{ flex: 1, fontSize: "0.82rem", padding: "0.4rem 0.65rem" }}
                  />
                  <button className="btn-add" onClick={addGoal} style={{ padding: "0.4rem 0.6rem", fontSize: "0.82rem" }}>+</button>
                </div>
                {goals.length ? (
                  <div style={listScroll}>
                    {goals.map((g) => (
                      <ListRow
                        key={g.id}
                        done={g.done}
                        text={g.text}
                        toggleLabel={g.done ? "Mark as not done" : "Mark as done"}
                        onToggle={() => toggleGoal(g)}
                        onSave={(next) => editGoal(g, next)}
                        onDelete={() => removeGoal(g)}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "0.5rem" }}>
                    No goals for this week yet
                  </div>
                )}
              </div>
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <div className="card-title" style={{ ...cardTitle, marginBottom: 0 }}><FileText size={18} /> Weekly Reflection</div>
                  <button
                    onClick={() => saveText("reflection", reflection)}
                    disabled={saving === "reflection"}
                    className="btn-outline"
                    style={{ padding: "0.25rem 0.65rem", fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <Save size={13} /> {saving === "reflection" ? "Saving…" : "Save"}
                  </button>
                </div>
                <textarea
                  className="field-textarea"
                  placeholder="How did this week go? What did you accomplish? What could be improved?"
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  style={{ width: "100%", fontSize: "0.82rem", minHeight: 80 }}
                />
              </div>
          </div>
        </div>
      )}

      {/* ============ DAILY ============ */}
      {tab === "daily" && (
        <div className="tab-content active">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            {/* setDate, not ±86400000 — arithmetic on epoch ms skips or repeats a day across DST. */}
            <button className="cal-nav" onClick={() => setDay(shiftDay(day, -1))} aria-label="Previous day"><ChevronLeft size={18} /></button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.2rem" }}>{DAY_NAMES[day.getDay()]}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {MONTHS[day.getMonth()]} {day.getDate()}, {day.getFullYear()}
                {isSameDay(day, now) ? " · Today" : ""}
              </div>
            </div>
            <button className="cal-nav" onClick={() => setDay(shiftDay(day, 1))} aria-label="Next day"><ChevronRight size={18} /></button>
          </div>

          {/* ONE banner, not the three stacked ones this replaced: they ate ~180px
              above the fold before any real content, and the middle one was a
              verbatim copy of the Weekly line — a "this week" affirmation sitting
              on the Daily tab. */}
          <div className="affirmation-banner" style={{ marginBottom: "1rem" }}>
            <Heart size={18} style={{ color: "var(--terracotta)", flexShrink: 0 }} />
            <p>{`"${affirmationFor("day", day)}"`}</p>
          </div>

          {/* Masonry, not grid: these six cards have very different natural heights
              (a mood row vs a task list vs a journal box), and a grid row would
              reserve the tallest card's height under every short one. */}
          <div className="k-masonry">
            {/* Was TWO cards ("Priority Tasks" + "Daily Tasks") doing the same job,
                one dead and one in component state. Now one card on `daily_tasks` —
                the same rows the dashboard reads and writes. */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <div className="card-title" style={{ ...cardTitle, marginBottom: 0 }}><ListChecks size={18} /> Tasks</div>
                {tasks.length > 0 && (
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    {tasks.filter((t) => t.done).length}/{tasks.length} done
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                <select
                  className="field-select"
                  value={taskTag}
                  onChange={(e) => setTaskTag(e.target.value)}
                  style={{ fontSize: "0.78rem", padding: "0.35rem" }}
                >
                  {TASK_TAGS.map((t) => <option key={t.label} value={t.label}>{t.label}</option>)}
                </select>
                <input
                  className="field-input"
                  placeholder="Add task..."
                  value={taskText}
                  onChange={(e) => setTaskText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
                  style={{ flex: 1, minWidth: 120, fontSize: "0.82rem", padding: "0.4rem 0.75rem" }}
                />
                <button className="btn-add" onClick={addTask} style={{ padding: "0.4rem 0.65rem", fontSize: "0.82rem" }}>+</button>
              </div>
              {tasks.length ? (
                <div style={listScroll}>
                  {tasks.map((t) => (
                    <ListRow
                      key={t.id}
                      done={t.done}
                      text={t.text}
                      toggleLabel={t.done ? "Mark as not done" : "Mark as done"}
                      onToggle={() => toggleTask(t)}
                      onSave={(next) => editTask(t, next)}
                      onDelete={() => removeTask(t)}
                      trailing={t.tag ? <span className={"task-tag " + (t.tag_class ?? "")}>{t.tag}</span> : undefined}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "0.75rem" }}>
                  No tasks for this day yet
                </div>
              )}
            </div>

            {/* Shared with the Dashboard — one code path, so the prompt rotation
                and the echo behave identically wherever gratitude appears. */}
            <GratitudeCard date={day} />

            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <div className="card-title" style={{ ...cardTitle, marginBottom: 0 }}><NotebookPen size={18} /> Daily Journal</div>
                <button
                  onClick={() => saveText("journal", journal)}
                  disabled={saving === "journal"}
                  className="btn-outline"
                  style={{ padding: "0.25rem 0.65rem", fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <Save size={13} /> {saving === "journal" ? "Saving…" : "Save"}
                </button>
              </div>
              <textarea
                className="field-textarea"
                placeholder="How was your day? What did you learn? What are you thinking about?"
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                style={{ width: "100%", minHeight: 100, fontSize: "0.82rem" }}
              />
            </div>

            {/* Real agenda for the selected day, aggregated from every dated table.
                Read-only: each row deep-links to the page that owns it. */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <div className="card-title" style={{ ...cardTitle, marginBottom: 0 }}><Clock size={18} /> Day Agenda</div>
                {!eventsLoading && dayEvents.length > 0 && (
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    {dayEvents.length} item{dayEvents.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {eventsLoading ? (
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
              ) : (
                <DayAgenda
                  events={dayEvents}
                  empty="Nothing on this day. Classes, exams, assignments, clinicals and study sessions appear here automatically."
                />
              )}
            </div>

            {/* Was local state that defaulted to "Okay", so an untouched day looked
                logged — and it duplicated the real Mood tracker. Now it upserts a
                `tracker_entries` row against the user's own Mood tracker, so
                Calendar and Trackers show the same number. */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <div className="card-title" style={{ ...cardTitle, marginBottom: 0 }}><Smile size={18} /> Daily Mood</div>
                <Link href="/trackers" style={{ fontSize: "0.72rem", color: "var(--terracotta)" }}>Trends →</Link>
              </div>
              {moodTracker ? (
                <>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-around", marginBottom: "0.5rem" }}>
                    {MOOD_SCALE.map((m) => (
                      <button
                        key={m.value}
                        className={"mood-btn" + (mood === m.value ? " selected" : "")}
                        aria-pressed={mood === m.value}
                        onClick={() => logMood(m.value)}
                      >
                        {m.emoji}<br /><span style={{ fontSize: "0.6rem" }}>{m.label}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {mood === null
                      ? "Not logged for this day"
                      : `Logged: ${MOOD_SCALE.find((m) => m.value === mood)?.label}`}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "0.75rem" }}>
                  No Mood tracker yet — <Link href="/trackers" style={{ color: "var(--terracotta)" }}>set one up in Trackers</Link> and log it from here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ DAY DETAIL SHEET ============
          Opened by clicking any date in the Yearly / Monthly / Weekly grids.
          Peek at the day's agenda and add to it without leaving the month. */}
      <DetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={`${DAY_NAMES[day.getDay()]}, ${MONTHS[day.getMonth()]} ${day.getDate()}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "-0.35rem" }}>
            {day.getFullYear()}{isSameDay(day, now) ? " · Today" : ""}
            {dayEvents.length ? ` · ${dayEvents.length} item${dayEvents.length > 1 ? "s" : ""}` : ""}
          </div>

          <DayAgenda events={dayEvents} empty="Nothing on this day yet." />

          {/* Quick add — writes into the table that owns the kind. */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.85rem" }}>
            <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
              Add to this day
            </div>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              {ADD_KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  className="cal-legend-btn"
                  aria-pressed={addKind === k.value}
                  onClick={() => {
                    setAddKind(k.value);
                    // Exams require a course, so the select can't sit on "No course".
                    if (k.needsCourse && !addCourse && courses.length) setAddCourse(courses[0].id);
                  }}
                >
                  <span className="swatch" style={{ background: KIND_META[k.value].color }} />
                  {k.label}
                </button>
              ))}
            </div>

            {activeAddKind.needsCourse && !courses.length ? (
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Exams need a course — <Link href="/courses" style={{ color: "var(--terracotta)" }}>add one in Courses</Link> first.
              </div>
            ) : (
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {(activeAddKind.needsCourse || addKind === "assign") && courses.length > 0 && (
                  <select
                    className="field-select"
                    value={addCourse}
                    onChange={(e) => setAddCourse(e.target.value)}
                    style={{ fontSize: "0.8rem", padding: "0.4rem" }}
                  >
                    {!activeAddKind.needsCourse && <option value="">No course</option>}
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.code || c.name}</option>
                    ))}
                  </select>
                )}
                <input
                  className="field-input"
                  placeholder={activeAddKind.placeholder}
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") quickAdd(); }}
                  style={{ flex: 1, minWidth: 140, fontSize: "0.82rem", padding: "0.4rem 0.75rem" }}
                />
                <button
                  className="btn-add"
                  onClick={quickAdd}
                  disabled={addBusy || !addTitle.trim()}
                  style={{ padding: "0.4rem 0.75rem", fontSize: "0.82rem" }}
                >
                  {addBusy ? "Adding…" : "+ Add"}
                </button>
              </div>
            )}
          </div>

          <button
            className="btn-outline"
            onClick={() => { setSheetOpen(false); setTab("daily"); }}
            style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
          >
            Open full day view →
          </button>
        </div>
      </DetailSheet>
    </div>
  );
}
