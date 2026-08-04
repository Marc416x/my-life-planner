// Rotating affirmations for the Calendar banners.
//
// These were four hardcoded strings — the same sentence on every visit, forever.
// An affirmation you have read two hundred times is wallpaper: the eye stops
// seeing it, and it costs real space above the fold. Rotating them per period
// gives the banner a reason to be read again.
//
// The pick is DETERMINISTIC on the period, not random: the same day always shows
// the same line, so it can't reshuffle on re-render or make the page feel jittery.
// It changes when the period does — a new day, week, month or year.
//
// Lines are written for a nursing student specifically. Generic
// "believe in yourself" filler is exactly what makes this kind of banner
// invisible in the first place.

export type AffirmationScope = "year" | "month" | "week" | "day";

const POOLS: Record<AffirmationScope, string[]> = {
  year: [
    "I am capable of achieving extraordinary things this academic year.",
    "This year I build the habits, not just the grades.",
    "Every rotation this year makes me a nurse patients can trust.",
    "I am allowed to grow at my own pace and still arrive.",
    "The version of me who graduates is built by ordinary days like today.",
  ],
  month: [
    "This month I focus on progress, not perfection.",
    "Small consistent weeks beat one heroic all-nighter.",
    "I would rather understand it slowly than memorise it twice.",
    "This month I protect my sleep as carefully as my study time.",
    "I am further along than I was when this month started.",
  ],
  week: [
    "This week I focus on building momentum.",
    "One honest hour beats four distracted ones.",
    "I plan the week I can actually keep.",
    "Falling behind for a day is not falling behind for the week.",
    "This week I ask the question I am afraid sounds stupid.",
  ],
  day: [
    "Today I trust in my ability to handle whatever comes my way.",
    "I only have to do today well.",
    "I can be tired and still be capable.",
    "Progress today counts even if nobody sees it.",
    "I show up for my patients by first showing up for myself.",
    "Not knowing something yet is the whole point of being a student.",
    "I celebrate what I finished before listing what I didn't.",
  ],
};

/** Start of the period `date` falls in, as a stable local key. */
function periodKey(scope: AffirmationScope, date: Date): string {
  const y = date.getFullYear();
  if (scope === "year") return `${y}`;
  if (scope === "month") return `${y}-${date.getMonth()}`;
  if (scope === "week") {
    const m = new Date(date);
    m.setHours(0, 0, 0, 0);
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); // back to Monday
    return `${m.getFullYear()}-${m.getMonth()}-${m.getDate()}`;
  }
  return `${y}-${date.getMonth()}-${date.getDate()}`;
}

/** Stable index into a rotating list, derived from a string key. */
export function stableIndex(key: string, modulo: number): number {
  if (modulo <= 0) return 0;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % modulo;
}

/** The affirmation for the period `date` falls in. Same input → same line. */
export function affirmationFor(scope: AffirmationScope, date: Date): string {
  const pool = POOLS[scope];
  return pool[stableIndex(`${scope}:${periodKey(scope, date)}`, pool.length)];
}
