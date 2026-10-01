import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import type { Paginated } from '@card-trader/shared';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

/** Cursor pagination. The cursor is the id of the last item from the previous page. */
export class CursorQueryDto {
  @ApiPropertyOptional({ description: 'id of the last item on the previous page' })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;
}

export function pageArgs(query: CursorQueryDto): { take: number; skip?: number; cursor?: { id: string } } {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  return query.cursor ? { take: limit + 1, skip: 1, cursor: { id: query.cursor } } : { take: limit + 1 };
}

/** Rows were fetched with take = limit + 1; the extra row signals another page. */
export function toPage<TRow extends { id: string }, TOut>(
  rows: TRow[],
  query: CursorQueryDto,
  map: (row: TRow) => TOut,
): Paginated<TOut> {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  return {
    data: pageRows.map(map),
    nextCursor: hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null,
  };
}
