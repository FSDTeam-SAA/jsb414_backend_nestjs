import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CheckoutOrderDto {
  @ApiPropertyOptional({
    description:
      'Specific cart item IDs to checkout (leave empty to checkout all items in cart)',
    example: ['e8a4a58b-03df-4fe3-90d0-7a87ea7102e3'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  cartItemIds?: string[];

  @ApiPropertyOptional({
    description: 'Whether to use available wallet balance towards payment',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  useWallet?: boolean;

  @ApiPropertyOptional({
    description: 'Promo code / coupon for additional discount (e.g. GOLD20)',
    example: 'GOLD20',
  })
  @IsOptional()
  @IsString()
  promoCode?: string;
}
