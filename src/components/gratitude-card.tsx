"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, RefreshCw, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dayLabel, toISO } from "@/lib/group-by-date";
import { stableIndex } from "@/lib/affirmations";
import {
  type PlannerNote,
  addNote,
  deleteNote,
  fetchNotes,
  periodFor,
} from "@/lib/planner-notes";
import { useToast } from "@/components/toast-provider";
import { useProfile } from "@/components/profile-provider";

/**
 * Gratitude, as a self-contained card. Currently used by the Calendar's Daily
 * tab; kept as a component (rather than inline JSX) because a daily habit really
 * belongs on the first screen too — surfacing it on the Dashboard is a deliberate
 * later decision, and this is ready for it.
 *
 * Two things make it work as a practice rather than a data-entry chore:
 *
 *  • A ROTATING PROMPT. "Add something you're grateful for" is the hardest
 *    possible ask; a specific question is easy to answer, and varying it stops
 *    the list collapsing into the same two answers forever. Picked
 *    deterministically from the date so it's stable all day and never reshuffles
 *    mid-typing.
 *
 *  • AN ECHO of an earlier entry. A gratitude list you never re-read is
 *    write-only — the benefit of the practice is in the re-reading, not the
 *    typing. This is the payoff the original card had no version of.
 *
 * Logging also counts toward the study streak: the app already rewards showing
 * up, and this is showing up.
 */

const PROMPTS = [
  "Who made today easier?",
  "What went better than you expected?",
  "What did you learn that you'll actually use?",
  "What did your body get you through today?",
  "What small thing would you miss if it vanished?",
  "Which patient, classmate or mentor taught you something?",
  "What did you handle better than you would have last year?",
  "What are you looking forward to tomorrow?",
  "What went right that you didn't have to fix?",
];

/** How many earlier entries to hold for the echo. A nudge, not a history view. */
const ECHO_WINDOW = 40;

export function GratitudeCard({
  date,
  className,
}: {
  /** Day to log against — the Calendar passes its current selection. */
  date: Date;
  className?: string;
}) {
  const supabase = createClient();
  const toast = useToast();
  const { recordActivity } = useProfile();

  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<PlannerNote[]>([]);
  const [past, setPast] = useState<PlannerNote[]>([]);
  const [text, setText] = useState("");
  const [echoNudge, setEchoNudge] = useState(0);
  const pending = useRef(new Map<string, { timeout: number; commit: () => Promise<boolean> }>());

  const dayISO = toISO(date);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush pending deletes on unmount — clearing the timers instead would cancel
  // the delete, so a row you removed then navigated away from would come back.
  useEffect(() => {
    const map = pending.current;
    return () => {
      map.forEach(({ timeout, commit }) => { window.clearTimeout(timeout); void commit(); });
      map.clear();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [today, earlier] = await Promise.all([
        fetchNotes(supabase, ["gratitude"], [dayISO]),
        supabase
          .from("planner_notes")
          .select("id, kind, period_date, body, done, sort_order")
          .eq("kind", "gratitude")
          .lt("period_date", dayISO)
          .order("period_date", { ascending: false })
          .limit(ECHO_WINDOW),
      ]);
      if (cancelled) return;
      setItems(today);
      setPast((earlier.data as PlannerNote[]) ?? []);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayISO]);

  const prompt = PROMPTS[stableIndex(`gratitude:${dayISO}`, PROMPTS.length)];
  const echo = past.length
    ? past[(stableIndex(`echo:${dayISO}`, past.length) + echoNudge) % past.length]
    : null;

  async function add() {
    if (!text.trim()) return;
    if (!userId) { toast.show("Still signing you in — try again in a moment."); return; }
    const row = await addNote(supabase, userId, "gratitude", periodFor("gratitude", date), text.trim(), items.length);
    if (!row) { toast.show("Couldn't save that — please try again."); return; }
    setItems((cur) => [...cur, row]);
    setText("");
    // Showing up counts, same as completing a task or logging a study session.
    void recordActivity();
  }

  function remove(note: PlannerNote) {
    const index = items.findIndex((n) => n.id === note.id);
    if (index < 0) return;
    setItems((cur) => cur.filter((n) => n.id !== note.id));
    const commit = async () => deleteNote(supabase, note.id);
    const timeout = window.setTimeout(async () => {
      pending.current.delete(note.id);
      if (!(await commit())) {
        setItems((cur) => [...cur.slice(0, index), note, ...cur.slice(index)]);
        toast.show("Couldn't delete that — it's back.");
      }
    }, 5000);
    pending.current.set(note.id, { timeout, commit });
    toast.show("Entry deleted", {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = pending.current.get(note.id);
        if (!p) return;
        window.clearTimeout(p.timeout);
        pending.current.delete(note.id);
        setItems((cur) => [...cur.slice(0, index), note, ...cur.slice(index)]);
      },
    });
  }

  return (
    <div className={className ?? "card"}>
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "0.5rem", marginBottom: "0.75rem", minHeight: 26,
        }}
      >
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: 0 }}>
          <Heart size={18} /> Gratitude
        </div>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
          {items.length ? `${items.length} today` : ""}
        </span>
      </div>

      <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.75rem", fontStyle: "italic" }}>
        {prompt}
      </div>

      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
        <input
          className="field-input"
          placeholder="Today I'm grateful for..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          style={{ flex: 1, fontSize: "0.82rem", padding: "0.4rem 0.75rem" }}
        />
        <button className="btn-add" onClick={add} style={{ padding: "0.4rem 0.65rem", fontSize: "0.82rem" }}>+</button>
      </div>

      {items.length ? (
        <div
          style={{
            display: "flex", flexDirection: "column", gap: "0.15rem",
            maxHeight: 220, overflowY: "auto",
          }}
        >
          {items.map((g) => (
            <div className="data-item" key={g.id}>
              <Heart size={14} style={{ color: "var(--terracotta)", flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: "0.85rem", minWidth: 0 }}>{g.body}</span>
              <button
                type="button"
                onClick={() => remove(g)}
                aria-label="Delete"
                title="Delete"
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 2,
                  color: "var(--text-muted)", display: "inline-flex", flexShrink: 0,
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "0.75rem", fontStyle: "italic" }}>
          Nothing yet for this day
        </div>
      )}

      {echo && (
        <div
          style={{
            marginTop: "0.75rem", paddingTop: "0.6rem",
            borderTop: "1px solid var(--border)",
            display: "flex", alignItems: "flex-start", gap: "0.5rem",
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
              {dayLabel(echo.period_date)} you were grateful for
            </span>
            <span style={{ fontSize: "0.85rem", fontStyle: "italic" }}>{echo.body}</span>
          </span>
          <button
            type="button"
            onClick={() => setEchoNudge((n) => n + 1)}
            aria-label="Show another"
            title="Show another"
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 2,
              color: "var(--text-muted)", display: "inline-flex", flexShrink: 0,
            }}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
