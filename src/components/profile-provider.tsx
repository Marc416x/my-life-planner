"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentStreak, longestStreak, toISODate } from "@/lib/streak";
import { levelInfo, type LevelInfo } from "@/lib/level";
import { allArchivedTerms, type TermCount, type TermRow } from "@/lib/term";

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
  /** Pro subscription flag (`profiles.is_pro`) — unlocks Premium features. */
  isPro: boolean;
  /** Current academic term (`profiles.year`). */
  currentTerm: string | null;
  /** Past terms the user has data in — powers the global term picker in Settings. */
  archivedTerms: TermCount[];
  /** Term currently being viewed app-wide: null = current, else a past term (read-only). */
  viewTerm: string | null;
  setViewTerm: (term: string | null) => void;
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
  isPro: false,
  currentTerm: null,
  archivedTerms: [],
  viewTerm: null,
  setViewTerm: () => {},
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
  const [isPro, setIsPro] = useState(false);
  const [currentTerm, setCurrentTerm] = useState<string | null>(null);
  const [archivedTerms, setArchivedTerms] = useState<TermCount[]>([]);
  // App-wide "which term am I viewing" — set from the Settings picker, read by
  // every logging page. In-memory only, so it resets to the current term on a
  // full reload (a safe default — you can't get stuck in an archived view).
  const [viewTerm, setViewTerm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setEmail(user?.email ?? "");
    setUserId(user?.id ?? null);
    if (user) {
      const { data } = await supabase.from("profiles").select("name, is_pro, year").eq("id", user.id).single();
      setName(data?.name ?? "");
      setIsPro(!!data?.is_pro);
      const yr = (data?.year as string) ?? null;
      setCurrentTerm(yr);
      const { data: days } = await supabase.from("study_days").select("day").eq("user_id", user.id);
      setStudyDays((days ?? []).map((r) => r.day as string));
      const { data: termRows } = await supabase.rpc("user_terms");
      setArchivedTerms(allArchivedTerms((termRows as TermRow[]) ?? [], yr));
    } else {
      setName("");
      setIsPro(false);
      setStudyDays([]);
      setCurrentTerm(null);
      setArchivedTerms([]);
      setViewTerm(null);
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
    <Ctx.Provider value={{ name, email, initials, studyDays, streak, best, level, isPro, currentTerm, archivedTerms, viewTerm, setViewTerm, loading, refresh, recordActivity }}>
      {children}
    </Ctx.Provider>
  );
}

export function useProfile() {
  return useContext(Ctx);
}
