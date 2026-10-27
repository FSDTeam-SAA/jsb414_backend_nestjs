import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateWalletDto {
  @ApiProperty({
    example: 10000,
    description:
      'Amount in cents to add to wallet (e.g., $100 = 10000, $250 = 25000, $500 = 50000)',
  })
  @Type(() => Number)
  @IsInt({ message: 'amountCents must be an integer' })
  @Min(100, { message: 'Minimum top up amount is $1.00 (100 cents)' })
  @IsNotEmpty({ message: 'amountCents is required' })
  amountCents!: number;

  @ApiPropertyOptional({
    example: 'pm_card_visa',
    description: 'Stripe Payment Method ID (ঐচ্ছিক)',
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}
