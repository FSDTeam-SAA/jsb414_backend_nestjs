import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsUUID, Max, Min, ValidateIf } from "class-validator";
import { PriceType } from "../../../../../prisma/generated/prisma/enums";

export class CreateAgePriceDto {
  @ApiProperty({
    example: '9ab53a94-00b3-4792-8dc6-71ebe2466474',
  })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({
    enum: PriceType,
    example: PriceType.SHARED,
  })
  @IsEnum(PriceType)
  priceType!: PriceType;

  @ApiProperty({ example: 0, minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  minDays!: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 7,
    description: 'Use null for no upper limit',
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  maxDays?: number | null;

  @ApiProperty({
    example: 2000,
    description: 'Price in cents: 2000 = $20',
  })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  priceCents!: number;
}
