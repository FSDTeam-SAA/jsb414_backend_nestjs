import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class AddToCartDto {
  @ApiProperty({
    example: '2886b885-7d55-477d-b6fd-0f9304babaa3',
    description: 'Lead UUID to add to cart',
  })
  @IsUUID('4', { message: 'leadId must be a valid UUID' })
  @IsNotEmpty({ message: 'leadId is required' })
  leadId!: string;

  @ApiPropertyOptional({
    enum: ['SHARED', 'EXCLUSIVE'],
    example: 'SHARED',
    default: 'SHARED',
    description:
      'Purchase type: SHARED (shared lead) or EXCLUSIVE (exclusive lead)',
  })
  @IsOptional()
  @IsIn(['SHARED', 'EXCLUSIVE'], {
    message: 'priceType must be either SHARED or EXCLUSIVE',
  })
  priceType?: 'SHARED' | 'EXCLUSIVE';
}

export class AddToCartMultipolDto {
  @ApiProperty({
    type: [AddToCartDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AddToCartDto)
  cartData!: AddToCartDto[];
}
