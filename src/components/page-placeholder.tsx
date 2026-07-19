// Temporary placeholder for sections not yet ported from the original design.
// Uses the original .page / .page-header / .card classes so it looks on-brand.
export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="page active">
      <div className="page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
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
    </div>
  );
}
