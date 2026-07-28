"use client";

import { useMemo, useState } from "react";
import { Flame, Trophy, CalendarDays, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useProfile } from "@/components/profile-provider";
import { PageHeader, StatCard, Card, Button, Alert } from "@/components/kit";
import { toISODate } from "@/lib/streak";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Monday-first month grid: leading nulls pad to the first weekday, then one ISO
// date per day of the month.
function buildMonth(year: number, month: number): (string | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(year, month, d)));
  return cells;
}

export default function StreaksPage() {
  const { studyDays, streak, best, recordActivity } = useProfile();

  const daySet = useMemo(() => new Set(studyDays), [studyDays]);
  const todayISO = toISODate(new Date());
  const studiedToday = daySet.has(todayISO);
  const total = studyDays.length;

  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const cells = useMemo(() => buildMonth(view.y, view.m), [view]);
  const isThisMonth = view.y === now.getFullYear() && view.m === now.getMonth();

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  // Same action, two homes: in the header on desktop, on its own line on mobile
  // (matches the k-desktop-only / k-mobile-only pattern used across the app).
  const markButton = (className?: string) => (
    <Button className={className} onClick={() => recordActivity()} disabled={studiedToday}>
      {studiedToday ? <><Check size={16} /> Studied today</> : <><Flame size={16} /> Mark today as studied</>}
    </Button>
  );

  return (
    <div className="page active">
      <PageHeader
        title="Study Streaks"
        subtitle="Study each day to keep the flame alive."
        icon={<Flame size={22} />}
        actions={markButton("k-desktop-only")}
      />

      {/* Mobile: the mark-today action sits on its own line under the header. */}
      <div className="k-mobile-only k-mobile-add" style={{ marginBottom: "1.25rem" }}>
        {markButton()}
      </div>

      <div className="k-stats-grid" style={{ marginBottom: "1.5rem" }}>
        <StatCard
          tone="terracotta"
          label="Current Streak"
          value={`${streak} ${streak === 1 ? "day" : "days"}`}
          sub={studiedToday ? "Logged today — nice work!" : streak > 0 ? "Study today to keep it going" : "Study today to start a streak"}
          icon={<Flame size={18} />}
        />
        <StatCard
          tone="ochre"
          label="Best Streak"
          value={`${best} ${best === 1 ? "day" : "days"}`}
          sub="Your longest run so far"
          icon={<Trophy size={18} />}
        />
        <StatCard
          tone="forest"
          label="Total Study Days"
          value={total}
          sub="Days you've shown up"
          icon={<CalendarDays size={18} />}
        />
      </div>

      <Card
        title={`${MONTHS[view.m]} ${view.y}`}
        icon={<CalendarDays size={20} />}
        action={
          <div style={{ display: "flex", gap: "0.35rem" }}>
            <Button variant="ghost" iconOnly onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft size={18} />
            </Button>
            <Button
              variant="ghost"
              iconOnly
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              disabled={isThisMonth}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
        }
      >
        <div className="streak-grid">
          {WEEKDAYS.map((d, i) => (
            <div
              key={`h-${i}`}
              className="streak-day"
              style={{ background: "var(--bg-main)", border: "none", fontSize: "0.6rem", color: "var(--text-muted)" }}
            >
              {d}
            </div>
          ))}
          {cells.map((iso, i) => {
            if (!iso) return <div key={`b-${i}`} />;
            const done = daySet.has(iso);
            const isToday = iso === todayISO;
            const dayNum = Number(iso.slice(8, 10));
            return (
              <div
                key={iso}
                className={"streak-day" + (done ? " done" : "") + (isToday ? " today" : "")}
                title={done ? "Studied" : isToday ? "Today" : ""}
              >
                {dayNum}
              </div>
            );
          })}
        </div>
        <Alert tone="info" icon={<Flame size={16} />} style={{ marginTop: "1rem" }}>
          A day counts toward your streak when you complete a task on the dashboard or tap{" "}
          <strong>Mark today as studied</strong>. Miss a full day and the streak resets — so keep showing up.
        </Alert>
      </Card>
    </div>
  );
}
