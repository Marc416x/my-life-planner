import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "terracotta" | "olive" | "ochre" | "forest";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  tone?: Tone;
}

export function Progress({ value, tone = "terracotta", className, ...rest }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("k-progress", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      {...rest}
    >
      <div className={cn("k-progress__fill", `k-progress__fill--${tone}`)} style={{ width: `${pct}%` }} />
    </div>
  );
}
