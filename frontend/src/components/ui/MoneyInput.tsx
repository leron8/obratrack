"use client";

import { useState, useCallback, useRef, useEffect, type ChangeEvent, type FocusEvent } from "react";
import { cn, formatMoneyDisplay, parseMoneyInput } from "../../lib/utils";

type MoneyInputProps = {
  /** Raw numeric string (e.g. "10000" or ""). The parent owns this value. */
  value: string;
  /** Called with the cleaned raw numeric string on every change. */
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  min?: number;
  id?: string;
  /** When true, a "–" is displayed for zero/empty values. Default false. */
  showDashForZero?: boolean;
};

/**
 * A money/number input that:
 *  - Displays formatted value (10,000.00) when not focused.
 *  - Shows the raw numeric value when focused for easy editing.
 *  - Strips invalid characters on input.
 *  - Re-formats on blur.
 *  - Never stores commas or symbols in the parent state.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder = "0.00",
  className,
  required = false,
  disabled = false,
  min,
  id,
  showDashForZero = false
}: MoneyInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [localDisplay, setLocalDisplay] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInteracted = useRef(false);

  // Build the display value based on focus and the raw value
  const displayValue = isFocused ? localDisplay : formatMoneyDisplay(value);

  // When the external value changes while not focused, sync
  useEffect(() => {
    if (!isFocused && !hasInteracted.current) {
      setLocalDisplay(value);
    }
  }, [value, isFocused]);

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      // Show raw value without formatting
      setLocalDisplay(value);
      // Place cursor at the end
      setTimeout(() => {
        const len = value.length;
        e.target.setSelectionRange(len, len);
      }, 0);
    },
    [value]
  );

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Format the value
    const cleaned = parseMoneyInput(localDisplay);
    onChange(cleaned);
    setLocalDisplay(cleaned);
    hasInteracted.current = true;
  }, [localDisplay, onChange]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Allow digits, dot, and minus sign
      const cleaned = raw.replace(/[^0-9.-]/g, "");
      setLocalDisplay(cleaned);
      // Immediately propagate the cleaned raw value
      onChange(cleaned);
    },
    [onChange]
  );

  const showDash = showDashForZero && !isFocused && (!value || Number(value) === 0);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={showDash ? "–" : displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      min={min}
      className={cn(
        "w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20",
        (Number(value) < 0) && !isFocused ? "text-rose-300" : "",
        className
      )}
    />
  );
}