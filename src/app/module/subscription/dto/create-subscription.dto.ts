import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'Silver' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @ApiProperty({ example: 'Save 5% on every lead' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  subTitle!: string;

  @ApiProperty({ example: 4900, description: 'Price in cents' })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  price!: number;

  @ApiProperty({ example: 5, description: 'Lead discount percentage' })
  @IsInt()
  @Min(0)
  @Max(100)
  discount!: number;
}
