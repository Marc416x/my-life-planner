"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Flame,
  Palette,
  Calendar,
  Sparkles,
  ClipboardList,
  CalendarClock,
  Target,
  BarChart3,
  Plus,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/profile-provider";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  PageHero,
  Progress,
  StatCard,
} from "@/components/kit";

type Task = { id: string; text: string; tag: string | null; tag_class: string | null; done: boolean };
type Priority = "high" | "medium" | "low";
type Assignment = {
  id: string;
  title: string;
  course: string | null;
  due_date: string | null;
  priority: Priority;
  status: "pending" | "in_progress" | "completed";
};

const PRI: Record<Priority, { rank: number; color: string }> = {
  high: { rank: 0, color: "var(--terracotta)" },
  medium: { rank: 1, color: "var(--ochre)" },
  low: { rank: 2, color: "var(--forest)" },
};

function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Translucent pill for the warm hero banner (matches the login hero chips).
const heroChip: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "#FBF1E6",
  background: "rgba(255,255,255,0.16)",
  padding: "0.32rem 0.75rem",
  borderRadius: "999px",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
};

function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }}
    />
  );
}

export default function DashboardPage() {
  const supabase = createClient();
  const { name, streak, level, recordActivity } = useProfile();
  const TierIcon = level.tier.icon;
  const displayName = name || "Nurse";
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  const [timePart, setTimePart] = useState("Welcome back");
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    const now = new Date();
    const h = now.getHours();
    const g = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    // Computed on mount (not at render) so the SSR markup stays stable — the
    // greeting + date depend on the viewer's clock.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimePart(g);
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    setDateLabel(
      `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()} · Week ${getWeekNumber(now)}`,
    );
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const { data } = await supabase
        .from("daily_tasks")
        .select("*")
        .order("created_at", { ascending: true });
      setTasks((data as Task[]) ?? []);
      const { data: asg } = await supabase
        .from("assignments")
        .select("id,title,course,due_date,priority,status");
      setAssignments((asg as Assignment[]) ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addTask() {
    if (!newTask.trim() || !userId) return;
    const { data, error } = await supabase
      .from("daily_tasks")
      .insert({ user_id: userId, text: newTask.trim() })
      .select()
      .single();
    if (!error && data) setTasks((t) => [...t, data as Task]);
    setNewTask("");
  }

  async function toggleTask(id: string, done: boolean) {
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, done } : x)));
    await supabase.from("daily_tasks").update({ done }).eq("id", id);
    // Completing a task counts today toward the study streak.
    if (done) await recordActivity();
  }

  async function removeTask(id: string) {
    setTasks((t) => t.filter((x) => x.id !== id));
    await supabase.from("daily_tasks").delete().eq("id", id);
  }

  const doneCount = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const percent = total ? Math.round((doneCount / total) * 100) : 0;

  // Assignments
  const today0 = (() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t.getTime(); })();
  const daysUntil = (dueDate: string) => Math.ceil((parseDate(dueDate).getTime() - today0) / 86400000);
  const dueLabel = (a: Assignment) => {
    if (!a.due_date) return "";
    const d = daysUntil(a.due_date);
    if (d < 0) return "Overdue";
    if (d === 0) return "Today";
    return `${d}d`;
  };
  const active = assignments.filter((a) => a.status !== "completed");
  const topAssignments = [...active].sort((a, b) => {
    const pr = PRI[a.priority].rank - PRI[b.priority].rank;
    if (pr !== 0) return pr;
    const ad = a.due_date ? parseDate(a.due_date).getTime() : Infinity;
    const bd = b.due_date ? parseDate(b.due_date).getTime() : Infinity;
    return ad - bd;
  }).slice(0, 3);
  const dueSoon = active.filter((a) => a.due_date && daysUntil(a.due_date) <= 7);
  const soonest = active
    .filter((a) => a.due_date)
    .sort((a, b) => parseDate(a.due_date!).getTime() - parseDate(b.due_date!).getTime())[0];

  return (
    <div className="page active">
      {/* Greeting hero */}
      <PageHero title={`${timePart}, ${displayName}!`} subtitle={dateLabel}>
        <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.9rem", flexWrap: "wrap" }}>
          <span style={heroChip}>
            <Flame size={14} /> <span>{streak}</span> day streak
          </span>
          <span style={heroChip}>
            <TierIcon size={14} /> {level.tier.name}
          </span>
          <span style={heroChip}>
            <Calendar size={14} /> Year <span>1</span>
          </span>
        </div>
      </PageHero>

      {/* Affirmation */}
      <Alert tone="info" icon={<Sparkles size={18} />} style={{ marginBottom: "1.5rem" }}>
        <span style={{ fontStyle: "italic" }}>
          {`"You are capable of extraordinary things. Every patient you'll save starts with this moment of study."`}
        </span>
      </Alert>

      {/* Stats */}
      <div className="k-stats-grid" style={{ marginBottom: "1.5rem" }}>
        <StatCard tone="terracotta" label="Today's Study Time" value="0h 0m">
          <Progress value={0} tone="terracotta" style={{ margin: "0.5rem 0 0.3rem" }} />
          <div className="k-stat__sub">Goal: 3h today</div>
        </StatCard>
        <StatCard tone="olive" label="Tasks Completed" value={`${doneCount}/${total}`}>
          <Progress value={percent} tone="olive" style={{ margin: "0.5rem 0 0.3rem" }} />
          <div className="k-stat__sub">{percent}% done today</div>
        </StatCard>
        <StatCard tone="ochre" label="Upcoming Exams" value="2" sub="Next: Pharmacology in 12d" />
        <StatCard
          tone="forest"
          label="Assignment Due Soon"
          value={dueSoon.length}
          sub={dueSoon.length > 0 && soonest ? `${soonest.title} — ${dueLabel(soonest)}` : "Nothing due soon"}
        />
      </div>

      {/* Tasks + Discipline Level */}
      <div className="dash-grid">
        <Card className="dash-wide" title="Today's Tasks" icon={<ClipboardList size={20} />}>
          <div style={{ display: "flex", gap: "0.4rem", margin: "0 0 0.9rem" }}>
            <Input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
              placeholder="Add a task for today..."
              style={{ flex: 1 }}
            />
            <Button iconOnly onClick={addTask} aria-label="Add task">
              <Plus size={18} />
            </Button>
          </div>
          {total ? (
            <ul className="today-tasks-list">
              {tasks.map((t) => (
                <li className="task-item" key={t.id}>
                  <div
                    className={"task-check" + (t.done ? " done" : "")}
                    onClick={() => toggleTask(t.id, !t.done)}
                    role="checkbox"
                    aria-checked={t.done}
                    aria-label={t.text}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleTask(t.id, !t.done);
                      }
                    }}
                  />
                  <span style={t.done ? { textDecoration: "line-through", opacity: 0.6, flex: 1 } : { flex: 1 }}>
                    {t.text}
                  </span>
                  {t.tag && <span className={"task-tag " + (t.tag_class ?? "")}>{t.tag}</span>}
                  <button
                    onClick={() => removeTask(t.id)}
                    aria-label="Delete task"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 2 }}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center", padding: "1rem", fontStyle: "italic" }}>
              No tasks yet — add your first one above.
            </div>
          )}
        </Card>

        <Card title="Discipline Level" icon={<Palette size={20} />}>
          <div className="level-display">
            <div className="level-circle" style={{ background: "var(--terracotta)" }}>
              {level.level}
            </div>
            <div
              style={{
                fontFamily: "var(--font-caveat), cursive",
                fontSize: "1rem",
                color: "var(--text-primary)",
                fontWeight: 600,
              }}
            >
              {level.tier.name}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              {level.next ? "Build your longest streak to level up!" : "🏆 Top of the ladder — Legend!"}
            </div>
            <Progress value={level.progress} tone="terracotta" style={{ marginTop: "0.75rem" }} />
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              {level.next
                ? `Next: ${level.next.name} (${level.daysToNext} ${level.daysToNext === 1 ? "day" : "days"} to go)`
                : "Max level reached"}
            </div>
          </div>
        </Card>
      </div>

      {/* Assignments + Goals + Week progress */}
      <div className="dash-grid">
        <Card title="Assignments" icon={<CalendarClock size={20} />}>
          {topAssignments.length ? (
            topAssignments.map((a) => {
              const overdue = !!a.due_date && daysUntil(a.due_date) < 0;
              return (
                <div className="data-item" key={a.id}>
                  <Dot color={PRI[a.priority].color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{a.course}</div>
                  </div>
                  {overdue ? (
                    <Badge tone="terracotta" solid>{dueLabel(a)}</Badge>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{dueLabel(a)}</span>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center", padding: "1rem", fontStyle: "italic" }}>
              No active assignments.
            </div>
          )}
          {active.length > 3 && (
            <Link href="/assignments" style={{ display: "inline-block", marginTop: "0.6rem", fontSize: "0.8rem", color: "var(--terracotta)" }}>
              View all ({assignments.length}) →
            </Link>
          )}
        </Card>

        <Card title="Active Goals" icon={<Target size={20} />}>
          <div className="data-item">
            <Target size={15} style={{ color: "var(--terracotta)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>Pass Pharmacology Mid-Term</div>
              <Progress value={60} tone="terracotta" style={{ marginTop: 4 }} />
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>60%</span>
          </div>
          <div className="data-item">
            <Target size={15} style={{ color: "var(--olive)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>Complete 30-Day Study Streak</div>
              <Progress value={Math.min(100, Math.round((streak / 30) * 100))} tone="olive" style={{ marginTop: 4 }} />
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{Math.min(100, Math.round((streak / 30) * 100))}%</span>
          </div>
          <div className="data-item">
            <Target size={15} style={{ color: "var(--ochre)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>Maintain GPA above 3.5</div>
              <Progress value={75} tone="ochre" style={{ marginTop: 4 }} />
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>3.7</span>
          </div>
        </Card>

        <Card title="Week Progress" icon={<BarChart3 size={20} />}>
          <div className="chart-container">
            {[
              { h: 70, cls: "fill-terracotta", label: "Mon", op: 1 },
              { h: 90, cls: "fill-terracotta", label: "Tue", op: 1 },
              { h: 50, cls: "fill-terracotta", label: "Wed", op: 1 },
              { h: 20, cls: "fill-ochre", label: "Thu", op: 0.4 },
              { h: 4, cls: "fill-olive", label: "Fri", op: 0.3 },
              { h: 4, cls: "fill-olive", label: "Sat", op: 0.3 },
              { h: 4, cls: "fill-olive", label: "Sun", op: 0.3 },
            ].map((b) => (
              <div className="chart-bar-wrap" key={b.label}>
                <div className={"chart-bar-inner " + b.cls} style={{ height: b.h, opacity: b.op }} />
                <div className="chart-bar-label">{b.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.5rem", textAlign: "center" }}>
            Study hours this week (Mon–Sun)
          </div>
        </Card>
      </div>
    </div>
  );
}
