import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import type { CreateReviewRequest } from '@card-trader/shared';
import { SanitizedText } from '../../../common/validation/transforms';

export class CreateReviewDto implements CreateReviewRequest {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @SanitizedText({ emptyToNull: true })
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(1000)
  comment?: string | null;
}
