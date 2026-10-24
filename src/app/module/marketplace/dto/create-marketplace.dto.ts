// src/app/module/marketplace/dto/marketplace-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum MarketplaceSortBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  PRICE_LOW = 'price_low',
  PRICE_HIGH = 'price_high',
  LOCATION = 'location',
}

export enum FreshnessFilter {
  TODAY = 'today',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
}

export class MarketplaceQueryDto {
  @ApiPropertyOptional({
    description: 'Category ID (e.g. Foreclosure, Probate)',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'CA' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'Orange County' })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiPropertyOptional({ example: 'Anaheim' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: '92801' })
  @IsOptional()
  @IsString()
  zipcode?: string;

  @ApiPropertyOptional({ example: 'Single Family' })
  @IsOptional()
  @IsString()
  propertyType?: string;

  @ApiPropertyOptional({
    enum: ['SHARED', 'EXCLUSIVE', 'BOTH'],
    example: 'SHARED',
  })
  @IsOptional()
  @IsString()
  availability?: string;

  @ApiPropertyOptional({
    enum: FreshnessFilter,
    example: FreshnessFilter.LAST_7_DAYS,
  })
  @IsOptional()
  @IsEnum(FreshnessFilter)
  freshness?: FreshnessFilter;

  @ApiPropertyOptional({
    description: 'Filter leads with available phone numbers',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasPhone?: boolean;

  @ApiPropertyOptional({
    description: 'Filter leads with available email addresses',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasEmail?: boolean;

  @ApiPropertyOptional({ example: 250000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minEstValue?: number;

  @ApiPropertyOptional({ example: 1000000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxEstValue?: number;

  @ApiPropertyOptional({
    enum: MarketplaceSortBy,
    default: MarketplaceSortBy.NEWEST,
  })
  @IsOptional()
  @IsEnum(MarketplaceSortBy)
  sortBy?: MarketplaceSortBy = MarketplaceSortBy.NEWEST;

  @ApiPropertyOptional({ default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    default: 25,
    example: 25,
    description: '25, 50, or 100',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 25;
}
