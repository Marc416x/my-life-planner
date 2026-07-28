// Shared profile model used by BOTH the setup wizard (/onboarding) and Settings.
// One source of truth for the fields, their options, and load/save — so the two
// surfaces can never drift apart.
import { createClient } from "@/lib/supabase/client";

type SupaClient = ReturnType<typeof createClient>;

export type StyleValue = "soft" | "balanced" | "bold";

export type ProfileFields = {
  name: string;
  year: string;
  style: StyleValue;
  daily_goal: number;
  weekly_goal: number;
  sleep_goal: number;
  water_goal: number;
  timezone: string;
};

export const YEAR_OPTIONS = [
  "Year 1",
  "Year 2",
  "Year 3",
  "Year 4",
  "Postgraduate",
] as const;

// The three "personalities". `value` is stored in profiles.gender (legacy column
// name); the visual differences live in the --s-* tokens keyed on .style-<value>.
export const STYLE_OPTIONS: { value: StyleValue; name: string; tag: string }[] = [
  { value: "soft", name: "Soft", tag: "Rounded & airy" },
  { value: "balanced", name: "Balanced", tag: "Warm middle-ground" },
  { value: "bold", name: "Bold", tag: "Sharp & structured" },
];

export const GOAL_FIELDS: {
  key: "daily_goal" | "weekly_goal" | "sleep_goal" | "water_goal";
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}[] = [
  { key: "daily_goal", label: "Daily study tasks", min: 1, max: 20, step: 1, unit: "tasks" },
  { key: "weekly_goal", label: "Weekly study goal", min: 1, max: 100, step: 1, unit: "tasks" },
  { key: "sleep_goal", label: "Sleep goal", min: 4, max: 12, step: 0.5, unit: "hrs" },
  { key: "water_goal", label: "Water goal", min: 1, max: 20, step: 1, unit: "glasses" },
];

// Map any stored value (incl. the old female/male/neutral) to a StyleValue.
export function normalizeStyle(v: string | null | undefined): StyleValue {
  if (v === "soft" || v === "balanced" || v === "bold") return v;
  if (v === "male") return "bold";
  if (v === "neutral") return "balanced";
  if (v === "female") return "soft";
  return "balanced";
}

export function styleClass(style: StyleValue): string {
  return `style-${style}`;
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const FALLBACK_TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Toronto", "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "Africa/Lagos", "Africa/Cairo", "Africa/Johannesburg", "Asia/Dubai", "Asia/Kolkata",
  "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney",
];

export function allTimezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  if (typeof intl.supportedValuesOf === "function") {
    try {
      return intl.supportedValuesOf("timeZone");
    } catch {
      // fall through
    }
  }
  return FALLBACK_TIMEZONES;
}

export const DEFAULT_PROFILE_FIELDS: ProfileFields = {
  name: "",
  year: "Year 1",
  style: "balanced",
  daily_goal: 3,
  weekly_goal: 21,
  sleep_goal: 8,
  water_goal: 8,
  timezone: "UTC",
};

export async function loadProfileFields(supabase: SupaClient, userId: string): Promise<ProfileFields> {
  const { data } = await supabase
    .from("profiles")
    .select("name, year, gender, daily_goal, weekly_goal, sleep_goal, water_goal, timezone")
    .eq("id", userId)
    .single();
  return {
    name: data?.name ?? "",
    year: data?.year ?? DEFAULT_PROFILE_FIELDS.year,
    style: normalizeStyle(data?.gender),
    daily_goal: data?.daily_goal ?? DEFAULT_PROFILE_FIELDS.daily_goal,
    weekly_goal: data?.weekly_goal ?? DEFAULT_PROFILE_FIELDS.weekly_goal,
    sleep_goal: Number(data?.sleep_goal ?? DEFAULT_PROFILE_FIELDS.sleep_goal),
    water_goal: data?.water_goal ?? DEFAULT_PROFILE_FIELDS.water_goal,
    // Stored timezone wins; otherwise detect from the browser.
    timezone: data?.timezone || detectTimezone(),
  };
}

export async function saveProfileFields(
  supabase: SupaClient,
  userId: string,
  f: ProfileFields,
  opts?: { onboarded?: boolean },
) {
  const patch: Record<string, unknown> = {
    name: f.name.trim() || "Student",
    year: f.year,
    gender: f.style,
    daily_goal: f.daily_goal,
    weekly_goal: f.weekly_goal,
    sleep_goal: f.sleep_goal,
    water_goal: f.water_goal,
    timezone: f.timezone,
    updated_at: new Date().toISOString(),
  };
  if (opts?.onboarded !== undefined) patch.onboarded = opts.onboarded;
  return supabase.from("profiles").update(patch).eq("id", userId);
}
