import * as React from "react";
import { cn } from "@/lib/utils";

// Standard page title block: handwritten title, italic subtitle, terracotta
// underline accent, optional leading icon chip and trailing action slot.
export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("k-page-header", className)}>
      {icon && <span className="k-page-header__icon">{icon}</span>}
      <div className="k-page-header__text">
        <h1 className="k-page-header__title">{title}</h1>
        {subtitle && <p className="k-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="k-page-header__actions">{actions}</div>}
    </div>
  );
}

// Warm brand-gradient banner (the login left-panel treatment) for landing /
// dashboard-style headers.
export interface PageHeroProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageHero({ title, subtitle, children, className }: PageHeroProps) {
  return (
    <div className={cn("k-page-hero", className)}>
      <div className="k-page-hero__title">{title}</div>
      {subtitle && <p className="k-page-hero__subtitle">{subtitle}</p>}
      {children}
    </div>
  );
}
