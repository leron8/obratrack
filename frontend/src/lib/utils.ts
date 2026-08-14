export function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Formats a numeric string or number to a display string with commas
 * and exactly 2 decimal places.
 *
 *   "10000"     → "10,000.00"
 *   "12500.5"   → "12,500.50"
 *   0           → "0.00"
 *   ""          → ""
 *   null        → ""
 */
export function formatMoneyDisplay(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";

  const num = typeof value === "string" ? Number(value) : value;
  if (isNaN(num)) return "";

  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Strips all non-numeric characters (except the decimal dot and minus sign)
 * from a money input string. Returns the cleaned raw number string.
 *
 *   "10,000.50"  → "10000.50"
 *   "$1,250.75"  → "1250.75"
 *   "abc"        → ""
 */
export function parseMoneyInput(raw: string): string {
  return raw.replace(/[^0-9.-]/g, "");
}

/**
 * Converts a YYYY-MM-DD date string to DD/MM/YYYY display format.
 *
 *   "2026-08-11"  → "11/08/2026"
 *   ""            → ""
 *   null          → ""
 */
export function formatDateDisplay(value: string | null | undefined): string {
  if (!value) return "";
  // Already in DD/MM/YYYY format?
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/**
 * Converts a DD/MM/YYYY display string back to YYYY-MM-DD for the backend.
 * Returns the original string if it doesn't match the expected pattern.
 *
 *   "11/08/2026"  → "2026-08-11"
 *   ""            → ""
 */
export function parseDateInput(display: string): string {
  if (!display) return "";

  const trimmed = display.trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return trimmed; // Return as-is if not in expected format

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}
