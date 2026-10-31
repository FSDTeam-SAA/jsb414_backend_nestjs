import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, Max, Min, ValidateIf } from 'class-validator';
import { PriceType } from '../../../../../prisma/generated/prisma/enums';

export class CreateAgePriceDto {
  @ApiProperty({
    example: 0,
    minimum: 0,
    description: 'Minimum age of lead in days (e.g. 0)',
  })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  minDays!: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 7,
    description:
      'Maximum age of lead in days (leave null or omit for no upper limit, e.g. 91+)',
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  maxDays?: number | null;

  @ApiProperty({
    example: 15,
    description:
      'Discount percentage (0 to 100). E.g. 15 means 15% discount off category base price',
  })
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent!: number;

  @ApiProperty({
    enum: PriceType,
    example: PriceType.SHARED,
  })
  @IsEnum(PriceType)
  priceType!: PriceType;
}
