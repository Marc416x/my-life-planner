import * as React from "react";
import { cn } from "@/lib/utils";

// Titled content block — a lightweight layout helper for grouping.
export interface SectionProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Section({ title, description, actions, className, children }: SectionProps) {
  return (
    <section className={cn("k-section", className)}>
      {(title || actions) && (
        <div className="k-section__head" style={{ display: "flex", alignItems: "flex-end", gap: "1rem" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && <div className="k-section__title">{title}</div>}
            {description && <div className="k-section__desc">{description}</div>}
          </div>
          {actions && <div style={{ flex: "none" }}>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
