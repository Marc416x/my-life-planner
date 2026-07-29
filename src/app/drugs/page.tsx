import { PagePlaceholder } from "@/components/page-placeholder";

export default function Page() {
  return (
    <PagePlaceholder
      title="Drug Tracker"
      description="Daily drug logging and spaced-recall quiz."
      pro={{
        feature: "The Drug Tracker",
        blurb: "Build your own drug deck and lock it in with spaced-recall quizzes.",
        perks: ["Personal medication library", "Spaced-repetition recall quizzes", "Class & interaction tagging"],
      }}
    />
  );
}
