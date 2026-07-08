"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
};

const sizeClasses: Record<NonNullable<DialogProps["size"]>, string> = {
  md: "max-w-2xl",
  lg: "max-w-4xl"
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md"
}: DialogProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        aria-label="Cerrar dialogo"
        className="absolute inset-0 cursor-default bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        aria-modal="true"
        role="dialog"
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950 shadow-[0_32px_120px_rgba(2,6,23,0.88)]",
          sizeClasses[size]
        )}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {description ? <p className="mt-2 text-sm text-slate-400">{description}</p> : null}
          </div>
          <button
            aria-label="Cerrar dialogo"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-400 transition hover:border-slate-700 hover:text-white"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>

        {footer ? <div className="border-t border-slate-800 px-6 py-5">{footer}</div> : null}
      </div>
    </div>
  );
}
