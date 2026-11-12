import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class ReportsSummaryQueryDto {
  @ApiPropertyOptional({
    description: 'Filter time period',
    enum: ['all', 'today', 'week', 'month', 'year'],
    default: 'month',
  })
  @IsOptional()
  @IsEnum(['all', 'today', 'week', 'month', 'year'])
  period?: 'all' | 'today' | 'week' | 'month' | 'year' = 'month';

  @ApiPropertyOptional({ description: 'Custom start date (ISO date string)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Custom end date (ISO date string)' })
  @IsOptional()
  @IsString()
  endDate?: string;
}

export class RevenueTrendQueryDto {
  @ApiPropertyOptional({
    description: 'Trend grouping (Figma dropdown: Monthly, Weekly, Daily)',
    enum: ['monthly', 'weekly', 'daily'],
    default: 'monthly',
  })
  @IsOptional()
  @IsEnum(['monthly', 'weekly', 'daily'])
  timeline?: 'monthly' | 'weekly' | 'daily' = 'monthly';

  @ApiPropertyOptional({
    description: 'Calendar year for trend analysis',
    default: 2026,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number = new Date().getFullYear();
}

export class ReportsPaginationDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Limit per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number = 10;
}

export class ExportReportDto {
  @ApiPropertyOptional({
    description: 'Report dataset to export as CSV',
    enum: ['summary', 'revenue-trend', 'top-customers', 'category-performance'],
    default: 'summary',
  })
  @IsOptional()
  @IsEnum(['summary', 'revenue-trend', 'top-customers', 'category-performance'])
  type?: 'summary' | 'revenue-trend' | 'top-customers' | 'category-performance' = 'summary';

  @ApiPropertyOptional({ description: 'Calendar year for trend export', default: 2026 })
  @IsOptional()
  @Type(() => Number)
  year?: number = new Date().getFullYear();
}

// ১. Figma Screen 1: Shared vs Exclusive কার্ড ও প্রগ্রেস বার DTO
export class SharedVsExclusiveQueryDto {
  @ApiPropertyOptional({
    description: 'Toggle view by revenue or leads sold (Figma: [Revenue] vs [Leads Sold] buttons)',
    enum: ['revenue', 'leadsSold'],
    default: 'revenue',
  })
  @IsOptional()
  @IsEnum(['revenue', 'leadsSold'])
  viewBy?: 'revenue' | 'leadsSold' = 'revenue';
}

// ২. Figma Screen 2: Revenue by Lead Category টেবিল DTO
export class CategorySalesTableQueryDto {
  @ApiPropertyOptional({
    description: 'Search categories or lead types (Figma: Search categories...)',
    example: 'Foreclosure',
  })
  @IsOptional()
  @IsString()
  searchTerm?: string;

  @ApiPropertyOptional({
    description: 'Filter by availability (Shared or Exclusive)',
    enum: ['SHARED', 'EXCLUSIVE', 'ALL'],
  })
  @IsOptional()
  @IsString()
  availability?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page (Figma: 25, 50, 100)', default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number = 25;
}

// ৩. Figma Screen 3: Revenue by Location টেবিল DTO
export class LocationSalesTableQueryDto {
  @ApiPropertyOptional({
    description: 'Search city, state, county or zip (Figma: Search city, country or zip...)',
    example: 'Florida',
  })
  @IsOptional()
  @IsString()
  searchTerm?: string;

  @ApiPropertyOptional({
    description: 'Filter by availability (Shared or Exclusive)',
    enum: ['SHARED', 'EXCLUSIVE', 'ALL'],
  })
  @IsOptional()
  @IsString()
  availability?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page (Figma: 25, 50, 100)', default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number = 25;
}
