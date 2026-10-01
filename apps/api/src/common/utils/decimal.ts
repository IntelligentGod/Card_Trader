import { Prisma } from '@prisma/client';

export function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value.toString());
}

/** Postgres SUM() over ints returns bigint; convert safely for JSON. */
export function bigintToNumber(value: bigint | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(n)) throw new Error('Money amount exceeds safe integer range');
  return n;
}
