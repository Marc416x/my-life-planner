"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Telescope, Flag, Trophy, Sparkles, Target, Plus, Pencil, Trash2, Check, X,
  Star, GraduationCap, Stethoscope, Award, Heart, HeartPulse, Plane, Globe,
  Building2, Baby, Briefcase, MapPin, BookOpen, Users, Syringe, Mountain, Sun,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { useCollapsibleForm } from "@/lib/use-collapsible-form";
import { DetailSheet, DetailRow } from "@/components/detail-sheet";
import { PageHeader, Card, Field, Input, Select, Textarea, Button, EmptyState, Badge } from "@/components/kit";

// ------------------------------------------------------------------
// Long Term Vision (see migration 0017). The "bigger picture" page:
//   • a free-text vision statement (profiles.vision_statement), autosaved;
//   • a UNIFIED list of aspirations (vision_items) shown two ways —
//       kind='milestone' → a dated Done/Active/Future career timeline;
//       kind='dream'      → an icon+tone Dream-Board card.
// One table, one add/edit form that specialises by kind (the Trackers idea).
// LONG-TERM by design → term-agnostic: the same picture in every term view.
// ------------------------------------------------------------------

type Kind = "milestone" | "dream";
type Status = "done" | "active" | "future";
type Tone = "terracotta" | "olive" | "ochre" | "forest";

type VisionItem = {
  id: string;
  kind: Kind;
  title: string;
  target_year: number | null;
  status: Status;
  note: string | null;
  tone: Tone;
  icon: string;
  sort_order: number;
};

const COLS = "id, kind, title, target_year, status, note, tone, icon, sort_order";

// Curated icon set the dream picker offers; items store the string name.
const ICONS: Record<string, LucideIcon> = {
  Star, Stethoscope, GraduationCap, Award, Trophy, Heart, HeartPulse, Target,
  Sparkles, Briefcase, Building2, Globe, Plane, MapPin, Mountain, Sun,
  Baby, Users, BookOpen, Syringe,
};
const ICON_NAMES = Object.keys(ICONS);
const iconOf = (name: string): LucideIcon => ICONS[name] ?? Star;

const TONES: Tone[] = ["terracotta", "olive", "ochre", "forest"];

// Milestone status → its dot colour, badge tone and label. `done` reads as an
// achievement (green/forest); `active` is the one you're chasing now.
const STATUS: Record<Status, { label: string; tone: Tone; badge: Tone | "neutral" }> = {
  done: { label: "Achieved", tone: "forest", badge: "forest" },
  active: { label: "In progress", tone: "terracotta", badge: "terracotta" },
  future: { label: "Future", tone: "olive", badge: "neutral" },
};

// Blank-page nudges — one tap prefills the milestone form (the Trackers
// quick-add ethos). Never written until the user actually saves.
const STARTERS = ["Complete nursing degree", "Pass the NCLEX-RN", "Land my first RN role", "Specialise in a field I love"];

const thisYear = new Date().getFullYear();

export default function VisionPage() {
  const supabase = createClient();
  const toast = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<VisionItem[]>([]);

  // Vision statement (autosaved on blur).
  const [statement, setStatement] = useState("");
  const savedStatement = useRef("");
  const [statementSaved, setStatementSaved] = useState(false);

  // Dream detail sheet.
  const [detail, setDetail] = useState<VisionItem | null>(null);

  // Shared collapsible add/edit form (specialises by kind).
  const { open: formOpen, formRef, openForm, closeForm, scrollFormIntoView } = useCollapsibleForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fKind, setFKind] = useState<Kind>("milestone");
  const [fTitle, setFTitle] = useState("");
  const [fYear, setFYear] = useState("");
  const [fStatus, setFStatus] = useState<Status>("active");
  const [fNote, setFNote] = useState("");
  const [fTone, setFTone] = useState<Tone>("terracotta");
  const [fIcon, setFIcon] = useState("Star");
  const [formError, setFormError] = useState("");

  const pendingDelete = useRef<Map<string, { item: VisionItem; timeout: number }>>(new Map());

  // ---- Derived views ----
  // Milestones read as a timeline: soonest target first, undated ("someday") last.
  const milestones = useMemo(
    () =>
      items
        .filter((i) => i.kind === "milestone")
        .sort((a, b) => {
          const ay = a.target_year ?? Infinity;
          const by = b.target_year ?? Infinity;
          return ay !== by ? ay - by : a.sort_order - b.sort_order;
        }),
    [items],
  );
  const dreams = useMemo(
    () => items.filter((i) => i.kind === "dream").sort((a, b) => a.sort_order - b.sort_order),
    [items],
  );

  // ---- Initial load ----
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles").select("vision_statement").eq("id", user.id).single();
      const s = (profile?.vision_statement as string) ?? "";
      setStatement(s);
      savedStatement.current = s;

      const { data: rows } = await supabase
        .from("vision_items").select(COLS).order("sort_order", { ascending: true });
      setItems((rows as VisionItem[]) ?? []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Vision statement ----
  async function saveStatement() {
    if (!userId || statement === savedStatement.current) return;
    savedStatement.current = statement;
    const { error } = await supabase
      .from("profiles").update({ vision_statement: statement }).eq("id", userId);
    if (error) { toast.show("Couldn't save your statement — please try again."); return; }
    setStatementSaved(true);
    window.setTimeout(() => setStatementSaved(false), 2200);
  }

  // ---- Add / edit form ----
  function resetForm() {
    setEditingId(null);
    setFormError("");
    setFTitle("");
    setFYear("");
    setFStatus("active");
    setFNote("");
    setFTone("terracotta");
    setFIcon("Star");
  }

  function openAdd(kind: Kind, title = "") {
    resetForm();
    setFKind(kind);
    setFTitle(title);
    setDetail(null);
    if (!formOpen) openForm();
    else scrollFormIntoView();
  }

  function openEdit(item: VisionItem) {
    setEditingId(item.id);
    setFormError("");
    setFKind(item.kind);
    setFTitle(item.title);
    setFYear(item.target_year != null ? String(item.target_year) : "");
    setFStatus(item.status);
    setFNote(item.note ?? "");
    setFTone(item.tone);
    setFIcon(item.icon);
    setDetail(null);
    if (!formOpen) openForm();
    else scrollFormIntoView();
  }

  async function saveForm() {
    if (!userId) return;
    if (!fTitle.trim()) { setFormError(fKind === "dream" ? "Give your dream a name." : "Give your milestone a title."); return; }
    let target_year: number | null = null;
    if (fYear.trim() !== "") {
      const y = Number(fYear);
      if (!Number.isInteger(y) || y < 1900 || y > 2200) { setFormError("Enter a target year like 2028."); return; }
      target_year = y;
    }
    setFormError("");

    const patch = {
      kind: fKind,
      title: fTitle.trim(),
      target_year,
      // Dreams default to 'future'; their "achieved" toggle lives in the detail sheet.
      status: fKind === "milestone" ? fStatus : (editingId ? fStatus : "future"),
      note: fNote.trim() || null,
      tone: fTone,
      icon: fIcon,
    };

    if (editingId) {
      const { data, error } = await supabase
        .from("vision_items").update(patch).eq("id", editingId).select(COLS).single();
      if (error || !data) { setFormError("Couldn't save — please try again."); return; }
      setItems((xs) => xs.map((x) => (x.id === editingId ? (data as VisionItem) : x)));
      resetForm();
      closeForm();
      return;
    }

    const sort_order = items
      .filter((i) => i.kind === fKind)
      .reduce((m, i) => Math.max(m, i.sort_order), -1) + 1;
    const { data, error } = await supabase
      .from("vision_items").insert({ user_id: userId, ...patch, sort_order }).select(COLS).single();
    if (error || !data) { setFormError("Couldn't add — please try again."); return; }
    setItems((xs) => [...xs, data as VisionItem]);
    resetForm();
    scrollFormIntoView();
  }

  // ---- Quick status change (tap a milestone dot / toggle a dream) ----
  async function setStatus(item: VisionItem, status: Status) {
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, status } : x)));
    setDetail((d) => (d && d.id === item.id ? { ...d, status } : d));
    const { error } = await supabase.from("vision_items").update({ status }).eq("id", item.id);
    if (error) {
      setItems((xs) => xs.map((x) => (x.id === item.id ? item : x)));
      toast.show("Couldn't update — please try again.");
    }
  }

  // ---- Delete (optimistic, undoable) ----
  function requestDelete(item: VisionItem) {
    setDetail(null);
    setItems((xs) => xs.filter((x) => x.id !== item.id));
    const timeout = window.setTimeout(async () => {
      pendingDelete.current.delete(item.id);
      await supabase.from("vision_items").delete().eq("id", item.id);
    }, 5000);
    pendingDelete.current.set(item.id, { item, timeout });
    toast.show(`"${item.title}" deleted`, {
      actionLabel: "Undo",
      duration: 5000,
      onAction: () => {
        const p = pendingDelete.current.get(item.id);
        if (!p) return;
        clearTimeout(p.timeout);
        pendingDelete.current.delete(item.id);
        setItems((xs) => [...xs, p.item]);
      },
    });
  }

  // ---- Timeline row ----
  function MilestoneRow({ item, last }: { item: VisionItem; last: boolean }) {
    const meta = STATUS[item.status];
    const done = item.status === "done";
    return (
      <div style={{ display: "flex", gap: "0.85rem" }}>
        {/* Rail: a tappable status dot + the connecting line. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <button
            onClick={() => setStatus(item, done ? "active" : "done")}
            aria-label={done ? `Mark "${item.title}" as in progress` : `Mark "${item.title}" achieved`}
            title={done ? "Achieved — tap to reopen" : "Tap to mark achieved"}
            style={{
              width: 22, height: 22, borderRadius: "50%", cursor: "pointer", marginTop: 2,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: item.status === "future" ? "transparent" : `var(--${meta.tone})`,
              border: item.status === "future" ? "2px dashed var(--border-strong, var(--border))" : `2px solid var(--${meta.tone})`,
              color: "#fff", flexShrink: 0,
            }}
          >
            {done && <Check size={13} strokeWidth={3} />}
          </button>
          {!last && <div style={{ flex: 1, width: 2, background: "var(--border)", marginTop: 4, minHeight: 18 }} />}
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : "1.15rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: "0.92rem", textDecoration: done ? "line-through" : "none", color: done ? "var(--text-muted)" : "var(--text-primary, var(--text))" }}>
                  {item.title}
                </span>
                <Badge tone={meta.badge}>{meta.label}</Badge>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                {item.target_year != null ? `Target ${item.target_year}` : "Someday"}
                {item.note ? ` · ${item.note}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
              <Button size="sm" variant="ghost" iconOnly aria-label={`Edit ${item.title}`} onClick={() => openEdit(item)}><Pencil size={14} /></Button>
              <Button size="sm" variant="ghost" iconOnly aria-label={`Delete ${item.title}`} onClick={() => requestDelete(item)}><Trash2 size={14} /></Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Dream tile ----
  function DreamTile({ item }: { item: VisionItem }) {
    const Icon = iconOf(item.icon);
    const done = item.status === "done";
    return (
      <button
        onClick={() => setDetail(item)}
        style={{
          position: "relative", background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--s-radius-sm)", padding: "1.1rem 0.85rem", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "0.55rem",
          textAlign: "center", minHeight: 150,
        }}
      >
        {done && (
          <span style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: "50%", background: "var(--forest)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={12} strokeWidth={3} />
          </span>
        )}
        <span style={{ width: 46, height: 46, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `var(--${item.tone}-light)`, color: `var(--${item.tone})` }}>
          <Icon size={24} />
        </span>
        <span style={{ fontWeight: 600, fontSize: "0.88rem", lineHeight: 1.25, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</span>
        {item.target_year != null && (
          <span style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.25rem", fontWeight: 700, lineHeight: 1, color: `var(--${item.tone})` }}>{item.target_year}</span>
        )}
      </button>
    );
  }

  const addDreamTile = (
    <button
      onClick={() => openAdd("dream")}
      aria-label="Add a dream"
      style={{
        background: "transparent", border: "2px dashed var(--border-strong, var(--border))",
        borderRadius: "var(--s-radius-sm)", padding: "1.1rem 0.85rem", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: "0.5rem", color: "var(--text-muted)", minHeight: 150,
      }}
    >
      <Plus size={22} />
      <span style={{ fontSize: "0.8rem" }}>Add dream</span>
    </button>
  );

  const showingDream = fKind === "dream";

  return (
    <div className="page active">
      <PageHeader
        icon={<Telescope size={22} />}
        title="Long Term Vision"
        subtitle="See the bigger picture — the nurse you're becoming, and the milestones on the way."
      />

      {/* CAREER GOALS + VISION STATEMENT — two-up, like the original.
          The row stretches both cards to equal height; the statement's textarea
          flexes to fill, so the two stay matched whether the goals list is
          empty, short or long (no awkward height mismatch). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ marginBottom: "1.5rem" }}>
        {/* MILESTONES TIMELINE */}
        <Card
          title="Career Goals"
          icon={<Flag size={20} />}
          subtitle="Your milestones, in order — tap a dot to mark one achieved."
          action={<span className="k-desktop-only"><Button variant="outline" size="sm" onClick={() => openAdd("milestone")}><Plus size={15} /> Add</Button></span>}
        >
          {loading ? (
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "0.5rem", fontStyle: "italic" }}>Loading…</div>
          ) : milestones.length === 0 ? (
            <EmptyState
              icon={<Flag size={26} />}
              title="No goals yet"
              description="Map out the big moments of your nursing journey — degree, NCLEX, first job, specialty."
              action={
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
                  {STARTERS.map((s) => (
                    <Button key={s} size="sm" variant="ghost" onClick={() => openAdd("milestone", s)}><Plus size={14} /> {s}</Button>
                  ))}
                </div>
              }
            />
          ) : (
            <div style={{ marginTop: "0.25rem" }}>
              {milestones.map((m, i) => (
                <MilestoneRow key={m.id} item={m} last={i === milestones.length - 1} />
              ))}
            </div>
          )}
          {/* Mobile add */}
          <div className="k-mobile-only" style={{ marginTop: milestones.length ? "1rem" : 0 }}>
            <Button variant="outline" size="sm" block onClick={() => openAdd("milestone")}><Plus size={15} /> Add goal</Button>
          </div>
        </Card>

        {/* VISION STATEMENT */}
        <Card
          title="What I want to accomplish"
          icon={<Target size={20} />}
          subtitle="Where do you see yourself in 5, 10, 20 years?"
          action={statementSaved ? <span style={{ fontSize: "0.72rem", color: "var(--forest)", display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={13} /> Saved</span> : undefined}
          style={{ display: "flex", flexDirection: "column" }}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <Textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              onBlur={saveStatement}
              placeholder="Describe your ultimate nursing vision — what kind of nurse do you want to be, and what impact do you want to have?"
              rows={7}
              style={{ width: "100%", flex: 1, minHeight: 160, resize: "vertical", fontSize: "0.95rem" }}
              aria-label="Vision statement"
            />
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>Autosaves when you click away.</div>
          </div>
        </Card>
      </div>

      {/* DREAM BOARD */}
      <Card title="Dream Board" icon={<Sparkles size={20} />} subtitle="The life you're working toward — one card per dream." style={{ marginBottom: "1.5rem" }}>
        {!loading && dreams.length === 0 && (
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 0.9rem" }}>
            Add a dream to picture where all this is heading — an ICU role, a master&apos;s degree, travel nursing.
          </p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.85rem" }}>
          {dreams.map((d) => <DreamTile key={d.id} item={d} />)}
          {!loading && addDreamTile}
        </div>
      </Card>

      {/* SHARED ADD / EDIT FORM (specialises by kind) */}
      {formOpen && (
        <div ref={formRef} style={{ scrollMarginTop: "1rem", marginBottom: "1.5rem" }}>
          <Card title={`${editingId ? "Edit" : "Add"} ${showingDream ? "dream" : "milestone"}`} icon={showingDream ? <Sparkles size={20} /> : <Flag size={20} />}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
              <Field label={showingDream ? "Dream" : "Milestone"} htmlFor="vi-title">
                <Input id="vi-title" value={fTitle} onChange={(e) => { setFTitle(e.target.value); if (formError) setFormError(""); }} placeholder={showingDream ? "e.g., ICU Nurse" : "e.g., Pass the NCLEX-RN"} />
              </Field>
              <Field label="Target year" htmlFor="vi-year" hint="Optional">
                <Input id="vi-year" type="number" inputMode="numeric" min={1900} max={2200} value={fYear} onChange={(e) => setFYear(e.target.value)} placeholder={String(thisYear + 2)} />
              </Field>
              {!showingDream && (
                <Field label="Status" htmlFor="vi-status">
                  <Select id="vi-status" value={fStatus} onChange={(e) => setFStatus(e.target.value as Status)}>
                    <option value="active">In progress</option>
                    <option value="future">Future</option>
                    <option value="done">Achieved</option>
                  </Select>
                </Field>
              )}
            </div>

            <Field label={showingDream ? "Note (optional)" : "Detail (optional)"} htmlFor="vi-note">
              <Textarea id="vi-note" value={fNote} onChange={(e) => setFNote(e.target.value)} rows={2} placeholder={showingDream ? "Why this matters to you…" : "e.g., after graduation, once I've done a med-surg year"} style={{ width: "100%", resize: "vertical" }} />
            </Field>

            {showingDream && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", marginTop: "0.9rem" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>Colour</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {TONES.map((tone) => (
                      <button key={tone} onClick={() => setFTone(tone)} aria-label={tone}
                        style={{ width: 28, height: 28, borderRadius: "50%", cursor: "pointer", background: `var(--${tone})`, border: fTone === tone ? "2px solid var(--text-primary, var(--text))" : "2px solid transparent", outline: "1px solid var(--border)" }} />
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>Icon</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxWidth: 360 }}>
                    {ICON_NAMES.map((name) => {
                      const Icon = iconOf(name);
                      const on = fIcon === name;
                      return (
                        <button key={name} onClick={() => setFIcon(name)} aria-label={name}
                          style={{ width: 30, height: 30, borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", background: on ? `var(--${fTone}-light)` : "var(--bg-card)", color: on ? `var(--${fTone})` : "var(--text-muted)", border: `1px solid ${on ? `var(--${fTone})` : "var(--border)"}` }}>
                          <Icon size={15} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "1.1rem" }}>
              <Button onClick={(e) => { e.currentTarget.blur(); saveForm(); }}>{editingId ? "Save changes" : `Add ${showingDream ? "dream" : "milestone"}`}</Button>
              <Button variant="outline" onClick={() => { closeForm(); resetForm(); }}>Cancel</Button>
              {formError && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem" }}>{formError}</span>}
            </div>
          </Card>
        </div>
      )}

      {/* DREAM DETAIL SHEET */}
      <DetailSheet open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }} title={detail?.title ?? ""}>
        {detail && (() => {
          const Icon = iconOf(detail.icon);
          const done = detail.status === "done";
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ width: 52, height: 52, borderRadius: 13, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `var(--${detail.tone}-light)`, color: `var(--${detail.tone})` }}>
                  <Icon size={26} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{detail.title}</div>
                  {detail.target_year != null && <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Target {detail.target_year}</div>}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <DetailRow label="Status">{STATUS[detail.status].label}</DetailRow>
                <DetailRow label="Target year">{detail.target_year != null ? detail.target_year : "Someday"}</DetailRow>
              </div>
              {detail.note && <DetailRow label="Note">{detail.note}</DetailRow>}

              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                <Button size="sm" variant={done ? "outline" : "primary"} onClick={() => setStatus(detail, done ? "future" : "done")}>
                  {done ? <><X size={14} /> Reopen</> : <><Check size={14} /> Mark achieved</>}
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(detail)}><Pencil size={13} /> Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => requestDelete(detail)}><Trash2 size={13} /> Delete</Button>
              </div>
            </div>
          );
        })()}
      </DetailSheet>
    </div>
  );
}
