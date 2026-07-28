import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "terracotta" | "olive" | "ochre" | "forest" | "neutral";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Filled instead of the default soft tint. */
  solid?: boolean;
}

export function Badge({ tone = "neutral", solid, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn("k-badge", `k-badge--${tone}`, solid && "k-badge--solid", className)}
      {...rest}
    >
      {children}
    </span>
  );
}
