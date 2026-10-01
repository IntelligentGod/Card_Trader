/** All calendar dates are UTC for the MVP. */
export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}
