// Client helpers for `planner_notes` (migration 0020) — the Calendar's own
// writing surfaces: yearly objectives, "things not to repeat", daily gratitude,
// the daily journal and the weekly reflection.
//
// One table, five kinds, differing only in scope and cardinality. This module
// owns the day → `period_date` mapping so the client can never disagree with
// what's stored: get the period wrong and you'd write a note nobody can read back.

import { createClient } from "./supabase/client";
import { toISO } from "./group-by-date";

// The exact client type, not a hand-rolled structural one: PostgREST's builder
// types are deeply recursive, and making TS structurally match them blows up with
// TS2589 ("excessively deep"). Same reason src/lib/term.ts keeps its query
// generic unconstrained; same shape as src/lib/profile.ts.
type SupaClient = ReturnType<typeof createClient>;

export type NoteKind = "journal" | "reflection" | "gratitude" | "objective" | "avoid";

/** Which period a kind is addressed by. Mirrors the table comment in 0020. */
const KIND_SCOPE: Record<NoteKind, "day" | "week" | "year"> = {
  journal: "day",
  reflection: "week",
  gratitude: "day",
  objective: "year",
  avoid: "year",
};

export type PlannerNote = {
  id: string;
  kind: NoteKind;
  period_date: string;
  body: string;
  done: boolean;
  sort_order: number;
};

/**
 * The `period_date` a note about `date` belongs to, for `kind`:
 * day → that day, week → its Monday, year → Jan 1. Always local, never UTC —
 * a UTC round-trip would file late-evening notes under tomorrow.
 */
export function periodFor(kind: NoteKind, date: Date): string {
  const scope = KIND_SCOPE[kind];
  if (scope === "year") return toISO(new Date(date.getFullYear(), 0, 1));
  if (scope === "week") {
    const m = new Date(date);
    m.setHours(0, 0, 0, 0);
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); // back to Monday
    return toISO(m);
  }
  return toISO(date);
}

const COLS = "id, kind, period_date, body, done, sort_order";

/**
 * Every note across the given kinds and periods, in one round trip — the page
 * needs several kinds at once (a day's journal + gratitude, a year's objectives
 * + anti-goals), and one `in`/`in` query beats five separate ones.
 */
export async function fetchNotes(
  supabase: SupaClient,
  kinds: NoteKind[],
  periods: string[],
): Promise<PlannerNote[]> {
  if (!kinds.length || !periods.length) return [];
  const { data } = await supabase
    .from("planner_notes")
    .select(COLS)
    .in("kind", kinds)
    .in("period_date", [...new Set(periods)])
    .order("sort_order", { ascending: true });
  return data ?? [];
}

/** Append a list-kind note (gratitude / objective / avoid). Returns the new row. */
export async function addNote(
  supabase: SupaClient,
  userId: string,
  kind: NoteKind,
  period: string,
  body: string,
  sortOrder: number,
): Promise<PlannerNote | null> {
  const { data, error } = await supabase
    .from("planner_notes")
    .insert({ user_id: userId, kind, period_date: period, body, sort_order: sortOrder })
    .select(COLS)
    .single();
  return error ? null : data;
}

/**
 * Save a singleton note (journal / reflection) — update the period's row, or
 * insert it if this is the first save. Returns true on success; the caller must
 * not claim "Saved" otherwise.
 *
 * Deliberately NOT `.upsert(…, { onConflict })`: the uniqueness for these kinds
 * comes from a PARTIAL unique index (0020), and Postgres only accepts a partial
 * index for ON CONFLICT when the statement repeats the index predicate — which
 * PostgREST's `on_conflict` can't express. Update-then-insert is the portable
 * equivalent, and the index still blocks a duplicate if two saves ever race.
 * RLS scopes both statements to the signed-in user.
 */
export async function saveSingleton(
  supabase: SupaClient,
  userId: string,
  kind: "journal" | "reflection",
  period: string,
  body: string,
): Promise<boolean> {
  const { data: updated, error: updateError } = await supabase
    .from("planner_notes")
    .update({ body })
    .eq("kind", kind)
    .eq("period_date", period)
    .select("id");
  if (updateError) return false;
  if (updated && updated.length) return true;

  const { error } = await supabase
    .from("planner_notes")
    .insert({ user_id: userId, kind, period_date: period, body });
  return !error;
}

/** Toggle a note's `done` (objectives: achieved; gratitude/avoid: checked off). */
export async function setNoteDone(supabase: SupaClient, id: string, done: boolean): Promise<boolean> {
  const { error } = await supabase.from("planner_notes").update({ done }).eq("id", id);
  return !error;
}

export async function deleteNote(supabase: SupaClient, id: string): Promise<boolean> {
  const { error } = await supabase.from("planner_notes").delete().eq("id", id);
  return !error;
}
