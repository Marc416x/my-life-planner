"use client";

import { HelpCircle, Trophy, Flame } from "lucide-react";
import { HelpGuide, type GuideTopic } from "@/components/help-guide";
import { PageHeader } from "@/components/kit";
import { TIERS } from "@/lib/level";

// The discipline ladder, rendered straight from the source of truth (TIERS) so
// the guide can never drift from the real thresholds.
function LevelLadder() {
  return (
    <div className="guide-ladder">
      {TIERS.map((t) => {
        const Icon = t.icon;
        return (
          <div className="guide-ladder-row" key={t.name}>
            <span className="lvl-icon"><Icon size={15} /></span>
            <span className="lvl-name">{t.name}</span>
            <span className="lvl-req">{t.min === 0 ? "starting tier" : `best streak of ${t.min} days`}</span>
          </div>
        );
      })}
    </div>
  );
}

// Expandable help topics. Add new entries here as features land — each becomes
// another expand-and-scroll row. Ids double as deep-link anchors (/help#levels).
const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: "levels",
    title: "How your Discipline Level works",
    icon: <Trophy size={16} />,
    body: (
      <>
        <p>
          Your <strong>Discipline Level</strong> grows with your <strong>best streak</strong> — the
          longest run of consecutive study days you&apos;ve ever reached. Once you unlock a tier it&apos;s
          yours for good: a missed day never demotes you.
        </p>
        <LevelLadder />
        <p>
          So the way to level up is simply to keep your streak going a little longer than your previous
          record. Your current level shows in the sidebar, the dashboard greeting, and the
          <strong> Discipline Level</strong> card.
        </p>
      </>
    ),
  },
  {
    id: "streaks",
    title: "How study streaks work",
    icon: <Flame size={16} />,
    body: (
      <>
        <p>
          A day counts toward your streak when you <strong>complete at least one task</strong> on the
          dashboard, or tap <strong>Mark today as studied</strong> on the Study Streaks page.
        </p>
        <p>
          Your <strong>current streak</strong> is the number of days in a row you&apos;ve done that,
          ending today. It stays alive through the day — it only resets to zero once a whole day passes
          with no activity, so an unlogged morning won&apos;t break it.
        </p>
        <p>
          Your <strong>best streak</strong> is the longest current streak you&apos;ve ever hit, and
          that&apos;s what drives your Discipline Level.
        </p>
      </>
    ),
  },
];

export default function HelpPage() {
  return (
    <div className="page active">
      <PageHeader
        icon={<HelpCircle size={22} />}
        title="Help & Guide"
        subtitle="Short explainers for how the app works. Tap a topic to expand it."
      />
      <HelpGuide topics={GUIDE_TOPICS} />
    </div>
  );
}
