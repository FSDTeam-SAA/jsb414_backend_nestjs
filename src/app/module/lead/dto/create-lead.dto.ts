// src/app/module/lead/dto/create-lead.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

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
    description: 'Lead or Auction Sale Date',
  })
  @IsDateString({}, { message: 'saleDate must be a valid ISO date string' })
  @IsNotEmpty({ message: 'saleDate is required' })
  saleDate!: string;

  @ApiProperty({
    example: 'Notice of Default',
    description: 'Stage of the lead/foreclosure',
  })
  @IsString()
  @IsNotEmpty({ message: 'stage is required' })
  stage!: string;

  @ApiProperty({
    example: '$450,000 balance with Wells Fargo',
    description: 'Mortgage and lender details',
  })
  @IsString()
  @IsNotEmpty({ message: 'mortgageInformation is required' })
  mortgageInformation!: string;

  @ApiProperty({
    example: 'CSV Provider',
    description: 'Source of the lead (CSV Provider, API, Meta Ads, etc.)',
  })
  @IsString()
  @IsNotEmpty({ message: 'source is required' })
  source!: string;

  @ApiProperty({
    example: 'Shared',
    enum: ['Shared', 'Exclusive'],
    description: 'Availability model (Shared or Exclusive)',
  })
  @IsString()
  @IsNotEmpty({ message: 'availablility is required' })
  availablility!: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional property image URL',
  })
  @IsOptional()
  @IsString()
  propertyImage?: string;

  @ApiProperty({
    example: 'Single Family',
    description:
      'Property type (Single Family, Multi Family, Commercial, etc.)',
  })
  @IsString()
  @IsNotEmpty({ message: 'propertyType is required' })
  propertyType!: string;

  @ApiProperty({
    example: '123 Main Street',
    description: 'Property street address',
  })
  @IsString()
  @IsNotEmpty({ message: 'propertyAddress is required' })
  propertyAddress!: string;

  @ApiProperty({ example: 'Anaheim', description: 'City name' })
  @IsString()
  @IsNotEmpty({ message: 'city is required' })
  city!: string;

  @ApiProperty({ example: 'CA', description: 'State code or name' })
  @IsString()
  @IsNotEmpty({ message: 'state is required' })
  state!: string;

  @ApiProperty({ example: '92801', description: 'ZIP code' })
  @IsString()
  @IsNotEmpty({ message: 'zipcode is required' })
  zipcode!: string;

  @ApiProperty({
    example: 685000,
    description: 'Estimated property value',
  })
  @Type(() => Number)
  @IsInt({ message: 'estValue must be an integer' })
  @Min(0)
  @IsNotEmpty({ message: 'estValue is required' })
  estValue!: number;

  @ApiPropertyOptional({
    example: 240000,
    description: 'Estimated equity amount',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'estEquity must be an integer' })
  @Min(0)
  estEquity?: number;

  @ApiProperty({ example: 'John', description: 'Property owner first name' })
  @IsString()
  @IsNotEmpty({ message: 'firstName is required' })
  firstName!: string;

  @ApiProperty({ example: 'Smith', description: 'Property owner last name' })
  @IsString()
  @IsNotEmpty({ message: 'lastName is required' })
  lastName!: string;

  @ApiProperty({
    type: [String],
    example: ['+1 (714) 555-0199', '+1 (714) 555-0123'],
    description: 'List of owner phone numbers',
  })
  @IsArray({ message: 'PhoneNumber must be an array' })
  @ArrayNotEmpty({ message: 'PhoneNumber array cannot be empty' })
  @IsString({ each: true, message: 'Each phone number must be a string' })
  PhoneNumber!: string[];

  @ApiProperty({
    type: [String],
    example: ['john.smith@gmail.com', 'jsmith@work.com'],
    description: 'List of owner email addresses',
  })
  @IsArray({ message: 'emailAddress must be an array' })
  @ArrayNotEmpty({ message: 'emailAddress array cannot be empty' })
  @IsString({ each: true, message: 'Each email address must be a string' })
  emailAddress!: string[];
}
