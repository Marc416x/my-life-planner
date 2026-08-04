// Calendar aggregation layer.
//
// The Calendar page owns no events of its own — it is a READ-ONLY VIEW over the
// dated rows the rest of the app already writes. This module unions those tables
// into one flat `CalendarEvent[]` for a date range, so Monthly / Weekly / Daily
// all render from a single shape and every chip can deep-link back to the page
// that owns the row.
//
// Sources (all RLS-scoped to the signed-in user, so no user_id filter is needed):
//   exams.exam_date              → /exams
//   assignments.due_date         → /assignments
//   quizzes.taken_on             → /quizzes
//   clinical_sessions.session_date → /clinicals
//   study_sessions.session_date  → /study
//   daily_tasks.task_date        → /            (dashboard owns the list)
//   schedule_blocks.day          → /schedule    (RECURRING — expanded per week)
//
// NO term scoping here, by design: a calendar is already scoped by its date
// range, which selects a term implicitly. Layering the archived-term picker on
// top would silently blank out real rows inside the visible window. (Same call
// as Progress Metrics — see 0015_term_archive.sql for the term rule itself.)

import { parseISO, toISO } from "./group-by-date";

export type EventKind =
  | "exam"
  | "assign"
  | "quiz"
  | "clinical"
  | "class"
  | "study"
  | "task";

export type CalendarEvent = {
  /** Stable across refetches: `kind:rowId` (+ date for expanded recurrences). */
  id: string;
  /** Local `YYYY-MM-DD`. */
  date: string;
  kind: EventKind;
  title: string;
  /** Secondary line for the day agenda (course, department, duration…). */
  detail?: string;
  /** Display time, if the row has one ("9:00 AM"). */
  time?: string;
  /** Minutes past local midnight, for chronological sort. Untimed → null. */
  minutes: number | null;
  /** Completed / already-happened, rendered dimmed + struck through. */
  done?: boolean;
};

type KindMeta = { label: string; cls: string; href: string; color: string };

/**
 * Display metadata per kind. `cls` matches the `.evt-*` rules in legacy/base.css;
 * `color` is the solid swatch/dot colour (palette vars, so it tracks the active
 * style tokens rather than freezing the default scheme).
 */
export const KIND_META: Record<EventKind, KindMeta> = {
  exam: { label: "Exams", cls: "evt-exam", href: "/exams", color: "var(--terracotta)" },
  assign: { label: "Assignments", cls: "evt-assign", href: "/assignments", color: "var(--olive)" },
  quiz: { label: "Quizzes", cls: "evt-quiz", href: "/quizzes", color: "var(--clay)" },
  clinical: { label: "Clinicals", cls: "evt-clinical", href: "/clinicals", color: "var(--forest)" },
  class: { label: "Classes", cls: "evt-class", href: "/schedule", color: "var(--text-muted)" },
  study: { label: "Study", cls: "evt-study", href: "/study", color: "var(--ochre)" },
  task: { label: "Tasks", cls: "evt-task", href: "/", color: "var(--lavender)" },
};

/** Fixed order for legends, filters, and tie-breaking within a day. */
export const KIND_ORDER: EventKind[] = [
  "exam", "assign", "quiz", "clinical", "class", "study", "task",
];

/**
 * Kinds shown in the month grid by default. Recurring classes are excluded:
 * they land on every weekday and would bury the handful of chips that actually
 * matter at month altitude. The legend can toggle them back on, and Weekly /
 * Daily show them unconditionally.
 */
export const DEFAULT_MONTH_KINDS: EventKind[] = [
  "exam", "assign", "quiz", "clinical", "study", "task",
];

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** "14:30" → 870. Returns null for empty/unparseable input. */
function minutesFrom24h(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** "9:00 AM" → 540. Returns null for empty/unparseable input. */
function minutesFrom12h(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s.trim());
  if (!m) return minutesFrom24h(s);
  const h = Number(m[1]) % 12;
  const pm = m[3].toUpperCase() === "PM";
  return (pm ? h + 12 : h) * 60 + Number(m[2]);
}

/** 870 → "2:30 PM". */
function fmt12h(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h24 % 12 || 12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/** Minutes → "1h 20m" / "45m", for study + clinical durations. */
function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Chronological within a day: timed rows first (ascending), then untimed ones
 * in `KIND_ORDER`. Stable enough that the grid doesn't reshuffle on refetch.
 */
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.minutes !== null && b.minutes !== null && a.minutes !== b.minutes) {
    return a.minutes - b.minutes;
  }
  if (a.minutes !== null && b.minutes === null) return -1;
  if (a.minutes === null && b.minutes !== null) return 1;
  const ko = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
  return ko !== 0 ? ko : a.title.localeCompare(b.title);
}

/** Bucket events by local `YYYY-MM-DD`, each day's list sorted chronologically. */
export function indexByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = map.get(e.date);
    if (list) list.push(e);
    else map.set(e.date, [e]);
  }
  for (const list of map.values()) list.sort(compareEvents);
  return map;
}

/** Inclusive `[start, end]` local-ISO range for the whole of `year`. */
export function yearRange(year: number): { start: string; end: string } {
  return { start: toISO(new Date(year, 0, 1)), end: toISO(new Date(year, 11, 31)) };
}

// Minimal row shapes — only the columns each query actually selects.
type ExamRow = { id: string; name: string; exam_date: string | null; course_id: string | null };
type AssignRow = { id: string; title: string; due_date: string | null; due_time: string | null; course: string | null; status: string | null };
type QuizRow = { id: string; name: string; taken_on: string | null; score: number | null; max_score: number | null; course_id: string | null };
type ClinicalRow = { id: string; session_date: string | null; department: string | null; hours: number | null; goal: string | null };
type StudyRow = { id: string; topic: string | null; session_date: string; duration_min: number; course_id: string | null };
type TaskRow = { id: string; text: string; task_date: string | null; done: boolean | null; tag: string | null };
type BlockRow = { id: string; day: string; start_label: string; end_label: string | null; subject: string };
type CourseRow = { id: string; name: string; code: string | null };

/** Minimal view of the browser Supabase client, so this module stays UI-free. */
type Db = {
  from(table: string): {
    select(cols: string): {
      gte(col: string, v: string): { lte(col: string, v: string): PromiseLike<{ data: unknown; error: unknown }> };
    } & PromiseLike<{ data: unknown; error: unknown }>;
  };
};

/**
 * Expand recurring weekly `schedule_blocks` into concrete dated events across
 * `[start, end]`. A block stores a weekday name, not a date, so it has to be
 * materialised per week the range touches.
 */
function expandBlocks(blocks: BlockRow[], start: string, end: string): CalendarEvent[] {
  if (!blocks.length) return [];
  const byDay = new Map<string, BlockRow[]>();
  for (const b of blocks) {
    const list = byDay.get(b.day);
    if (list) list.push(b);
    else byDay.set(b.day, [b]);
  }
  const out: CalendarEvent[] = [];
  const cursor = parseISO(start);
  const last = parseISO(end);
  while (cursor <= last) {
    const iso = toISO(cursor);
    for (const b of byDay.get(DAY_NAMES[cursor.getDay()]) ?? []) {
      out.push({
        id: `class:${b.id}:${iso}`,
        date: iso,
        kind: "class",
        title: b.subject,
        detail: b.end_label ? `${b.start_label} – ${b.end_label}` : b.start_label,
        time: b.start_label,
        minutes: minutesFrom12h(b.start_label),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export type CalendarFetch = {
  events: CalendarEvent[];
  /** Human labels of sources that errored — their kind is missing, not empty. */
  failed: string[];
};

/**
 * Every dated row across the app, in `[start, end]` (inclusive, local ISO).
 *
 * Each source is queried independently and degrades on its own — supabase-js
 * resolves errors into `{ data: null, error }` rather than throwing, so one
 * failing table blanks that kind only, never the calendar. Failures are reported
 * back in `failed` rather than swallowed, so the UI can say "clinicals didn't
 * load" instead of implying the user has none.
 */
export async function fetchCalendarEvents(
  supabase: Db,
  start: string,
  end: string,
): Promise<CalendarFetch> {
  const range = (table: string, cols: string, dateCol: string) =>
    supabase.from(table).select(cols).gte(dateCol, start).lte(dateCol, end);

  const [exams, assigns, quizzes, clinicals, study, tasks, blocks, courses] = await Promise.all([
    range("exams", "id, name, exam_date, course_id", "exam_date"),
    range("assignments", "id, title, due_date, due_time, course, status", "due_date"),
    range("quizzes", "id, name, taken_on, score, max_score, course_id", "taken_on"),
    range("clinical_sessions", "id, session_date, department, hours, goal", "session_date"),
    range("study_sessions", "id, topic, session_date, duration_min, course_id", "session_date"),
    range("daily_tasks", "id, text, task_date, done, tag", "task_date"),
    supabase.from("schedule_blocks").select("id, day, start_label, end_label, subject"),
    supabase.from("courses").select("id, name, code"),
  ]);

  const failed: string[] = [];
  const rows = <T,>(r: { data: unknown; error: unknown }, label: string): T[] => {
    if (r.error) failed.push(label);
    return (r.data as T[] | null) ?? [];
  };
  const courseName = new Map(
    rows<CourseRow>(courses, "courses").map((c) => [c.id, c.code || c.name]),
  );

  const out: CalendarEvent[] = [];

  for (const e of rows<ExamRow>(exams, "exams")) {
    if (!e.exam_date) continue;
    out.push({
      id: `exam:${e.id}`,
      date: e.exam_date,
      kind: "exam",
      title: e.name,
      detail: e.course_id ? courseName.get(e.course_id) : undefined,
      minutes: null,
    });
  }

  for (const a of rows<AssignRow>(assigns, "assignments")) {
    if (!a.due_date) continue;
    const mins = minutesFrom24h(a.due_time);
    out.push({
      id: `assign:${a.id}`,
      date: a.due_date,
      kind: "assign",
      title: a.title,
      detail: a.course ?? undefined,
      time: mins === null ? undefined : fmt12h(mins),
      minutes: mins,
      done: a.status === "completed",
    });
  }

  for (const q of rows<QuizRow>(quizzes, "quizzes")) {
    if (!q.taken_on) continue;
    const scored =
      q.score !== null && q.max_score !== null && Number(q.max_score) > 0
        ? `${Math.round((Number(q.score) / Number(q.max_score)) * 100)}%`
        : undefined;
    const course = q.course_id ? courseName.get(q.course_id) : undefined;
    out.push({
      id: `quiz:${q.id}`,
      date: q.taken_on,
      kind: "quiz",
      title: q.name,
      detail: [course, scored].filter(Boolean).join(" · ") || undefined,
      minutes: null,
      done: true, // quizzes are logged after the fact
    });
  }

  for (const c of rows<ClinicalRow>(clinicals, "clinicals")) {
    if (!c.session_date) continue;
    const hrs = c.hours === null ? undefined : `${Number(c.hours)}h`;
    out.push({
      id: `clinical:${c.id}`,
      date: c.session_date,
      kind: "clinical",
      title: c.department || "Clinical",
      detail: [hrs, c.goal ?? undefined].filter(Boolean).join(" · ") || undefined,
      minutes: null,
    });
  }

  for (const s of rows<StudyRow>(study, "study sessions")) {
    const course = s.course_id ? courseName.get(s.course_id) : undefined;
    out.push({
      id: `study:${s.id}`,
      date: s.session_date,
      kind: "study",
      title: s.topic || "Study session",
      detail: [course, fmtDuration(s.duration_min)].filter(Boolean).join(" · "),
      minutes: null,
      done: true, // study is logged after the fact
    });
  }

  for (const t of rows<TaskRow>(tasks, "tasks")) {
    if (!t.task_date) continue;
    out.push({
      id: `task:${t.id}`,
      date: t.task_date,
      kind: "task",
      title: t.text,
      detail: t.tag ?? undefined,
      minutes: null,
      done: !!t.done,
    });
  }

  out.push(...expandBlocks(rows<BlockRow>(blocks, "class schedule"), start, end));

  return { events: out, failed };
}
