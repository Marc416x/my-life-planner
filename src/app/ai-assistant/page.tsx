import { PagePlaceholder } from "@/components/page-placeholder";

export default function Page() {
  return (
    <PagePlaceholder
      title="AI Study Assistant"
      description="Your AI study helper."
      pro={{
        feature: "The AI Study Assistant",
        blurb: "Ask questions, generate practice items, and get explanations grounded in what you're studying.",
        perks: ["Ask-anything nursing tutor", "Auto-generated practice questions", "Explanations tied to your courses"],
      }}
    />
  );
}
