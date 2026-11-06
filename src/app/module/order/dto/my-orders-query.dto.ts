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

export class MyOrdersQueryDto {
  @ApiPropertyOptional({
    description: 'Search by order number, customer name, email, city, state, or zip',
    example: 'FG-ORD',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  searchTerm?: string;

  @ApiPropertyOptional({
    description: 'Filter by order status',
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    example: 'COMPLETED',
  })
  @IsOptional()
  @IsIn(['PENDING', 'COMPLETED', 'FAILED'])
  status?: 'PENDING' | 'COMPLETED' | 'FAILED';

  @ApiPropertyOptional({
    description: 'Filter orders created on or after this date (ISO string or YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter orders created on or before this date (ISO string or YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by lead category / type (e.g. Foreclosure, Tax Lien, etc.)',
  })
  @IsOptional()
  @IsString()
  leadType?: string;

  @ApiPropertyOptional({
    description: 'Filter by property type (e.g. Single Family, Condo, etc.)',
  })
  @IsOptional()
  @IsString()
  propertyType?: string;

  @ApiPropertyOptional({
    description: 'Filter by availability / price type',
    enum: ['SHARED', 'EXCLUSIVE'],
  })
  @IsOptional()
  @IsIn(['SHARED', 'EXCLUSIVE'])
  availability?: 'SHARED' | 'EXCLUSIVE';

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
    default: 'createdAt',
    enum: ['createdAt', 'totalAmount'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'totalAmount'])
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
