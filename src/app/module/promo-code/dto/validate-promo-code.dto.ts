import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class ValidatePromoCodeDto {
  @ApiProperty({
    example: 'WELCOME',
    description: 'Enter promo code (Figma: "Enter promo code")',
  })
  @IsString()
  @IsNotEmpty({ message: 'Promo code is required' })
  code!: string;

  @ApiPropertyOptional({
    example: 50,
    description: 'Optional subtotal to calculate remaining final amount',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  subtotal?: number;
}
