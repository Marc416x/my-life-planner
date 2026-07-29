import { PagePlaceholder } from "@/components/page-placeholder";

export default function Page() {
  return (
    <PagePlaceholder
      title="Study Groups"
      description="Peer groups, leaderboards, and chat."
      pro={{
        feature: "Study Groups",
        blurb: "Study alongside your cohort with shared streaks, leaderboards, and group chat.",
        perks: ["Shared streaks & leaderboards", "Group chat", "Compare progress with peers"],
      }}
    />
  );
}
