// Reusable date-grouping for the logging surfaces (Study Sessions, Error Log,
// and — later — Clinicals, Quizzes, …). Pure functions, no React, so any list
// can adopt day-grouping by calling `groupByDay` and rendering a
// <DateGroupHeader> (src/components/kit) above each group.
//
// Phase 1: group by calendar day, newest first, with friendly labels
// ("Today" / "Yesterday" / "Wed · Jul 22"). A later phase can roll older days
// up into collapsible week/month summaries on top of the same groups.

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse a `YYYY-MM-DD` string as a local-midnight Date. */
function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Friendly header label for a `YYYY-MM-DD` day, relative to today (local). */
export function dayLabel(iso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = parseISO(iso);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const base = `${WEEKDAYS_SHORT[d.getDay()]} · ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  // Disambiguate older years.
  return d.getFullYear() === today.getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Local `YYYY-MM-DD` for a Date. */
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday (local) of the week containing `d`. Matches Postgres `date_trunc('week')`. */
function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export type Granularity = "day" | "week" | "month";

/** Header label for a week/month period keyed by its start date (from the roll-up RPCs). */
export function periodLabel(iso: string, gran: "week" | "month"): string {
  const d = parseISO(iso);
  const now = new Date();
  if (gran === "month") {
    return d.getFullYear() === now.getFullYear()
      ? MONTHS_LONG[d.getMonth()]
      : `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
  }
  const thisMon = toISO(mondayOf(now));
  const lastMon = toISO(mondayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)));
  if (iso === thisMon) return "This week";
  if (iso === lastMon) return "Last week";
  const base = `Week of ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

/** Inclusive `[start, end]` ISO date range covered by a period, for the drill-down query. */
export function periodRange(iso: string, gran: "week" | "month"): { start: string; end: string } {
  const d = parseISO(iso);
  if (gran === "month") {
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0); // last day of month
    return { start: iso, end: toISO(end) };
  }
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return { start: iso, end: toISO(end) };
}

export type DayGroup<T> = { key: string; label: string; items: T[] };

/**
 * Bucket an already date-sorted list into contiguous day groups, preserving the
 * incoming order (so a `date desc` list yields newest-day-first groups). Safe to
 * call on the full accumulated list every render — groups re-form correctly even
 * when a day spans a pagination boundary.
 */
export function groupByDay<T>(items: T[], getISO: (t: T) => string): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  const index = new Map<string, DayGroup<T>>();
  for (const it of items) {
    const key = getISO(it);
    let g = index.get(key);
    if (!g) {
      g = { key, label: dayLabel(key), items: [] };
      index.set(key, g);
      groups.push(g);
    }
    g.items.push(it);
  }
  return groups;
}

export type PeriodGroup<T> = { key: string; items: T[] };

/**
 * Bucket a list into week/month periods **in memory**, keyed by the period's
 * local start date (Monday for weeks, the 1st for months — matching Postgres
 * `date_trunc`, so `periodLabel`/`periodRange` accept the same keys). Groups are
 * returned newest-first. Use this on pages that already hold their full history
 * client-side (e.g. Clinicals); pages that paginate should call the roll-up RPCs
 * instead so the summary totals stay accurate beyond the loaded window.
 */
export function groupByPeriod<T>(items: T[], getISO: (t: T) => string, gran: "week" | "month"): PeriodGroup<T>[] {
  const groups: PeriodGroup<T>[] = [];
  const index = new Map<string, PeriodGroup<T>>();
  for (const it of items) {
    const d = parseISO(getISO(it));
    const start = gran === "week" ? mondayOf(d) : new Date(d.getFullYear(), d.getMonth(), 1);
    const key = toISO(start);
    let g = index.get(key);
    if (!g) {
      g = { key, items: [] };
      index.set(key, g);
      groups.push(g);
    }
    g.items.push(it);
  }
  groups.sort((a, b) => b.key.localeCompare(a.key)); // newest period first
  return groups;
}
