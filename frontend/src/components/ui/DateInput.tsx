"use client";

import { useState, useCallback, useRef, useEffect, type ChangeEvent, type FocusEvent } from "react";
import { Calendar } from "lucide-react";
import { cn, formatDateDisplay, parseDateInput } from "../../lib/utils";

type DateInputProps = {
  /** Date value in YYYY-MM-DD format (the backend format). */
  value: string;
  /** Called with the date in YYYY-MM-DD format on every change. */
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  label?: string;
};

/**
 * A date input that:
 *  - Displays dates in DD/MM/YYYY format.
 *  - Exposes a calendar picker via a hidden native <input type="date">.
 *  - Converts between DD/MM/YYYY (UI) and YYYY-MM-DD (backend).
 *  - Avoids timezone shifts by working exclusively with date strings.
 */
export function DateInput({
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  className,
  required = false,
  disabled = false,
  id
}: DateInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [localDisplay, setLocalDisplay] = useState("");
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const hasInteracted = useRef(false);

  // Build the display value: formatted DD/MM/YYYY when not focused,
  // raw user input when focused.
  const displayValue = isFocused ? localDisplay : formatDateDisplay(value);

  // Sync local display when external value changes
  useEffect(() => {
    if (!isFocused && !hasInteracted.current) {
      setLocalDisplay(formatDateDisplay(value));
    }
  }, [value, isFocused]);

  const openCalendar = useCallback(() => {
    if (disabled) return;
    // Sync the hidden input before opening
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = value;
      hiddenInputRef.current.showPicker?.();
    }
  }, [disabled, value]);

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      setLocalDisplay(formatDateDisplay(value) || "");
      setTimeout(() => {
        const len = formatDateDisplay(value).length;
        e.target.setSelectionRange(len, len);
      }, 0);
    },
    [value]
  );

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const parsed = parseDateInput(localDisplay);
    onChange(parsed);
    setLocalDisplay(parsed);
    hasInteracted.current = true;
  }, [localDisplay, onChange]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Allow digits and slashes only for the text input
      const cleaned = raw.replace(/[^0-9/]/g, "");
      setLocalDisplay(cleaned);

      // Auto-insert slash after day and month if user typed digits
      if (
        cleaned.length === 2 &&
        !cleaned.includes("/") &&
        raw.length > localDisplay.length
      ) {
        setLocalDisplay(cleaned + "/");
      } else if (
        cleaned.length === 5 &&
        cleaned.indexOf("/") === 2 &&
        raw.length > localDisplay.length
      ) {
        setLocalDisplay(cleaned + "/");
      }

      // Parse to YYYY-MM-DD and propagate
      const parsed = parseDateInput(cleaned);
      onChange(parsed);
    },
    [onChange, localDisplay]
  );

  const handleHiddenChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value; // YYYY-MM-DD
      if (newVal) {
        onChange(newVal);
        setLocalDisplay(formatDateDisplay(newVal));
      }
    },
    [onChange]
  );

  return (
    <div className="relative">
      <input
        ref={textInputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={cn(
          "w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 pr-10 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20",
          className
        )}
      />

      {/* Calendar icon button */}
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={openCalendar}
        aria-label="Abrir calendario"
        className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-300",
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
        )}
      >
        <Calendar className="h-4 w-4" />
      </button>

      {/* Hidden native date input to provide the browser calendar picker */}
      <input
        ref={hiddenInputRef}
        type="date"
        aria-hidden="true"
        tabIndex={-1}
        value={value}
        onChange={handleHiddenChange}
        className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
      />
    </div>
  );
}