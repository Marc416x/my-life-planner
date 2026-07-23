// Pure logic for deciding which assignment reminders are due on a given day.
// Kept free of Supabase/web-push so it's easy to reason about and test.

export type ReminderKind = "planner_due" | "due_morning" | "overdue";

// Matches the Assignments page: "Planner Due" is the actual due date minus 2 days.
export const PLANNER_LEAD_DAYS = 2;

// How far back we'll still nudge about something overdue. Stops a pile of
// ancient assignments firing all at once the first time a user subscribes.
export const OVERDUE_LOOKBACK_DAYS = 14;

export type ReminderAssignment = {
  id: string;
  user_id: string;
  title: string;
  course: string | null;
  due_date: string; // YYYY-MM-DD
  status: string;
};

export type Prefs = {
  enabled: boolean;
  planner_due: boolean;
  due_morning: boolean;
  overdue: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  enabled: true,
  planner_due: true,
  due_morning: true,
  overdue: true,
};

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// We compare plain YYYY-MM-DD strings against "today" in UTC. The cron runs once
// a day (12:00 UTC, set in vercel.json), so the *date* is accurate; the local
// hour a user sees it depends on their timezone. Per-user timezones are a later
// refinement — it would need an hourly job, which the free tier doesn't allow.
export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function formatMD(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  void y;
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}

// Which reminder (if any) does this due date warrant today?
// Order matters: an assignment is only ever one of these on a given day.
export function kindFor(dueDate: string, today: string): ReminderKind | null {
  if (dueDate === addDays(today, PLANNER_LEAD_DAYS)) return "planner_due";
  if (dueDate === today) return "due_morning";
  if (dueDate < today && dueDate >= addDays(today, -OVERDUE_LOOKBACK_DAYS)) return "overdue";
  return null;
}

export function prefAllows(prefs: Prefs, kind: ReminderKind): boolean {
  if (!prefs.enabled) return false;
  return prefs[kind];
}

// Notification copy, per kind.
export function buildMessage(
  kind: ReminderKind,
  a: ReminderAssignment,
): { title: string; body: string } {
  const where = a.course ? ` (${a.course})` : "";
  switch (kind) {
    case "planner_due":
      return {
        title: "Time to start 📓",
        body: `"${a.title}"${where} is due in ${PLANNER_LEAD_DAYS} days — ${formatMD(a.due_date)}.`,
      };
    case "due_morning":
      return {
        title: "Due today ⏰",
        body: `"${a.title}"${where} is due today.`,
      };
    case "overdue":
      return {
        title: "Overdue ⚠️",
        body: `"${a.title}"${where} was due ${formatMD(a.due_date)} and isn't marked complete.`,
      };
  }
}
