// src/app/module/lead/dto/create-lead.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  LeadAvailability,
  LeadStatus,
} from '../../../../../prisma/generated/prisma/enums';

// Helper to handle form-data or JSON parsing for string arrays
function transformStringArray({ value }: { value: any }): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // If comma-separated
      if (value.includes(',')) {
        return value.split(',').map((s) => s.trim());
      }
    }
    return [value.trim()];
  }
  return [];
}

export class CreateLeadDto {
  @ApiProperty({
    example: 'b2f6c0b3-1e5b-4c28-9846-52c6f103d3c7',
    description: 'Category ID (e.g., Foreclosure, Pre-Foreclosure)',
  })
  @IsString()
  @IsNotEmpty({ message: 'categoryId is required' })
  categoryId!: string;

  @ApiProperty({
    example: '2026-11-20T10:00:00.000Z',
    description: 'Lead or Auction Sale Date (ISO Date string)',
  })
  @IsDateString({}, { message: 'saleDate must be a valid ISO date string' })
  @IsNotEmpty({ message: 'saleDate is required' })
  saleDate!: string;

  @ApiPropertyOptional({
    example: 'Foreclosure stage',
    description: 'Stage of the foreclosure (e.g. Notice of Default, Auction)',
  })
  @IsOptional()
  @IsString()
  stage?: string;

  @ApiPropertyOptional({
    example: 'Conventional',
    description:
      'Mortgage information (e.g. Conventional, FHA, balance details)',
  })
  @IsOptional()
  @IsString()
  mortgageInformation?: string;

  @ApiPropertyOptional({
    example: 'Internal',
    description: 'Source of the lead (e.g. Internal, CSV Provider, API)',
    default: 'Internal',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    enum: LeadAvailability,
    example: LeadAvailability.SHARED,
    description: 'Availability model (SHARED, EXCLUSIVE, BOTH)',
    default: LeadAvailability.SHARED,
  })
  @IsOptional()
  @IsEnum(LeadAvailability, {
    message: 'availability must be SHARED, EXCLUSIVE, or BOTH',
  })
  availability?: LeadAvailability;

  @ApiPropertyOptional({
    example: 10,
    description: 'Maximum number of times this lead can be shared',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'sharedLimit must be an integer' })
  @Min(1)
  sharedLimit?: number;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Custom price in cents or amount (e.g., $10 = 1000 cents)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'customPrice must be an integer' })
  @Min(0)
  customPrice?: number;

  @ApiPropertyOptional({
    enum: LeadStatus,
    example: LeadStatus.ACTIVE,
    description: 'Status of the lead (ACTIVE, INACTIVE, ARCHIVED)',
    default: LeadStatus.ACTIVE,
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Property image file (uploaded to Cloudinary)',
  })
  @IsOptional()
  @IsString()
  propertyImage?: string;

  @ApiPropertyOptional({
    example: 'Single Family',
    description:
      'Property type (Single Family, Multi Family, Commercial, etc.)',
  })
  @IsOptional()
  @IsString()
  propertyType?: string;

  @ApiPropertyOptional({
    example: 2000,
    description:
      'Custom price in cents. If empty, category default price will be used automatically.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'priceCents must be an integer' })
  @Min(0)
  priceCents?: number;

  @ApiPropertyOptional({
    example: '123 Main Street',
    description: 'Property street address',
  })
  @IsOptional()
  @IsString()
  propertyAddress?: string;

  @ApiPropertyOptional({ example: 'Anaheim', description: 'City name' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'CA', description: 'State code or name' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '92801', description: 'ZIP code' })
  @IsOptional()
  @IsString()
  zipcode?: string;

  @ApiPropertyOptional({
    example: 685000,
    description: 'Estimated property value',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'estValue must be an integer' })
  @Min(0)
  estValue?: number;

  @ApiPropertyOptional({
    example: 85000,
    description: 'Estimated equity amount',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'estEquity must be an integer' })
  @Min(0)
  estEquity?: number;

  @ApiPropertyOptional({
    example: 'Michael',
    description: 'Property owner first name',
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    example: 'Anderson',
    description: 'Property owner last name',
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['+0123 456 8910'],
    description: 'List of owner phone numbers',
  })
  @IsOptional()
  @Transform(transformStringArray)
  @IsArray({ message: 'phoneNumbers must be an array' })
  @IsString({ each: true, message: 'Each phone number must be a string' })
  phoneNumbers?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['michael.anderson@example.com'],
    description: 'List of owner email addresses',
  })
  @IsOptional()
  @Transform(transformStringArray)
  @IsArray({ message: 'emailAddresses must be an array' })
  @IsString({ each: true, message: 'Each email address must be a string' })
  emailAddresses?: string[];
}
