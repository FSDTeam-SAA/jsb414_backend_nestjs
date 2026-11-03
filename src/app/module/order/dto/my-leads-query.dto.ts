import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class MyLeadsQueryDto {
  @ApiPropertyOptional({
    description: 'Search across owner name, address, city, state, or phone',
    example: 'Miami',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  searchTerm?: string;

  @ApiPropertyOptional({ description: 'Filter by city', example: 'Orlando' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  city?: string;

  @ApiPropertyOptional({ description: 'Filter by state code', example: 'FL' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  state?: string;

  @ApiPropertyOptional({
    description: 'Filter by purchase type',
    enum: ['SHARED', 'EXCLUSIVE'],
    example: 'SHARED',
  })
  @IsOptional()
  @IsIn(['SHARED', 'EXCLUSIVE'])
  priceType?: 'SHARED' | 'EXCLUSIVE';

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page?: number;

  @ApiPropertyOptional({ description: 'Limit per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sort by field',
    default: 'purchasedAt',
    enum: ['purchasedAt', 'pricePaid'],
  })
  @IsOptional()
  @IsIn(['purchasedAt', 'pricePaid'])
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
