"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../lib/utils";

type ExpandableSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  /** Accent-colored focus ring applied while the input is open, e.g. "focus-within:ring-cyan-400/20". */
  ringClassName?: string;
};

/**
 * Compact, expandable search input used by the CRUD list header.
 *
 * It starts as a single magnifier button anchored to the right of its container.
 * On click the very same container expands horizontally toward the left (it never
 * opens a modal, dropdown or a new section) revealing the input, which receives
 * autofocus. `Escape` or the close button collapse it back to the compact state
 * and clear the value.
 *
 * Only the open/closed behaviour, expansion, focus management and keyboard
 * handling live here; the actual filtering logic belongs to the calling module.
 */
export function ExpandableSearch({
  value,
  onChange,
  placeholder = "Buscar registros...",
  ariaLabel = "Buscar registros",
  className,
  ringClassName = "focus-within:ring-cyan-400/20"
}: ExpandableSearchProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function closeSearch() {
    setOpen(false);
    onChange("");
  }

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div
      className={cn(
        "flex items-center justify-end transition-[width] duration-300 ease-in-out",
        open ? "w-full" : "w-12",
        className
      )}
    >
      <div
        className={cn(
          "flex h-12 w-full items-center gap-1 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-soft transition-all duration-300",
          open ? "px-3 focus-within:border-slate-600 focus-within:ring-4" : "justify-center px-2",
          open && ringClassName
        )}
      >
        <button
          type="button"
          onClick={() => (open ? closeSearch() : setOpen(true))}
          aria-label={ariaLabel}
          title={open ? "Cerrar busqueda" : ariaLabel}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition hover:bg-slate-800 hover:text-white",
            open ? "text-slate-400" : "text-slate-300"
          )}
        >
          <Search className="h-4 w-4" />
        </button>

        {open ? (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="h-9 w-full min-w-0 rounded-lg bg-transparent text-sm text-slate-100 outline-none transition focus:ring-2 placeholder:text-slate-500"
          />
        ) : null}

        {open ? (
          <button
            type="button"
            onClick={closeSearch}
            aria-label="Cerrar busqueda"
            title="Cerrar busqueda"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
