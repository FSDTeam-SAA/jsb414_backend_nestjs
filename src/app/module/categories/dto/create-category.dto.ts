import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: '' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: '' })
  @IsString()
  @IsOptional()
  description: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Logo of the category',
  })
  @IsString()
  @IsOptional()
  logo: string;

  @ApiPropertyOptional({ type: Boolean, example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: Boolean, example: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  agePricingEnabled?: boolean;

  @ApiPropertyOptional({ example: '' })
  @IsInt({ message: 'shared base price must be an integer' })
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  sharedBasePriceCents: number;

  @ApiPropertyOptional({ example: '' })
  @IsInt({ message: 'exclusive base price must be an integer' })
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  exclusiveBasePriceCents: number;
}
