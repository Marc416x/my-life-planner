import { Sprout, Leaf, Flame, Star, Zap, Trophy, type LucideIcon } from "lucide-react";

// Discipline ladder — driven by your BEST streak (longest run ever), so a level
// once earned never drops. `min` is the best-streak length (days) that unlocks
// the tier. Keep this in sync with the "How levels work" guide on Settings.
export type Tier = { name: string; min: number; icon: LucideIcon };

export const TIERS: Tier[] = [
  { name: "Beginner", min: 0, icon: Sprout },
  { name: "Rising", min: 3, icon: Leaf },
  { name: "Disciplined", min: 7, icon: Flame },
  { name: "Focused", min: 14, icon: Star },
  { name: "Relentless", min: 30, icon: Zap },
  { name: "Legend", min: 60, icon: Trophy },
];

export type LevelInfo = {
  /** 1-based level number (Beginner = 1 … Legend = 6). */
  level: number;
  tier: Tier;
  /** The next tier to reach, or null when already at the top. */
  next: Tier | null;
  /** Best-streak days still needed for the next tier (0 when maxed). */
  daysToNext: number;
  /** Progress toward the next tier, 0–100 (100 when maxed). */
  progress: number;
};

export function levelInfo(bestStreak: number): LevelInfo {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (bestStreak >= TIERS[i].min) idx = i;
  }
  const tier = TIERS[idx];
  const next = idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
  if (!next) {
    return { level: idx + 1, tier, next: null, daysToNext: 0, progress: 100 };
  }
  const span = next.min - tier.min;
  const done = bestStreak - tier.min;
  const progress = Math.max(0, Math.min(100, Math.round((done / span) * 100)));
  return { level: idx + 1, tier, next, daysToNext: Math.max(0, next.min - bestStreak), progress };
}
