import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Kit button. Colour comes from tokens (--terracotta …); shape from the
// --s-* style tokens. Variants mirror the login/onboarding button language.
type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Stretch to the full width of the container. */
  block?: boolean;
  /** Square-ish padding for a single icon. */
  iconOnly?: boolean;
  /** Show a spinner and disable interaction. */
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  block,
  iconOnly,
  loading,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "k-btn",
        `k-btn--${variant}`,
        `k-btn--${size}`,
        block && "k-btn--block",
        iconOnly && "k-btn--icon",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 size={size === "sm" ? 15 : 18} className="k-btn__spin" />}
      {children}
    </button>
  );
}
