"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Target,
  Ban,
  BookOpen,
  Zap,
  FileText,
  Save,
  NotebookPen,
  Clock,
  Smile,
  Heart,
  ListChecks,
  CalendarDays,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const cardTitle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "0.45rem" };

type Tab = "yearly" | "monthly" | "weekly" | "daily";

// Static month events (as in the original prototype).
const MONTH_EVENTS: Record<number, { cls: string; txt: string }[]> = {
  7: [{ cls: "evt-exam", txt: "Pharmacology Study" }],
  9: [{ cls: "evt-assign", txt: "Case Study Due" }],
  12: [{ cls: "evt-clinical", txt: "Clinical Ward" }],
  19: [{ cls: "evt-exam", txt: "Mid-Term Exam" }],
};

export default function CalendarPage() {
  const [tab, setTab] = useState<Tab>("yearly");

  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [weekOffset, setWeekOffset] = useState(0);
  const [day, setDay] = useState(() => new Date());

  // Persisted lists (monthly books + weekly goals)
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [books, setBooks] = useState<{ id: string; title: string }[]>([]);
  const [bookTitle, setBookTitle] = useState("");
  const [goals, setGoals] = useState<{ id: string; text: string }[]>([]);
  const [goalText, setGoalText] = useState("");
  // Local-only for now (persisted in a later pass)
  const [dailyTasks, setDailyTasks] = useState<string[]>([]);
  const [dailyText, setDailyText] = useState("");
  const [mood, setMood] = useState("Okay");
  const [reflectionSaved, setReflectionSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const [b, g] = await Promise.all([
        supabase.from("reading_list").select("id,title").eq("kind", "monthly").order("created_at", { ascending: true }),
        supabase.from("weekly_goals").select("id,text").order("created_at", { ascending: true }),
      ]);
      setBooks((b.data as { id: string; title: string }[]) ?? []);
      setGoals((g.data as { id: string; text: string }[]) ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addBook() {
    if (!bookTitle.trim() || !userId) return;
    const { data, error } = await supabase
      .from("reading_list")
      .insert({ user_id: userId, title: bookTitle.trim(), kind: "monthly" })
      .select("id,title")
      .single();
    if (!error && data) setBooks((x) => [...x, data as { id: string; title: string }]);
    setBookTitle("");
  }

  async function addGoal() {
    if (!goalText.trim() || !userId) return;
    const { data, error } = await supabase
      .from("weekly_goals")
      .insert({ user_id: userId, text: goalText.trim() })
      .select("id,text")
      .single();
    if (!error && data) setGoals((x) => [...x, data as { id: string; text: string }]);
    setGoalText("");
  }

  const year = now.getFullYear();

  const weekMonday = useMemo(() => {
    const d = new Date();
    const dow = d.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + mondayOffset + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekMonday);
        d.setDate(weekMonday.getDate() + i);
        return d;
      }),
    [weekMonday],
  );
  const weekEnd = weekDays[6];
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  const tabs: { key: Tab; label: string }[] = [
    { key: "yearly", label: "Yearly" },
    { key: "monthly", label: "Monthly" },
    { key: "weekly", label: "Weekly" },
    { key: "daily", label: "Daily" },
  ];

  return (
    <div className="page active">
      <div className="page-header">
        <h1>Calendar</h1>
        <p>Your academic timeline at a glance</p>
      </div>

      <div className="tab-bar">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={"tab-btn" + (tab === t.key ? " active" : "")}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ============ YEARLY ============ */}
      {tab === "yearly" && (
        <div className="tab-content active">
          <div className="affirmation-banner" style={{ marginBottom: "1.5rem" }}>
            <Sparkles size={20} style={{ flexShrink: 0 }} />
            <p>{`"I am capable of achieving extraordinary things this academic year."`}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="card">
              <div className="card-title" style={cardTitle}>
                <Target size={18} /> {year} Academic Objectives
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                What do you want to achieve this year?
              </div>
              <div className="data-item"><span>○</span><span style={{ flex: 1, fontSize: "0.85rem" }}>Pass all nursing exams with 80%+</span><span className="review-done">Active</span></div>
              <div className="data-item"><span>○</span><span style={{ flex: 1, fontSize: "0.85rem" }}>Complete all clinical rotations</span><span className="review-pending">Pending</span></div>
              <div className="data-item"><span>○</span><span style={{ flex: 1, fontSize: "0.85rem" }}>Build 90-day study streak</span><span className="review-pending">Pending</span></div>
              <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                <input className="field-input" placeholder="Add new objective..." style={{ flex: 1, fontSize: "0.82rem", padding: "0.4rem 0.75rem" }} />
                <button className="btn-add" style={{ padding: "0.4rem 0.75rem", fontSize: "0.82rem" }}>+</button>
              </div>
            </div>
            <div className="card">
              <div className="card-title" style={cardTitle}>
                <Ban size={18} /> Things Not to Repeat
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                Learn from past patterns
              </div>
              <div className="data-item"><span style={{ color: "var(--terracotta)" }}>●</span><span style={{ flex: 1, fontSize: "0.85rem" }}>Procrastinating on assignments</span></div>
              <div className="data-item"><span style={{ color: "var(--terracotta)" }}>●</span><span style={{ flex: 1, fontSize: "0.85rem" }}>Skipping sleep before clinicals</span></div>
              <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                <input className="field-input" placeholder="What to avoid..." style={{ flex: 1, fontSize: "0.82rem", padding: "0.4rem 0.75rem" }} />
                <button className="btn-add" style={{ padding: "0.4rem 0.75rem", fontSize: "0.82rem" }}>+</button>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div className="card-title" style={cardTitle}>
              <CalendarDays size={18} /> {year} Overview
            </div>
            <div className="year-grid">
              {MONTHS.map((m, mi) => {
                const firstDay = new Date(year, mi, 1).getDay();
                const adjFirst = firstDay === 0 ? 6 : firstDay - 1;
                const daysInMo = new Date(year, mi + 1, 0).getDate();
                return (
                  <div className="mini-cal" key={m}>
                    <div className="mini-cal-header">{m}</div>
                    <div className="mini-cal-days">
                      {["M", "T", "W", "T", "F", "S", "S"].map((d, idx) => (
                        <div className="mini-day-name" key={idx}>{d}</div>
                      ))}
                      {Array.from({ length: adjFirst }).map((_, i) => (
                        <div className="mini-day" key={"b" + i} />
                      ))}
                      {Array.from({ length: daysInMo }).map((_, i) => {
                        const d = i + 1;
                        const isToday = mi === now.getMonth() && d === now.getDate();
                        return (
                          <div className={"mini-day" + (isToday ? " today" : "")} key={d}>{d}</div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label">Days in Year</div><div className="stat-val">365</div></div>
            <div className="stat-card"><div className="stat-label">Weeks</div><div className="stat-val">52</div></div>
            <div className="stat-card"><div className="stat-label">Months</div><div className="stat-val">12</div></div>
            <div className="stat-card"><div className="stat-label">Semesters</div><div className="stat-val">2</div></div>
          </div>
        </div>
      )}

      {/* ============ MONTHLY ============ */}
      {tab === "monthly" && (
        <div className="tab-content active">
          <div className="affirmation-banner" style={{ marginBottom: "1rem" }}>
            <Sparkles size={20} style={{ flexShrink: 0 }} />
            <p>{`"This month I focus on progress, not perfection."`}</p>
          </div>
          <div className="month-cal">
            <div className="month-cal-header">
              <button className="cal-nav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
              <h3>{MONTHS[month.getMonth()]} {month.getFullYear()}</h3>
              <button className="cal-nav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
            </div>
            <div className="cal-grid">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div className="cal-day-name" key={d}>{d}</div>
              ))}
              {(() => {
                const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
                const adj = firstDay === 0 ? 6 : firstDay - 1;
                const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
                const cells: React.ReactNode[] = [];
                for (let i = 0; i < adj; i++) {
                  cells.push(<div className="cal-day" key={"b" + i} style={{ background: "var(--bg-main)", opacity: 0.4 }} />);
                }
                for (let d = 1; d <= total; d++) {
                  const isToday =
                    month.getFullYear() === now.getFullYear() &&
                    month.getMonth() === now.getMonth() &&
                    d === now.getDate();
                  const evs = MONTH_EVENTS[d] || [];
                  cells.push(
                    <div className={"cal-day" + (isToday ? " today" : "")} key={d}>
                      <div className="cal-day-num">{d}</div>
                      {evs.map((e, i) => (
                        <div className={"cal-event " + e.cls} key={i}>{e.txt}</div>
                      ))}
                    </div>,
                  );
                }
                return cells;
              })()}
            </div>
          </div>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(196,112,74,0.3)", display: "inline-block" }} /> Exam</span>
            <span style={{ fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(107,124,74,0.3)", display: "inline-block" }} /> Assignment</span>
            <span style={{ fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(45,90,61,0.3)", display: "inline-block" }} /> Clinical</span>
            <span style={{ fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--ochre-light)", display: "inline-block" }} /> Study</span>
          </div>

          <div className="card" style={{ marginTop: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
              <div className="card-title" style={{ ...cardTitle, marginBottom: 0 }}>
                <BookOpen size={18} /> Books to Read This Month
              </div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{books.length} books</span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
              <input
                className="field-input"
                placeholder="Book title..."
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addBook(); }}
                style={{ flex: 2, minWidth: 120, fontSize: "0.82rem", padding: "0.4rem 0.75rem" }}
              />
              <input className="field-input" placeholder="Author (optional)" style={{ flex: 1.5, minWidth: 100, fontSize: "0.82rem", padding: "0.4rem 0.75rem" }} />
              <select className="field-select" style={{ fontSize: "0.8rem", padding: "0.4rem" }}>
                <option value="to-read">To Read</option>
                <option value="reading">Reading</option>
                <option value="done">Done</option>
              </select>
              <button className="btn-add" onClick={addBook} style={{ padding: "0.4rem 0.75rem", fontSize: "0.82rem" }}>+ Add</button>
            </div>
            {books.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 200, overflowY: "auto" }}>
                {books.map((b) => (
                  <div className="data-item" key={b.id}><BookOpen size={14} /><span style={{ flex: 1, fontSize: "0.85rem" }}>{b.title}</span></div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "0.75rem", fontStyle: "italic" }}>
                No books added for this month yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ WEEKLY ============ */}
      {tab === "weekly" && (
        <div className="tab-content active">
          <div className="affirmation-banner" style={{ marginBottom: "1rem" }}>
            <Sparkles size={20} style={{ flexShrink: 0 }} />
            <p>{`"This week I focus on building momentum."`}</p>
          </div>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <button className="cal-nav" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Previous week"><ChevronLeft size={18} /></button>
              <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1rem" }}>
                Week of {MONTHS_SHORT[weekMonday.getMonth()]} {weekMonday.getDate()} – {MONTHS_SHORT[weekEnd.getMonth()]} {weekEnd.getDate()}, {weekEnd.getFullYear()}
              </div>
              <button className="cal-nav" onClick={() => setWeekOffset(weekOffset + 1)} aria-label="Next week"><ChevronRight size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "0.5rem" }}>
              {weekDays.map((d, i) => {
                const today = isSameDay(d, new Date());
                return (
                  <div style={{ textAlign: "center" }} key={i}>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4 }}>
                      {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][i]}
                    </div>
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: "50%",
                        border: today ? "1.5px solid var(--terracotta)" : "1.5px solid var(--border-strong)",
                        background: today ? "var(--terracotta)" : "transparent",
                        color: today ? "white" : "var(--text-muted)",
                        fontWeight: today ? 600 : 400,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.82rem", margin: "auto", cursor: "pointer",
                      }}
                    >
                      {d.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
            <div className="card">
              <div className="card-title" style={cardTitle}><Zap size={18} /> Priority Tasks This Week</div>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                <select className="field-select" style={{ fontSize: "0.8rem", padding: "0.4rem" }}><option>High Priority</option><option>Medium</option><option>Low</option></select>
                <select className="field-select" style={{ fontSize: "0.8rem", padding: "0.4rem" }}><option>Pharmacology</option><option>Clinical</option><option>Fundamentals</option></select>
                <input className="field-input" placeholder="Add priority task..." style={{ flex: 1, minWidth: 150, fontSize: "0.82rem", padding: "0.4rem 0.75rem" }} />
                <button className="btn-add" style={{ padding: "0.4rem 0.75rem", fontSize: "0.82rem" }}>+</button>
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center", padding: "1rem" }}>No priority tasks for this week yet</div>
            </div>
            <div>
              <div className="card" style={{ marginBottom: "1rem" }}>
                <div className="card-title" style={cardTitle}><Target size={18} /> Weekly Goals</div>
                <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem" }}>
                  <input
                    className="field-input"
                    placeholder="Add weekly goal..."
                    value={goalText}
                    onChange={(e) => setGoalText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addGoal(); }}
                    style={{ flex: 1, fontSize: "0.82rem", padding: "0.4rem 0.65rem" }}
                  />
                  <button className="btn-add" onClick={addGoal} style={{ padding: "0.4rem 0.6rem", fontSize: "0.82rem" }}>+</button>
                </div>
                {goals.length ? (
                  <ul style={{ listStyle: "none" }}>
                    {goals.map((g) => (
                      <li className="data-item" key={g.id}><Target size={14} /><span style={{ flex: 1, fontSize: "0.85rem" }}>{g.text}</span></li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "0.5rem" }}>No weekly goals yet</div>
                )}
              </div>
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <div className="card-title" style={{ ...cardTitle, marginBottom: 0 }}><FileText size={18} /> Weekly Reflection</div>
                  <button onClick={() => { setReflectionSaved(true); setTimeout(() => setReflectionSaved(false), 2000); }} className="btn-outline" style={{ padding: "0.25rem 0.65rem", fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: 4 }}><Save size={13} /> Save</button>
                </div>
                <textarea className="field-textarea" placeholder="How did this week go? What did you accomplish? What could be improved?" style={{ width: "100%", fontSize: "0.82rem", minHeight: 80 }} />
                {reflectionSaved && <div style={{ fontSize: "0.72rem", color: "var(--olive)", marginTop: 4 }}>Reflection saved!</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ DAILY ============ */}
      {tab === "daily" && (
        <div className="tab-content active">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <button className="cal-nav" onClick={() => setDay(new Date(day.getTime() - 86400000))} aria-label="Previous day"><ChevronLeft size={18} /></button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.2rem" }}>{DAY_NAMES[day.getDay()]}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {MONTHS[day.getMonth()]} {day.getDate()}, {day.getFullYear()}
                {isSameDay(day, new Date()) ? " · Today" : ""}
              </div>
            </div>
            <button className="cal-nav" onClick={() => setDay(new Date(day.getTime() + 86400000))} aria-label="Next day"><ChevronRight size={18} /></button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
            <div className="affirmation-banner"><Heart size={18} style={{ color: "#8A68A8", flexShrink: 0 }} /><p>{`"I cultivate abundance and celebrate my progress"`}</p></div>
            <div className="affirmation-banner" style={{ background: "rgba(107,124,74,0.1)", borderColor: "rgba(107,124,74,0.2)" }}><Heart size={18} style={{ color: "var(--olive)", flexShrink: 0 }} /><p>{`"This week I focus on building momentum"`}</p></div>
            <div className="affirmation-banner" style={{ background: "rgba(196,154,58,0.1)", borderColor: "rgba(196,154,58,0.2)" }}><Heart size={18} style={{ color: "var(--ochre)", flexShrink: 0 }} /><p>{`"Today I trust in my ability to handle whatever comes my way"`}</p></div>
          </div>

          {/* Responsive grid — collapses to one column on mobile (fixes the unreachable-options bug) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <div className="card-title" style={cardTitle}><Zap size={18} /> Priority Tasks</div>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                <select className="field-select" style={{ fontSize: "0.78rem", padding: "0.35rem" }}><option>High</option><option>Medium</option></select>
                <select className="field-select" style={{ fontSize: "0.78rem", padding: "0.35rem" }}><option>Pharmacology</option><option>Clinical</option></select>
                <input className="field-input" placeholder="Add task..." style={{ flex: 1, minWidth: 120, fontSize: "0.78rem", padding: "0.35rem 0.6rem" }} />
                <button className="btn-add" style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }}>+</button>
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "0.75rem" }}>No priority tasks for today</div>
            </div>

            <div className="card">
              <div className="card-title" style={cardTitle}><Heart size={18} /> Gratitude</div>
              <input className="field-input" placeholder="Add something you're grateful for..." style={{ width: "100%", fontSize: "0.82rem", padding: "0.4rem 0.75rem", marginBottom: "0.75rem" }} />
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "0.75rem" }}>Add something you&apos;re grateful for today</div>
            </div>

            <div className="card">
              <div className="card-title" style={cardTitle}><ListChecks size={18} /> Daily Tasks</div>
              <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
                <input
                  className="field-input"
                  placeholder="Add daily task..."
                  value={dailyText}
                  onChange={(e) => setDailyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && dailyText.trim()) { setDailyTasks([...dailyTasks, dailyText.trim()]); setDailyText(""); } }}
                  style={{ flex: 1, fontSize: "0.82rem", padding: "0.4rem 0.75rem" }}
                />
                <button className="btn-add" onClick={() => { if (dailyText.trim()) { setDailyTasks([...dailyTasks, dailyText.trim()]); setDailyText(""); } }} style={{ padding: "0.4rem 0.65rem", fontSize: "0.82rem" }}>+</button>
              </div>
              {dailyTasks.length ? (
                <ul style={{ listStyle: "none" }}>
                  {dailyTasks.map((t, i) => (
                    <li className="data-item" key={i}><ListChecks size={14} /><span style={{ flex: 1, fontSize: "0.85rem" }}>{t}</span></li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "0.75rem" }}>No daily tasks added yet</div>
              )}
            </div>

            <div className="card">
              <div className="card-title" style={cardTitle}><NotebookPen size={18} /> Daily Journal</div>
              <textarea className="field-textarea" placeholder="How was your day? What did you learn? What are you thinking about?" style={{ width: "100%", minHeight: 100, fontSize: "0.82rem" }} />
            </div>

            <div className="card">
              <div className="card-title" style={cardTitle}><Clock size={18} /> Daily Schedule</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" style={{ marginBottom: "0.5rem" }}>
                <input className="field-input" type="time" style={{ fontSize: "0.78rem", padding: "0.35rem" }} />
                <input className="field-input" placeholder="Event title" style={{ fontSize: "0.78rem", padding: "0.35rem 0.6rem" }} />
                <button className="btn-add" style={{ fontSize: "0.78rem", padding: "0.35rem 0.6rem" }}>+ Add</button>
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", padding: "0.75rem" }}>No events scheduled for today</div>
            </div>

            <div className="card">
              <div className="card-title" style={cardTitle}><Smile size={18} /> Daily Mood</div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-around", marginBottom: "0.5rem" }}>
                {[
                  { e: "😢", label: "Very Bad" },
                  { e: "😔", label: "Bad" },
                  { e: "😐", label: "Okay" },
                  { e: "😊", label: "Good" },
                  { e: "🤩", label: "Excellent" },
                ].map((m) => (
                  <button key={m.label} className={"mood-btn" + (mood === m.label ? " selected" : "")} onClick={() => setMood(m.label)}>
                    {m.e}<br /><span style={{ fontSize: "0.6rem" }}>{m.label}</span>
                  </button>
                ))}
              </div>
              <div style={{ textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)" }}>Current mood: {mood}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
