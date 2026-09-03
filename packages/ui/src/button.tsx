import type { ButtonHTMLAttributes } from "react";
import { cn } from "./styles";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

const variants = {
  primary:
    "bg-[var(--purple)] text-white shadow-sm hover:bg-[var(--purple-dark)]",
  secondary:
    "border border-[var(--border)] bg-white text-[var(--ink)] hover:bg-[var(--surface-muted)]",
  ghost: "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)]",
  danger: "bg-[var(--danger)] text-white hover:brightness-95",
};

const sizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export function Button({
  className,
  type = "button",
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
