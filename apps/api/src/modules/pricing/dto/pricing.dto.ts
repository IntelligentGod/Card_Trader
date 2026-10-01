import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min, Validate, ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';
import { parseTierKey, VALUE_RANGES, type ValueRange } from '@card-trader/shared';

@ValidatorConstraint({ name: 'isTierKey' })
export class IsTierKeyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && value.length <= 40 && parseTierKey(value) !== null;
  }
  defaultMessage(): string {
    return 'tier must look like RAW, RAW:NEAR_MINT or GRADED:PSA:10';
  }
}

export class TierQueryDto {
  @ApiPropertyOptional({ example: 'GRADED:PSA:10', default: 'RAW' })
  @IsOptional()
  @Validate(IsTierKeyConstraint)
  tier?: string;
}

export class SalesQueryDto extends TierQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class RangeQueryDto {
  @ApiPropertyOptional({ enum: VALUE_RANGES, default: '30d' })
  @IsOptional()
  @IsIn(VALUE_RANGES)
  range?: ValueRange;
}

export class ValueHistoryQueryDto extends TierQueryDto {
  @ApiPropertyOptional({ enum: VALUE_RANGES, default: '30d' })
  @IsOptional()
  @IsIn(VALUE_RANGES)
  range?: ValueRange;
}
