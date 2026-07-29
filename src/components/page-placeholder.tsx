import { ProGate } from "@/components/pro-gate";

// Temporary placeholder for sections not yet ported from the original design.
// Uses the original .page / .page-header / .card classes so it looks on-brand.
// Pass `pro` to lock the section behind the Pro upsell for non-Pro users while
// still showing them the header + pitch.
export function PagePlaceholder({
  title,
  description,
  pro,
}: {
  title: string;
  description: string;
  pro?: { feature: string; blurb: string; perks?: string[] };
}) {
  const body = (
    <div
      className="card"
      style={{
        textAlign: "center",
        color: "var(--text-muted)",
        padding: "2.5rem 1rem",
      }}
    >
      This section is being ported from your original design — coming next.
    </div>
  );

  return (
    <div className="page active">
      <div className="page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {pro ? (
        <ProGate feature={pro.feature} blurb={pro.blurb} perks={pro.perks}>
          {body}
        </ProGate>
      ) : (
        body
      )}
    </div>
  );
}
