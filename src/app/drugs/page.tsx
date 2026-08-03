"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Pill, Brain, Layers, CheckCircle2, CalendarPlus, Plus, Pencil, Trash2,
  Sparkles, Check, X, Eye, Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { useProfile } from "@/components/profile-provider";
import { useCollapsibleForm } from "@/lib/use-collapsible-form";
import { toISODate } from "@/lib/streak";
import { DetailSheet, DetailRow } from "@/components/detail-sheet";
import { ProGate } from "@/components/pro-gate";
import {
  PageHeader, Card, StatCard, Field, Input, Textarea, Button,
  EmptyState, Badge, Progress,
} from "@/components/kit";

// ------------------------------------------------------------------
// Drug Tracker (Premium — see migration 0019). "Two drugs a day keeps the NCLEX
// failure away." A personal pharmacology deck that quizzes you back with SPACED
// REPETITION (a Leitner box scheme) so what you learn actually sticks:
//   • add drug cards (name, class, mechanism, indications, side effects, nursing
//     notes, dose) — the "personal medication library" perk;
//   • a daily review queue of the cards that have come due — reveal, self-grade,
//     and correct recalls get pushed further out (the "spaced-recall quiz" perk);
//   • a class-filtered library (the "class tagging" perk).
//
// TERM-AGNOSTIC (like NCLEX 0018 / Vision 0017): a drug learned in Year 1 is
// knowledge you keep, so cards never archive per term. The deck is small and
// personal, so we hold the full list client-side and aggregate in memory.
// ------------------------------------------------------------------

type Tone = "terracotta" | "olive" | "ochre" | "forest";

type Drug = {
  id: string;
  name: string;
  drug_class: string | null;
  moa: string | null;
  indications: string | null;
  side_effects: string | null;
  nursing: string | null;
  dose: string | null;
  box: number;
  due_date: string;
  last_reviewed: string | null;
  review_count: number;
  correct_count: number;
  learned_on: string;
  created_at: string;
};

const COLS =
  "id, name, drug_class, moa, indications, side_effects, nursing, dose, box, due_date, last_reviewed, review_count, correct_count, learned_on, created_at";

const DEFAULT_GOAL = 2;   // "two drugs a day" — the default daily target
const MASTERED_BOX = 5;   // top Leitner box → the card counts as mastered
// Days until a card is due again after a correct recall lands it in each box
// (index = the box it lands in). Miss → box 0, due tomorrow (handled in grade()).
const BOX_DAYS = [1, 1, 3, 7, 16, 30];

type ContentKey = "moa" | "indications" | "side_effects" | "nursing" | "dose";
// The reference fields shown on a card's back and in its detail sheet, in order.
// (Class is shown separately as a badge, so it isn't repeated here.)
const BODY_FIELDS: { key: ContentKey; label: string }[] = [
  { key: "moa", label: "Mechanism" },
  { key: "indications", label: "Indications" },
  { key: "side_effects", label: "Side effects" },
  { key: "nursing", label: "Nursing considerations" },
  { key: "dose", label: "Dosage / route" },
];

// Common nursing drug classes offered as datalist hints (class stays free text).
const COMMON_CLASSES = [
  "Beta-blocker", "ACE inhibitor", "ARB", "Calcium channel blocker",
  "Loop diuretic", "Thiazide diuretic", "Anticoagulant", "Antiplatelet",
  "Statin", "Opioid analgesic", "NSAID", "Antibiotic", "Corticosteroid",
  "Benzodiazepine", "SSRI", "Proton pump inhibitor", "Bronchodilator",
  "Insulin", "Antiemetic", "Antihistamine",
];

const TONES: Tone[] = ["terracotta", "olive", "ochre", "forest"];

// ---- Date helpers (local-time, ISO strings — never touch UTC parsing) ----
const parseISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const todayISO = () => toISODate(new Date());
const addDays = (iso: string, n: number) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISODate(d); };
const daysFromToday = (iso: string) => Math.round((parseISO(iso).getTime() - parseISO(todayISO()).getTime()) / 86_400_000);

// Stable tone per key so every "Beta-blocker" card shares one colour.
function toneFor(key: string): Tone {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}
const drugTone = (d: Drug): Tone => toneFor((d.drug_class || d.name).toLowerCase());

// Spaced-repetition maturity → badge label + tone.
function maturityOf(d: Drug): { label: string; tone: Tone | "neutral" } {
  if (d.review_count === 0) return { label: "New", tone: "neutral" };
  if (d.box >= MASTERED_BOX) return { label: "Mastered", tone: "forest" };
  if (d.box >= 3) return { label: "Familiar", tone: "olive" };
  return { label: "Learning", tone: "terracotta" };
}

// When the card is next due, in human terms.
function dueLabel(due: string): { text: string; due: boolean } {
  const diff = daysFromToday(due);
  if (diff <= 0) return { text: "Due now", due: true };
  if (diff === 1) return { text: "Review tomorrow", due: false };
  return { text: `Review in ${diff}d`, due: false };
}

export default function DrugsPage() {
  const { isPro, loading: profileLoading } = useProfile();

  const header = (
    <PageHeader
      icon={<Pill size={22} />}
      title="Drug Tracker"
      subtitle="Two drugs a day keeps the NCLEX failure away — build your deck and lock it in with spaced recall."
    />
  );

  // Gate the whole feature (and its data fetching) behind Pro — the child only
  // mounts, and only queries, when the user is Pro.
  return (
    <div className="page active">
      {(profileLoading || !isPro) && header}
      <ProGate
        feature="The Drug Tracker"
        blurb="Build your own drug deck and lock it in with spaced-recall quizzes."
        perks={["Personal medication library", "Spaced-repetition recall quizzes", "Class & interaction tagging"]}
      >
        <DrugTracker />
      </ProGate>
    </div>
  );
}

function DrugTracker() {
  const supabase = createClient();
  const toast = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drugs, setDrugs] = useState<Drug[]>([]);

  // Daily goal (autosaved profile column).
  const [goal, setGoal] = useState("");
  const savedGoal = useRef("");

  // Detail sheet + library class filter.
  const [detail, setDetail] = useState<Drug | null>(null);
  const [classFilter, setClassFilter] = useState<string>("all");

  // Review session: a snapshot of drug IDs to walk through, one at a time.
  const [queue, setQueue] = useState<string[] | null>(null);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [tally, setTally] = useState({ recalled: 0, missed: 0 });
  const reviewRef = useRef<HTMLDivElement>(null);

  // Collapsible add/edit form.
  const { open: formOpen, formRef, openForm, closeForm, scrollFormIntoView } = useCollapsibleForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fName, setFName] = useState("");
  const [fClass, setFClass] = useState("");
  const [fMoa, setFMoa] = useState("");
  const [fIndications, setFIndications] = useState("");
  const [fSide, setFSide] = useState("");
  const [fNursing, setFNursing] = useState("");
  const [fDose, setFDose] = useState("");
  const [formError, setFormError] = useState("");

  const pendingDelete = useRef<Map<string, { drug: Drug; timeout: number }>>(new Map());

  // ---- Initial load ----
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles").select("drug_daily_goal").eq("id", user.id).single();
      const gl = profile?.drug_daily_goal != null ? String(profile.drug_daily_goal) : "";
      setGoal(gl);
      savedGoal.current = gl;

      const { data: rows } = await supabase
        .from("drugs").select(COLS).order("created_at", { ascending: false });
      setDrugs((rows as Drug[]) ?? []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Aggregates ----
  const today = todayISO();
  const dueDrugs = useMemo(
    () =>
      drugs
        .filter((d) => daysFromToday(d.due_date) <= 0)
        .sort((a, b) => (a.due_date !== b.due_date ? (a.due_date < b.due_date ? -1 : 1) : a.box - b.box)),
    [drugs],
  );

  const stats = useMemo(() => {
    const mastered = drugs.filter((d) => d.box >= MASTERED_BOX).length;
    const classes = new Set(drugs.map((d) => d.drug_class?.trim()).filter(Boolean) as string[]);
    const addedToday = drugs.filter((d) => d.learned_on === today).length;
    // Learning streak: consecutive days (ending today, or yesterday if nothing
    // added yet today) on which at least one card was added.
    const learnedDays = new Set(drugs.map((d) => d.learned_on));
    let streak = 0;
    let cursor = learnedDays.has(today) ? today : addDays(today, -1);
    while (learnedDays.has(cursor)) { streak++; cursor = addDays(cursor, -1); }
    return { total: drugs.length, mastered, classes: classes.size, addedToday, streak };
  }, [drugs, today]);

  // Class chips (with counts) for the library filter.
  const classChips = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of drugs) { const c = d.drug_class?.trim(); if (c) m.set(c, (m.get(c) ?? 0) + 1); }
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [drugs]);

  const library = useMemo(
    () => (classFilter === "all" ? drugs : drugs.filter((d) => d.drug_class?.trim() === classFilter)),
    [drugs, classFilter],
  );

  const goalNum = goal.trim() !== "" ? Number(goal) : DEFAULT_GOAL;
  const goalPct = goalNum > 0 ? Math.min(1, stats.addedToday / goalNum) * 100 : 0;
  const goalMet = stats.addedToday >= goalNum;

  // Datalist: the user's own classes first, then common ones they've not used.
  const classOptions = useMemo(() => {
    const seen = new Set(classChips.map((c) => c.name.toLowerCase()));
    return [...classChips.map((c) => c.name), ...COMMON_CLASSES.filter((c) => !seen.has(c.toLowerCase()))];
  }, [classChips]);

  // ---- Daily goal autosave ----
  async function saveGoal() {
    if (!userId || goal === savedGoal.current) return;
    const n = goal.trim() === "" ? null : Number(goal);
    if (n != null && (!Number.isInteger(n) || n <= 0)) { toast.show("Enter a whole number of drugs."); return; }
    savedGoal.current = goal;
    const { error } = await supabase.from("profiles").update({ drug_daily_goal: n }).eq("id", userId);
    if (error) toast.show("Couldn't save your goal — please try again.");
  }

  // ---- Review session ----
  function startReview(list: Drug[]) {
    if (list.length === 0) return;
    setQueue(list.map((d) => d.id));
    setReviewIdx(0);
    setRevealed(false);
    setTally({ recalled: 0, missed: 0 });
    setDetail(null);
  }
  // Bring the review card into view once a session starts (never during render —
  // the ref is only read here, after commit).
  useEffect(() => {
    if (queue !== null) reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [queue]);
  function exitReview() {
    setQueue(null);
    setReviewIdx(0);
    setRevealed(false);
  }

  const currentDrug = queue && reviewIdx < queue.length ? drugs.find((d) => d.id === queue[reviewIdx]) ?? null : null;

  // Self-grade the current card → advance its Leitner state and move on.
  async function grade(correct: boolean) {
    const d = currentDrug;
    if (!d) return;
    const box = correct ? Math.min(d.box + 1, MASTERED_BOX) : 0;
    const due = correct ? addDays(today, BOX_DAYS[box]) : addDays(today, 1);
    const patch = {
      box,
      due_date: due,
      last_reviewed: today,
      review_count: d.review_count + 1,
      correct_count: d.correct_count + (correct ? 1 : 0),
    };
    setDrugs((xs) => xs.map((x) => (x.id === d.id ? { ...x, ...patch } : x)));
    setTally((t) => ({ recalled: t.recalled + (correct ? 1 : 0), missed: t.missed + (correct ? 0 : 1) }));
    setReviewIdx((i) => i + 1);
    setRevealed(false);
    const { error } = await supabase.from("drugs").update(patch).eq("id", d.id);
    if (error) toast.show("Couldn't save that review — it may not stick.");
  }

  // ---- Add / edit form ----
  function resetForm() {
    setEditingId(null);
    setFormError("");
    setFName(""); setFClass(""); setFMoa(""); setFIndications(""); setFSide(""); setFNursing(""); setFDose("");
  }
  function openAdd(prefillClass?: string) {
    resetForm();
    if (prefillClass) setFClass(prefillClass);
    setDetail(null);
    if (!formOpen) openForm();
    else scrollFormIntoView();
  }
  function openEdit(d: Drug) {
    setEditingId(d.id);
    setFormError("");
    setFName(d.name);
    setFClass(d.drug_class ?? "");
    setFMoa(d.moa ?? "");
    setFIndications(d.indications ?? "");
    setFSide(d.side_effects ?? "");
    setFNursing(d.nursing ?? "");
    setFDose(d.dose ?? "");
    setDetail(null);
    if (!formOpen) openForm();
    else scrollFormIntoView();
  }

  async function saveForm() {
    if (!userId) return;
    if (!fName.trim()) { setFormError("Give the drug a name."); return; }
    setFormError("");

    // Content only — editing never disturbs a card's spaced-repetition schedule.
    const content = {
      name: fName.trim(),
      drug_class: fClass.trim() || null,
      moa: fMoa.trim() || null,
      indications: fIndications.trim() || null,
      side_effects: fSide.trim() || null,
      nursing: fNursing.trim() || null,
      dose: fDose.trim() || null,
    };

    if (editingId) {
      const { data, error } = await supabase
        .from("drugs").update(content).eq("id", editingId).select(COLS).single();
      if (error || !data) { setFormError("Couldn't save — please try again."); return; }
      setDrugs((xs) => xs.map((x) => (x.id === editingId ? (data as Drug) : x)));
      setDetail((cur) => (cur && cur.id === editingId ? (data as Drug) : cur));
      resetForm();
      closeForm();
      return;
    }

    // New card: learned today, first review tomorrow (learn now, recall later).
    const { data, error } = await supabase
      .from("drugs")
      .insert({ user_id: userId, ...content, box: 0, learned_on: today, due_date: addDays(today, 1) })
      .select(COLS).single();
    if (error || !data) { setFormError("Couldn't add — please try again."); return; }
    setDrugs((xs) => [data as Drug, ...xs]);
    resetForm();
    scrollFormIntoView();
  }

  // ---- Delete (optimistic, undoable) ----
  function requestDelete(d: Drug) {
    setDetail(null);
    setDrugs((xs) => xs.filter((x) => x.id !== d.id));
    const timeout = window.setTimeout(async () => {
      pendingDelete.current.delete(d.id);
      await supabase.from("drugs").delete().eq("id", d.id);
    }, 5000);
    pendingDelete.current.set(d.id, { drug: d, timeout });
    toast.show(`"${d.name}" removed`, {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = pendingDelete.current.get(d.id);
        if (!p) return;
        clearTimeout(p.timeout);
        pendingDelete.current.delete(d.id);
        setDrugs((xs) => sortByCreated([...xs, p.drug]));
      },
    });
  }

  function sortByCreated(xs: Drug[]) {
    return [...xs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  // ---- Renderers ----
  function DrugTile(d: Drug) {
    const tone = drugTone(d);
    const mat = maturityOf(d);
    const due = dueLabel(d.due_date);
    return (
      <button
        key={d.id}
        onClick={() => setDetail(d)}
        style={{
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--s-radius-sm)",
          padding: "0.85rem", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: "0.6rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `var(--${tone}-light)`, color: `var(--${tone})` }}>
            <Pill size={17} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.drug_class || "Unclassified"}</div>
          </div>
          <Badge tone={mat.tone}>{mat.label}</Badge>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 600, color: due.due ? "var(--terracotta)" : "var(--text-muted)" }}>{due.text}</span>
          <div style={{ flex: 1, maxWidth: 90 }}><Progress tone={tone} value={(d.box / MASTERED_BOX) * 100} /></div>
        </div>
      </button>
    );
  }

  const hasDeck = drugs.length > 0;
  const addBtn = <Button onClick={() => openAdd()}><Plus size={16} /> Add drug</Button>;
  const inSession = queue !== null;
  const sessionDone = queue !== null && reviewIdx >= queue.length;

  return (
    <>
      <PageHeader
        icon={<Pill size={22} />}
        title="Drug Tracker"
        subtitle="Two drugs a day keeps the NCLEX failure away — build your deck and lock it in with spaced recall."
        actions={<span className="k-desktop-only">{addBtn}</span>}
      />

      {loading ? (
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem", fontStyle: "italic", textAlign: "center" }}>Loading…</div>
      ) : (
        <>
          {/* TOP STATS */}
          <div className="k-stats-grid" style={{ marginBottom: "1.5rem" }}>
            <StatCard
              tone={dueDrugs.length > 0 ? "terracotta" : "forest"}
              label="Due to review"
              value={dueDrugs.length}
              sub={dueDrugs.length > 0 ? "cards ready to recall" : hasDeck ? "all caught up" : "add your first card"}
              icon={<Brain size={18} />}
            />
            <StatCard tone="forest" label="Mastered" value={stats.mastered} sub={`of ${stats.total} card${stats.total === 1 ? "" : "s"}`} icon={<CheckCircle2 size={18} />} />
            <StatCard tone="olive" label="In your deck" value={stats.total} sub={`${stats.classes} class${stats.classes === 1 ? "" : "es"}`} icon={<Layers size={18} />} />
            <StatCard
              tone="ochre"
              label="Added today"
              value={`${stats.addedToday}/${goalNum}`}
              sub={stats.streak > 0 ? `🔥 ${stats.streak}-day streak` : "start your streak"}
              icon={<CalendarPlus size={18} />}
            >
              <div style={{ marginTop: "0.6rem" }}><Progress tone={goalMet ? "forest" : "ochre"} value={goalPct} /></div>
            </StatCard>
          </div>

          {/* DAILY GOAL (autosaved) — the "two a day" habit, adjustable */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", margin: "-0.5rem 0 1.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            <Target size={15} style={{ color: "var(--ochre)" }} />
            <span>Daily goal</span>
            <Input
              aria-label="Daily goal (drugs per day)"
              type="number" inputMode="numeric" min={1}
              value={goal} placeholder={String(DEFAULT_GOAL)}
              onChange={(e) => setGoal(e.target.value)} onBlur={saveGoal}
              style={{ width: 68, textAlign: "center" }}
            />
            <span>drug{goalNum === 1 ? "" : "s"} a day</span>
          </div>

          {/* EMPTY DECK → one prompt; otherwise the review + library */}
          {!hasDeck ? (
            <Card>
              <EmptyState
                icon={<Pill size={26} />}
                title="Start your drug deck"
                description="Add a couple of drugs you're studying — name, class, mechanism, side effects, nursing notes — and the tracker will quiz you on them with spaced repetition."
                action={addBtn}
              />
            </Card>
          ) : (
            <>
              {/* DAILY REVIEW (spaced-recall) */}
              <div ref={reviewRef} style={{ scrollMarginTop: "1rem", marginBottom: "1.5rem" }}>
                <Card
                  title="Daily review"
                  icon={<Brain size={20} />}
                  subtitle={inSession ? "Recall it, then reveal to check yourself." : "Spaced repetition brings each card back right before you'd forget it."}
                  action={inSession ? <Button size="sm" variant="ghost" iconOnly aria-label="End review" onClick={exitReview}><X size={16} /></Button> : undefined}
                >
                  {!inSession ? (
                    dueDrugs.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "2.4rem", fontWeight: 700, lineHeight: 1, color: "var(--terracotta)" }}>{dueDrugs.length}</span>
                          <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>card{dueDrugs.length === 1 ? "" : "s"} due right now</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          {dueDrugs.slice(0, 6).map((d) => (
                            <span key={d.id} style={chip(drugTone(d))}>{d.name}</span>
                          ))}
                          {dueDrugs.length > 6 && <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", alignSelf: "center" }}>+{dueDrugs.length - 6} more</span>}
                        </div>
                        <div><Button onClick={() => startReview(dueDrugs)}><Brain size={16} /> Start review</Button></div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "flex-start" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Sparkles size={18} style={{ color: "var(--forest)" }} />
                          <span style={{ fontWeight: 600 }}>All caught up.</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-muted)" }}>
                          Nothing&apos;s due today. {nextDueLine(drugs)}
                        </p>
                        <Button variant="outline" size="sm" onClick={() => startReview([...drugs].sort((a, b) => (a.due_date < b.due_date ? -1 : 1)).slice(0, 20))}>
                          <Eye size={15} /> Review ahead
                        </Button>
                      </div>
                    )
                  ) : sessionDone ? (
                    <div style={{ textAlign: "center", padding: "0.5rem 0 0.25rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem" }}>
                      <span style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--forest-light)", color: "var(--forest)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <Sparkles size={26} />
                      </span>
                      <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.8rem", fontWeight: 700, lineHeight: 1 }}>Review complete!</div>
                      <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                        Recalled <strong style={{ color: "var(--forest)" }}>{tally.recalled}</strong> of {tally.recalled + tally.missed}
                        {tally.missed > 0 ? <> · {tally.missed} back tomorrow</> : <> — every card climbed a box 🎉</>}
                      </p>
                      <Button variant="outline" onClick={exitReview}>Done</Button>
                    </div>
                  ) : currentDrug ? (
                    <ReviewCard drug={currentDrug} idx={reviewIdx} total={queue!.length} revealed={revealed} onReveal={() => setRevealed(true)} onGrade={grade} />
                  ) : null}
                </Card>
              </div>

              {/* LIBRARY */}
              <Card
                title="Drug library"
                icon={<Layers size={20} />}
                subtitle="Your personal deck — tap a card for the full picture."
                style={{ marginBottom: "1.5rem" }}
              >
                {classChips.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
                    <FilterChip label={`All · ${drugs.length}`} active={classFilter === "all"} onClick={() => setClassFilter("all")} />
                    {classChips.map((c) => (
                      <FilterChip key={c.name} label={`${c.name} · ${c.count}`} active={classFilter === c.name} onClick={() => setClassFilter(c.name)} />
                    ))}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.85rem" }}>
                  {library.map(DrugTile)}
                </div>
              </Card>
            </>
          )}

          {/* Mobile add button */}
          {!formOpen && <div className="k-mobile-only k-mobile-add">{addBtn}</div>}

          {/* ADD / EDIT FORM */}
          {formOpen && (
            <div ref={formRef} style={{ scrollMarginTop: "1rem", marginBottom: "1.5rem" }}>
              <Card title={editingId ? "Edit drug" : "Add drug"} icon={<Plus size={20} />}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
                  <Field label="Drug name" htmlFor="d-name">
                    <Input id="d-name" value={fName} onChange={(e) => { setFName(e.target.value); if (formError) setFormError(""); }} placeholder="e.g., Metoprolol" />
                  </Field>
                  <Field label="Class" htmlFor="d-class" hint="Groups & filters your deck">
                    <Input id="d-class" list="drug-classes" value={fClass} onChange={(e) => setFClass(e.target.value)} placeholder="e.g., Beta-blocker" />
                    <datalist id="drug-classes">{classOptions.map((c) => <option key={c} value={c} />)}</datalist>
                  </Field>
                  <Field label="Dosage / route" htmlFor="d-dose" hint="Optional">
                    <Input id="d-dose" value={fDose} onChange={(e) => setFDose(e.target.value)} placeholder="e.g., 25–100mg PO daily" />
                  </Field>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem", marginTop: "0.25rem" }}>
                  <Field label="Mechanism of action" htmlFor="d-moa" hint="Optional">
                    <Textarea id="d-moa" value={fMoa} onChange={(e) => setFMoa(e.target.value)} rows={2} placeholder="How it works at a receptor / cellular level…" style={{ width: "100%", resize: "vertical" }} />
                  </Field>
                  <Field label="Indications" htmlFor="d-ind" hint="Optional">
                    <Textarea id="d-ind" value={fIndications} onChange={(e) => setFIndications(e.target.value)} rows={2} placeholder="What it treats…" style={{ width: "100%", resize: "vertical" }} />
                  </Field>
                  <Field label="Side effects" htmlFor="d-side" hint="Optional">
                    <Textarea id="d-side" value={fSide} onChange={(e) => setFSide(e.target.value)} rows={2} placeholder="Key adverse effects to remember…" style={{ width: "100%", resize: "vertical" }} />
                  </Field>
                  <Field label="Nursing considerations" htmlFor="d-nurse" hint="Optional">
                    <Textarea id="d-nurse" value={fNursing} onChange={(e) => setFNursing(e.target.value)} rows={2} placeholder="What to monitor, contraindications, teaching points…" style={{ width: "100%", resize: "vertical" }} />
                  </Field>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "1rem" }}>
                  <Button onClick={(e) => { e.currentTarget.blur(); saveForm(); }}>{editingId ? "Save changes" : "Add to deck"}</Button>
                  <Button variant="outline" onClick={() => { closeForm(); resetForm(); }}>Cancel</Button>
                  {!editingId && <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>First review lands tomorrow.</span>}
                  {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* DRUG DETAIL SHEET */}
      <DetailSheet open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }} title={detail?.name ?? ""}>
        {detail && (() => {
          const d = detail;
          const tone = drugTone(d);
          const mat = maturityOf(d);
          const recall = d.review_count > 0 ? Math.round((d.correct_count / d.review_count) * 100) : null;
          const due = dueLabel(d.due_date);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `var(--${tone}-light)`, color: `var(--${tone})` }}><Pill size={24} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{d.name}</div>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
                    {d.drug_class && <Badge tone={tone}>{d.drug_class}</Badge>}
                    <Badge tone={mat.tone}>{mat.label}</Badge>
                  </div>
                </div>
              </div>

              {/* Spaced-repetition state */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 4 }}>
                  <span>Mastery · box {d.box}/{MASTERED_BOX}</span>
                  <span style={{ color: due.due ? "var(--terracotta)" : "var(--text-muted)", fontWeight: 600 }}>{due.text}</span>
                </div>
                <Progress tone={tone} value={(d.box / MASTERED_BOX) * 100} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.85rem" }}>
                <DetailRow label="Reviewed">{d.review_count}×</DetailRow>
                <DetailRow label="Recall">{recall == null ? "—" : `${recall}%`}</DetailRow>
                <DetailRow label="Added">{d.learned_on}</DetailRow>
              </div>

              {BODY_FIELDS.some((f) => d[f.key]) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  {BODY_FIELDS.map((f) => d[f.key] ? <DetailRow key={f.key} label={f.label}>{d[f.key]}</DetailRow> : null)}
                </div>
              ) : (
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic", margin: 0 }}>No details yet — edit this card to add its mechanism, side effects and nursing notes.</p>
              )}

              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <Button size="sm" onClick={() => startReview([d])}><Brain size={14} /> Practice</Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(d)}><Pencil size={13} /> Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => requestDelete(d)}><Trash2 size={13} /> Delete</Button>
              </div>
            </div>
          );
        })()}
      </DetailSheet>
    </>
  );
}

// The next-due hint shown when the queue is empty.
function nextDueLine(drugs: Drug[]): string {
  if (drugs.length === 0) return "";
  const next = [...drugs].sort((a, b) => (a.due_date < b.due_date ? -1 : 1))[0];
  const diff = daysFromToday(next.due_date);
  if (diff <= 0) return "";
  return diff === 1 ? "Your next card is due tomorrow." : `Your next card is due in ${diff} days.`;
}

// A single review flashcard: prompt → reveal → self-grade.
function ReviewCard({
  drug, idx, total, revealed, onReveal, onGrade,
}: {
  drug: Drug; idx: number; total: number; revealed: boolean;
  onReveal: () => void; onGrade: (correct: boolean) => void;
}) {
  const tone = drugTone(drug);
  const filled = BODY_FIELDS.filter((f) => drug[f.key]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Progress through the queue */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Card {idx + 1} of {total}</span>
        <div style={{ flex: 1 }}><Progress tone={tone} value={(idx / total) * 100} /></div>
      </div>

      {/* Prompt */}
      <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
        <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "2.3rem", fontWeight: 700, lineHeight: 1.05, color: `var(--${tone})` }}>{drug.name}</div>
        {drug.drug_class && <div style={{ marginTop: "0.35rem" }}><Badge tone={tone}>{drug.drug_class}</Badge></div>}
      </div>

      {!revealed ? (
        <>
          <p style={{ margin: 0, textAlign: "center", fontSize: "0.88rem", color: "var(--text-muted)" }}>
            Recall its mechanism, indications, side effects and nursing considerations — then check yourself.
          </p>
          <Button block onClick={onReveal}><Eye size={16} /> Reveal answer</Button>
        </>
      ) : (
        <>
          <div style={{ background: "var(--bg-main)", border: "1px solid var(--border)", borderRadius: "var(--s-radius-sm)", padding: "0.9rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {filled.length > 0 ? filled.map((f) => (
              <div key={f.key}>
                <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>{drug[f.key]}</div>
              </div>
            )) : (
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>You logged this card with just a name — did you remember what it is?</div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <Button block variant="outline" onClick={() => onGrade(false)}><X size={16} /> Missed it</Button>
            <Button block onClick={() => onGrade(true)}><Check size={16} /> Got it</Button>
          </div>
        </>
      )}
    </div>
  );
}

// Library filter chip (active/inactive pill).
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        cursor: "pointer", padding: "0.3rem 0.7rem", borderRadius: 999, fontSize: "0.76rem", fontWeight: 600, whiteSpace: "nowrap",
        background: active ? "var(--terracotta)" : "var(--bg-card)",
        color: active ? "#fff" : "var(--text-muted)",
        border: `1px solid ${active ? "var(--terracotta)" : "var(--border)"}`,
      }}
    >
      {label}
    </button>
  );
}

// Small pill chip used to preview due cards in the review header.
function chip(tone: Tone): CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "0.28rem 0.6rem", borderRadius: 999, fontSize: "0.76rem", fontWeight: 600,
    background: `var(--${tone}-light)`, color: `var(--${tone})`, border: `1px solid var(--${tone})`,
  };
}
