import * as React from "react";
import { cn } from "@/lib/utils";

// The screen every not-yet-operational feature shows until it is wired, and
// the fallback for a section that currently has no data.
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("k-empty", className)}>
      {icon && <span className="k-empty__icon">{icon}</span>}
      <div className="k-empty__title">{title}</div>
      {description && <p className="k-empty__desc">{description}</p>}
      {action && <div className="k-empty__action">{action}</div>}
    </div>
  );
}
