// Shared logic for the term archive (Study, Error Log, Clinicals).
//
// A row belongs to the CURRENT term when its `term` is the profile's current
// year, OR is null (legacy/unstamped), OR is the reserved SEED demo sentinel.
// Any other distinct non-null term is an ARCHIVED (past) term — read-only and
// gated behind Pro. See migration 0015_term_archive.sql, which mirrors this rule
// server-side in the roll-up RPCs.

/** Reserved term stamp for demo/seed rows — always treated as current, never archived. */
export const SEED_TERM = "SEED";

export type TermCount = { term: string; cnt: number };

/** A row from the `user_terms()` RPC. */
export type TermRow = { source: string; term: string; cnt: number };

/**
 * Build the PostgREST `.or(...)` expression that matches the current term:
 * `term is null OR term = 'SEED' OR term = '<currentTerm>'`.
 */
export function currentTermOr(currentTerm: string | null): string {
  const parts = ["term.is.null", `term.eq.${SEED_TERM}`];
  if (currentTerm) parts.push(`term.eq.${currentTerm}`);
  return parts.join(",");
}

/** Minimal, flat view of the Supabase filter builder methods we chain onto. */
type Scopeable = {
  or(filters: string): unknown;
  eq(column: string, value: string): unknown;
};

/**
 * Narrow a query to a term scope: `scope === null` → the current term (the OR
 * above), otherwise exactly that archived term. Returns the same builder so it
 * stays chainable and awaitable.
 *
 * Q is intentionally *unconstrained*: constraining it to the builder shape makes
 * TS structurally compare against PostgREST's deeply-recursive builder type and
 * bail with "excessively deep" (TS2589). Q is still inferred as the concrete
 * builder at each call site, so the awaited result keeps its `.data`/`.count`.
 */
export function applyTermScope<Q>(q: Q, scope: string | null, currentTerm: string | null): Q {
  const b = q as Scopeable;
  return (scope ? b.eq("term", scope) : b.or(currentTermOr(currentTerm))) as Q;
}

/**
 * From the `user_terms()` rows for one source, the archived terms only —
 * excluding the current term, the SEED sentinel, and nulls — newest first
 * (terms sort lexically, which keeps "Year 3" ahead of "Year 1").
 */
export function archivedTermsFor(rows: TermRow[], source: string, currentTerm: string | null): TermCount[] {
  return rows
    .filter((r) => r.source === source && r.term && r.term !== SEED_TERM && r.term !== currentTerm)
    .map((r) => ({ term: r.term, cnt: Number(r.cnt) }))
    .sort((a, b) => b.term.localeCompare(a.term));
}

/**
 * The archived terms across *every* source, deduped (counts summed) — for the
 * single global term picker in Settings. Current term + SEED + nulls excluded;
 * newest first.
 */
export function allArchivedTerms(rows: TermRow[], currentTerm: string | null): TermCount[] {
  const byTerm = new Map<string, number>();
  for (const r of rows) {
    if (!r.term || r.term === SEED_TERM || r.term === currentTerm) continue;
    byTerm.set(r.term, (byTerm.get(r.term) ?? 0) + Number(r.cnt));
  }
  return [...byTerm.entries()]
    .map(([term, cnt]) => ({ term, cnt }))
    .sort((a, b) => b.term.localeCompare(a.term));
}
