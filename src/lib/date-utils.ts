/**
 * Parses a date input (YYYY-MM-DD string or ISO) to a UTC-midnight Date.
 * Avoids timezone shift bugs where local parsing drops a day.
 */
export function parseDateInput(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    return new Date(
      Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate())
    );
  }
  const s = String(input);
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymd) {
    return new Date(`${s}T00:00:00.000Z`);
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

/**
 * Formats a Date to YYYY-MM-DD using the local calendar day.
 * Safe for <input type="date"> values.
 */
export function formatDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
