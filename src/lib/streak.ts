// Study-streak math. A "study day" is any day the user did qualifying activity
// (completed a task, or tapped "Mark today as studied"). Dates are handled in the
// viewer's LOCAL timezone — same as the dashboard greeting/date — so "today" lines
// up with what the user sees on their clock, not UTC.

/** Local calendar date as `YYYY-MM-DD`. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a `YYYY-MM-DD` string into a local midnight Date. */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Current streak: consecutive study days ending at today. Stays "alive" through
 * the current day — if today hasn't been logged yet but yesterday was, yesterday's
 * run still counts. It only resets to 0 once a full day passes with no activity.
 */
export function currentStreak(days: Set<string>): number {
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(toISODate(cursor))) {
    // Not logged yet today — fall back to yesterday so the streak doesn't read 0
    // until the day is actually missed.
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(toISODate(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(toISODate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Longest run of consecutive study days ever recorded. */
export function longestStreak(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const s of sorted) {
    const d = parseISODate(s);
    if (prev && Math.round((d.getTime() - prev.getTime()) / 86400000) === 1) run++;
    else run = 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}
