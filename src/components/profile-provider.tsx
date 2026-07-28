"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentStreak, longestStreak, toISODate } from "@/lib/streak";
import { levelInfo, type LevelInfo } from "@/lib/level";

type ProfileCtx = {
  name: string;
  email: string;
  initials: string;
  /** ISO `YYYY-MM-DD` dates the user has studied, unordered. */
  studyDays: string[];
  /** Consecutive study days ending today (stays alive through the current day). */
  streak: number;
  /** Longest streak ever recorded — drives the Discipline Level. */
  best: number;
  /** Discipline Level derived from `best` (tier, progress, next tier…). */
  level: LevelInfo;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Mark today as a study day (idempotent) and update the streak everywhere. */
  recordActivity: () => Promise<void>;
};

const Ctx = createContext<ProfileCtx>({
  name: "",
  email: "",
  initials: "",
  studyDays: [],
  streak: 0,
  best: 0,
  level: levelInfo(0),
  loading: true,
  refresh: async () => {},
  recordActivity: async () => {},
});

function computeInitials(name: string, email: string) {
  const source = (name.trim() || email.split("@")[0] || "").trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

// Loads the signed-in user's profile once and shares it app-wide (sidebar name +
// avatar + streak, dashboard greeting + streak). A couple of primary-key lookups
// per page load, not per component.
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [studyDays, setStudyDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setEmail(user?.email ?? "");
    setUserId(user?.id ?? null);
    if (user) {
      const { data } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      setName(data?.name ?? "");
      const { data: days } = await supabase.from("study_days").select("day").eq("user_id", user.id);
      setStudyDays((days ?? []).map((r) => r.day as string));
    } else {
      setName("");
      setStudyDays([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Load once on mount from Supabase (an external system) — the standard
    // data-fetching effect the set-state-in-effect rule doesn't account for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const recordActivity = useCallback(async () => {
    if (!userId) return;
    const today = toISODate(new Date());
    // Optimistic: reflect the study day immediately, then persist.
    setStudyDays((prev) => (prev.includes(today) ? prev : [...prev, today]));
    const supabase = createClient();
    await supabase
      .from("study_days")
      .upsert({ user_id: userId, day: today }, { onConflict: "user_id,day" });
  }, [userId]);

  const initials = computeInitials(name, email);
  const streak = useMemo(() => currentStreak(new Set(studyDays)), [studyDays]);
  const best = useMemo(() => longestStreak(studyDays), [studyDays]);
  const level = useMemo(() => levelInfo(best), [best]);

  return (
    <Ctx.Provider value={{ name, email, initials, studyDays, streak, best, level, loading, refresh, recordActivity }}>
      {children}
    </Ctx.Provider>
  );
}

export function useProfile() {
  return useContext(Ctx);
}
