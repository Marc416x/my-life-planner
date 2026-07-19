"use client";

import { useEffect, useState } from "react";
import {
  Flame,
  Palette,
  Calendar,
  Sparkles,
  ClipboardList,
  CalendarClock,
  Target,
  BarChart3,
} from "lucide-react";

type Task = { text: string; tag: string; tagClass: string; done: boolean };

const initialTasks: Task[] = [
  { text: "Review Pharmacology Chapter 8 — Drug Interactions", tag: "Study", tagClass: "tag-study", done: false },
  { text: "Complete Nursing Assessment Case Study", tag: "Due Soon", tagClass: "tag-assign", done: false },
  { text: "Clinical Prep — Patient Vitals & Medication Review", tag: "Clinical", tagClass: "tag-clinical", done: false },
  { text: "Practice NCLEX Questions — Cardiovascular", tag: "Study", tagClass: "tag-study", done: false },
  { text: "Pharmacology Mid-Term Exam", tag: "Exam", tagClass: "tag-exam", done: false },
];

const chipStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "var(--text-secondary)",
  background: "rgba(255,255,255,0.5)",
  padding: "0.3rem 0.75rem",
  borderRadius: "20px",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
};

const cardTitleStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
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
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [greeting, setGreeting] = useState("Welcome back, Nurse!");
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    const now = new Date();
    const h = now.getHours();
    const g = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    setGreeting(`${g}, Nurse!`);
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    setDateLabel(
      `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()} · Week ${getWeekNumber(now)}`,
    );
  }, []);

  const toggleTask = (i: number) =>
    setTasks((ts) => ts.map((t, idx) => (idx === i ? { ...t, done: !t.done } : t)));

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="page active">
      {/* Greeting */}
      <div className="greeting-banner">
        <h2>{greeting}</h2>
        <p>{dateLabel}</p>
        <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <div style={chipStyle}>
            <Flame size={14} /> <span>0</span> day streak
          </div>
          <div style={chipStyle}>
            <Palette size={14} /> <span>Beginner</span>
          </div>
          <div style={chipStyle}>
            <Calendar size={14} /> Year <span>1</span>
          </div>
        </div>
      </div>

      {/* Affirmation */}
      <div className="affirmation-banner">
        <Sparkles size={20} style={{ flexShrink: 0 }} />
        <p>
          {`"You are capable of extraordinary things. Every patient you'll save starts with this moment of study."`}
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Today&apos;s Study Time</div>
          <div className="stat-val">0h 0m</div>
          <div className="progress-bar">
            <div className="progress-fill fill-terracotta" style={{ width: "0%" }} />
          </div>
          <div className="stat-sub">Goal: 3h today</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tasks Completed</div>
          <div className="stat-val">{doneCount}/{tasks.length}</div>
          <div className="progress-bar">
            <div
              className="progress-fill fill-olive"
              style={{ width: `${Math.round((doneCount / tasks.length) * 100)}%` }}
            />
          </div>
          <div className="stat-sub">
            {Math.round((doneCount / tasks.length) * 100)}% done today
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Upcoming Exams</div>
          <div className="stat-val">2</div>
          <div className="stat-sub">Next: Pharmacology in 12d</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Assignment Due Soon</div>
          <div className="stat-val">1</div>
          <div className="stat-sub">Case Study — 2 days</div>
        </div>
      </div>

      {/* Tasks + Discipline Level */}
      <div className="dash-grid">
        <div className="card dash-wide">
          <div className="card-title" style={cardTitleStyle}>
            <ClipboardList size={18} /> Today&apos;s Tasks
          </div>
          <ul className="today-tasks-list">
            {tasks.map((t, i) => (
              <li className="task-item" key={i}>
                <div
                  className={"task-check" + (t.done ? " done" : "")}
                  onClick={() => toggleTask(i)}
                  role="checkbox"
                  aria-checked={t.done}
                  aria-label={t.text}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleTask(i);
                    }
                  }}
                />
                <span style={t.done ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>
                  {t.text}
                </span>
                <span className={"task-tag " + t.tagClass}>{t.tag}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="card-title" style={cardTitleStyle}>
            <Palette size={18} /> Discipline Level
          </div>
          <div className="level-display">
            <div className="level-circle" style={{ background: "var(--terracotta)" }}>
              1
            </div>
            <div
              style={{
                fontFamily: "var(--font-caveat), cursive",
                fontSize: "1rem",
                color: "var(--text-primary)",
                fontWeight: 600,
              }}
            >
              Beginner
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Keep your streak to level up!
            </div>
            <div className="progress-bar" style={{ marginTop: "0.75rem" }}>
              <div className="progress-fill fill-terracotta" style={{ width: "15%" }} />
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Next: Rising (3 days)
            </div>
          </div>
        </div>
      </div>

      {/* Assignments + Goals + Week progress */}
      <div className="dash-grid">
        <div className="card">
          <div className="card-title" style={cardTitleStyle}>
            <CalendarClock size={18} /> Upcoming Assignments
          </div>
          <div className="data-item">
            <Dot color="var(--terracotta)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>Nursing Case Study</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Fundamentals of Nursing</div>
            </div>
            <span className="priority-high">2 days</span>
          </div>
          <div className="data-item">
            <Dot color="var(--ochre)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>Pharmacology Drug Chart</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Pharmacology</div>
            </div>
            <span className="priority-med">5 days</span>
          </div>
          <div className="data-item">
            <Dot color="var(--forest)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>Lab Report — Blood Analysis</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Clinical Lab Sciences</div>
            </div>
            <span className="priority-low">12 days</span>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={cardTitleStyle}>
            <Target size={18} /> Active Goals
          </div>
          <div className="data-item">
            <Target size={15} style={{ color: "var(--terracotta)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>Pass Pharmacology Mid-Term</div>
              <div className="progress-bar" style={{ marginTop: 4 }}>
                <div className="progress-fill fill-terracotta" style={{ width: "60%" }} />
              </div>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>60%</span>
          </div>
          <div className="data-item">
            <Target size={15} style={{ color: "var(--olive)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>Complete 30-Day Study Streak</div>
              <div className="progress-bar" style={{ marginTop: 4 }}>
                <div className="progress-fill fill-olive" style={{ width: "0%" }} />
              </div>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>0%</span>
          </div>
          <div className="data-item">
            <Target size={15} style={{ color: "var(--ochre)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>Maintain GPA above 3.5</div>
              <div className="progress-bar" style={{ marginTop: 4 }}>
                <div className="progress-fill fill-ochre" style={{ width: "75%" }} />
              </div>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>3.7</span>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={cardTitleStyle}>
            <BarChart3 size={18} /> Week Progress
          </div>
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
        </div>
      </div>
    </div>
  );
}
