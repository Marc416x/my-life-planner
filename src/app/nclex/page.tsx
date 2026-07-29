import { PagePlaceholder } from "@/components/page-placeholder";

export default function Page() {
  return (
    <PagePlaceholder
      title="NCLEX Tracker"
      description="NCLEX practice sessions and readiness."
      pro={{
        feature: "The NCLEX Tracker",
        blurb: "Track your practice-question performance and see how ready you are across every NCLEX category.",
        perks: ["Per-category readiness scoring", "Question-bank progress", "Predicted pass probability"],
      }}
    />
  );
}
