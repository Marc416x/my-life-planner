import * as React from "react";
import { cn } from "@/lib/utils";

// Surface primitive. `title` / `icon` / `action` render the standard card
// header; omit them all for a bare surface. `accent` adds the login-style
// gradient top bar; `interactive` adds a hover lift for clickable cards.
export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  accent?: boolean;
  interactive?: boolean;
  /** Remove padding (e.g. for a card that wraps a full-bleed list/table). */
  flush?: boolean;
}

export function Card({
  title,
  subtitle,
  icon,
  action,
  accent,
  interactive,
  flush,
  className,
  children,
  ...rest
}: CardProps) {
  const hasHead = title || icon || action;
  return (
    <div
      className={cn(
        "k-card",
        accent && "k-card--accent",
        interactive && "k-card--interactive",
        flush && "k-card--flush",
        className,
      )}
      {...rest}
    >
      {hasHead && (
        <div className="k-card__head">
          {icon && <span className="k-card__icon">{icon}</span>}
          <div className="k-card__head-text">
            {title && <div className="k-card__title">{title}</div>}
            {subtitle && <div className="k-card__subtitle">{subtitle}</div>}
          </div>
          {action && <div className="k-card__action">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

type Tone = "terracotta" | "olive" | "ochre" | "forest";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  /** Extra content below the value (e.g. a Progress bar). */
  children?: React.ReactNode;
}

export function StatCard({ label, value, sub, icon, tone, className, children, ...rest }: StatCardProps) {
  return (
    <div className={cn("k-stat", tone && `k-stat--${tone}`, className)} {...rest}>
      <div className="k-stat__top">
        <span className="k-stat__label">{label}</span>
        {icon && <span className="k-stat__icon">{icon}</span>}
      </div>
      <div className="k-stat__value">{value}</div>
      {sub && <div className="k-stat__sub">{sub}</div>}
      {children}
    </div>
  );
}
