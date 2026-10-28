import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';

export class AdminAdjustWalletDto {
  @ApiProperty()
  @IsUUID('4')
  userId!: string;

  @ApiProperty({
    example: -2.5,
    description: 'USD dollars; negative deducts account credit',
  })
  @IsNumber({ maxDecimalPlaces: 2, allowInfinity: false, allowNaN: false })
  @Min(-10000)
  @Max(10000)
  @NotEquals(0)
  amount!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @ApiProperty({
    description: 'Reuse this UUID when retrying the same adjustment',
  })
  @IsUUID('4')
  requestId!: string;
}
