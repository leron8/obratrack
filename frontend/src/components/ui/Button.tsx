import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:hover:bg-cyan-400",
  secondary: "border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-600 hover:bg-slate-800",
  ghost: "text-slate-300 hover:bg-slate-900 hover:text-white",
  danger: "bg-rose-500 text-white hover:bg-rose-400 disabled:hover:bg-rose-500"
};

export function Button({ className, variant = "secondary", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
