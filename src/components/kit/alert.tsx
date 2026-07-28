import * as React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "error" | "success" | "warning" | "info";

const DEFAULT_ICON: Record<Tone, React.ReactNode> = {
  error: <AlertCircle size={16} />,
  success: <CheckCircle2 size={16} />,
  warning: <AlertCircle size={16} />,
  info: <AlertCircle size={16} />,
};

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: Tone;
  title?: React.ReactNode;
  /** Override the default tone icon; pass null to hide it. */
  icon?: React.ReactNode | null;
}

export function Alert({ tone = "info", title, icon, className, children, ...rest }: AlertProps) {
  const showIcon = icon === null ? null : icon ?? DEFAULT_ICON[tone];
  return (
    <div
      className={cn("k-alert", `k-alert--${tone}`, className)}
      role={tone === "error" ? "alert" : "status"}
      {...rest}
    >
      {showIcon && <span className="k-alert__icon">{showIcon}</span>}
      <div className="k-alert__body">
        {title && <div className="k-alert__title">{title}</div>}
        {children}
      </div>
    </div>
  );
}
