import * as React from "react";
import { cn } from "@/lib/utils";

// Controlled tab strip — the parent owns the active value, so this stays a
// stateless presentational component (usable in server or client trees).
export interface TabItem {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}

export function Tabs({ items, value, onValueChange, className, ...rest }: TabsProps) {
  return (
    <div className={cn("k-tabs", className)} role="tablist" {...rest}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          className="k-tab"
          onClick={() => onValueChange(item.value)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
