import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateInterestsDto {
  @ApiPropertyOptional({
    example: ['Foreclosure Leads', 'Pre-Foreclosure Leads'],
    type: [String],
    description: 'Selected lead types (Figma: Leads Type)',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  leadTypes?: string[];

  @ApiPropertyOptional({
    example: ['Florida', 'Texas'],
    type: [String],
    description: 'States of interest',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  interestedStates?: string[];

  @ApiPropertyOptional({
    example: ['Miami', 'Orlando'],
    type: [String],
    description: 'Cities of interest',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  interestedCities?: string[];
}
