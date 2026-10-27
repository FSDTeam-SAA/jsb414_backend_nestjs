import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CheckoutDto {
  @ApiPropertyOptional({
    example: true,
    default: true,
    description:
      'Use account wallet balance if available (ফিগমার "Use Account Balance" চেকবক্স)',
  })
  @IsOptional()
  @IsBoolean()
  useAccountBalance?: boolean;

  @ApiPropertyOptional({
    example: 'pm_card_visa',
    description:
      'Stripe Payment Method ID (যদি ওয়ালেট ব্যালেন্স কম থাকে এবং কার্ড দিয়ে দিতে হয়)',
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}
