export const VALUE_RANGES = ['7d', '30d', '3m', '6m', '1y'] as const;
export type ValueRange = (typeof VALUE_RANGES)[number];

export const VALUE_RANGE_DAYS: Record<ValueRange, number> = {
  '7d': 7,
  '30d': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

export const VALUE_RANGE_LABELS: Record<ValueRange, string> = {
  '7d': '7D',
  '30d': '30D',
  '3m': '3M',
  '6m': '6M',
  '1y': '1Y',
};

export const MOVER_WINDOWS = ['1d', '7d', '30d'] as const;
export type MoverWindow = (typeof MOVER_WINDOWS)[number];
export const MOVER_WINDOW_DAYS: Record<MoverWindow, number> = { '1d': 1, '7d': 7, '30d': 30 };

export function isValueRange(value: string): value is ValueRange {
  return (VALUE_RANGES as readonly string[]).includes(value);
}
