/** All money is integer cents (USD for the MVP). Never use floats for amounts. */

export function formatCents(cents: number, options: { showCents?: boolean } = {}): string {
  // Whole-dollar amounts read cleaner at a glance ($220, not $220.00).
  const showCents = options.showCents ?? cents % 100 !== 0;
  const dollars = Math.abs(cents) / 100;
  const formatted = dollars.toLocaleString('en-US', {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
  return `${cents < 0 ? '-' : ''}$${formatted}`;
}

export function formatSignedCents(cents: number): string {
  if (cents === 0) return '$0';
  return `${cents > 0 ? '+' : '-'}${formatCents(Math.abs(cents))}`;
}

/** Percent change from `previous` to `current`; null when there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

/** Parses a user-entered dollar string ("12", "12.5", "$1,200.99") to cents. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole = '0', fraction = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
