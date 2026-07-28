import * as React from "react";
import { cn } from "@/lib/utils";

// Form primitives. `Field` handles the label / hint / error scaffolding;
// Input / Select / Textarea are the styled controls (login-quality focus ring).

export interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn("k-field", error && "k-field--error", className)}>
      {label && (
        <label className="k-field__label" htmlFor={htmlFor}>
          {label}
          {required && <span className="k-field__req">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="k-field__error">{error}</span>
      ) : (
        hint && <span className="k-field__hint">{hint}</span>
      )}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn("k-input", className)} {...rest} />;
  },
);

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn("k-select", className)} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn("k-textarea", className)} {...rest} />;
});
