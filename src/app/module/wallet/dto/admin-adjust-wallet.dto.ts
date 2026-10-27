import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class AdminAdjustWalletDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsUUID('4')
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    example: 5000,
    description:
      'Amount in cents (positive to add balance, negative to deduct)',
  })
  @Type(() => Number)
  @IsInt()
  amountCents!: number;

  @ApiProperty({ example: 'Customer loyalty bonus / support credit' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
