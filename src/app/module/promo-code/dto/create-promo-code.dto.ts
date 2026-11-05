import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePromoCodeDto {
  @ApiProperty({
    example: 'WELCOME',
    description: 'Code Name (Figma: "Code Name")',
  })
  @IsString()
  @IsNotEmpty({ message: 'Code Name is required' })
  code!: string;

  @ApiProperty({
    example: 5,
    description: 'Code Discount ($ amount, Figma: "Code Discount")',
  })
  @IsNumber()
  @Min(1, { message: 'Code Discount must be at least $1' })
  discount!: number;

  @ApiProperty({
    example: 150,
    description:
      'Claimed User (Max claim limit, Figma: "Claimed User" / "Claimed")',
  })
  @IsInt()
  @Min(1, { message: 'Claimed User must be at least 1' })
  claimedUser!: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Activity switch (Figma: "Activity" toggle ON/OFF)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
