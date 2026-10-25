// src/app/module/card/dto/bulk-add-to-cart.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class BulkAddToCartDto {
  @ApiProperty({
    example: 250,
    description: 'Number of leads to automatically add to cart (e.g., 50, 100, 250)',
  })
  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  @Max(1000, { message: 'quantity cannot exceed 1000' })
  @IsNotEmpty({ message: 'quantity is required' })
  quantity!: number;

  @ApiPropertyOptional({
    enum: ['SHARED', 'EXCLUSIVE'],
    example: 'SHARED',
    default: 'SHARED',
    description: 'Purchase type for all auto-picked leads (SHARED or EXCLUSIVE)',
  })
  @IsOptional()
  @IsIn(['SHARED', 'EXCLUSIVE'], {
    message: 'priceType must be either SHARED or EXCLUSIVE',
  })
  priceType?: 'SHARED' | 'EXCLUSIVE';

  @ApiPropertyOptional({
    example: 'd060fbee-39bc-44fe-ab7e-aaf5f12b806d',
    description: 'Optional category filter for auto-picking leads',
  })
  @IsOptional()
  @IsUUID('4', { message: 'categoryId must be a valid UUID' })
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'FL',
    description: 'Optional state filter for auto-picking leads',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    example: 'Miami',
    description: 'Optional city filter for auto-picking leads',
  })
  @IsOptional()
  @IsString()
  city?: string;
}
