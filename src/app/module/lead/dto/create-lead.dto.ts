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

function transformStringArray({ value }: { value: any }): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
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
    example: 'd060fbee-39bc-44fe-ab7e-aaf5f12b806d',
    description: 'Category ID (e.g., Foreclosure, Pre-Foreclosure)',
  })
  @IsString()
  @IsNotEmpty({ message: 'categoryId is required' })
  categoryId!: string;

  @ApiPropertyOptional({
    example: '2026-12-05T14:30:00.000Z',
    description: 'Lead or Auction Sale Date (ISO Date string)',
  })
  @IsDateString({}, { message: 'saleDate must be a valid ISO date string' })
  @IsOptional()
  saleDate?: string;

  @ApiPropertyOptional({
    example: 'Notice of Default',
    description: 'Stage of the foreclosure (e.g. Notice of Default, Auction)',
  })
  @IsOptional()
  @IsString()
  stage?: string;

  @ApiPropertyOptional({
    example: 'Conventional',
    description: 'Mortgage information (e.g. Conventional, FHA, balance details)',
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
    example: 5,
    description: 'Maximum number of times this lead can be shared',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'sharedLimit must be an integer' })
  @Min(1)
  sharedLimit?: number;

  @ApiPropertyOptional({
    description:
      'Optional manual price override in cents (e.g., 2500 for $25). If empty, category default price will be used automatically.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'priceCents must be an integer' })
  @Min(0)
  priceCents?: number;

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
    description: 'Property type (Single Family, Multi Family, Commercial, etc.)',
  })
  @IsOptional()
  @IsString()
  propertyType?: string;

  @ApiPropertyOptional({
    example: '1040 Biscayne Blvd',
    description: 'Property street address',
  })
  @IsOptional()
  @IsString()
  propertyAddress?: string;

  @ApiPropertyOptional({ example: 'Apt 14B', description: 'Unit or apartment number' })
  @IsOptional()
  @IsString()
  unitNumber?: string;

  @ApiPropertyOptional({ example: 'Miami', description: 'City name' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'FL', description: 'State code or name' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '33132', description: 'ZIP code' })
  @IsOptional()
  @IsString()
  zipcode?: string;

  @ApiPropertyOptional({ example: 'Miami-Dade County', description: 'County name' })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiPropertyOptional({
    example: 520000,
    description: 'Estimated property value',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'estValue must be an integer' })
  @Min(0)
  estValue?: number;

  @ApiPropertyOptional({
    example: 140000,
    description: 'Estimated equity amount',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'estEquity must be an integer' })
  @Min(0)
  estEquity?: number;

  @ApiPropertyOptional({
    example: 380000,
    description: 'Mortgage loan balance',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'mortgageBalance must be an integer' })
  @Min(0)
  mortgageBalance?: number;

  @ApiPropertyOptional({
    example: 'Robert',
    description: 'Property owner first name',
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    example: 'Martinez',
    description: 'Property owner last name',
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['(305) 555-0199'],
    description: 'List of owner phone numbers',
  })
  @IsOptional()
  @Transform(transformStringArray)
  @IsArray({ message: 'phoneNumbers must be an array' })
  @IsString({ each: true, message: 'Each phone number must be a string' })
  phoneNumbers?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['robert.m@example.com'],
    description: 'List of owner email addresses',
  })
  @IsOptional()
  @Transform(transformStringArray)
  @IsArray({ message: 'emailAddresses must be an array' })
  @IsString({ each: true, message: 'Each email address must be a string' })
  emailAddresses?: string[];
}
