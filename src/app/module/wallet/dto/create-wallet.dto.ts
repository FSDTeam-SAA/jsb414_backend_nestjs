import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateWalletDto {
  @ApiProperty({ example: 2.5, description: 'USD dollars: 2.50 means $2.50' })
  @IsNumber({ maxDecimalPlaces: 2, allowInfinity: false, allowNaN: false })
  @Min(1)
  @Max(10000)
  amount!: number;

  @ApiPropertyOptional({
    description:
      'Optional UUID for retries. Backend generates one when omitted.',
  })
  @IsOptional()
  @IsUUID('4')
  requestId?: string;
}
