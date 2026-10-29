import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateSubscriptionPaymentDto {
  @ApiProperty({
    example: 'd060fbee-39bc-44fe-ab7e-aaf5f12b806d',
    description: 'Subscription Plan UUID (Free, Silver, Gold, or Diamond)',
  })
  @IsUUID('4', { message: 'subscribeId must be a valid UUID' })
  @IsNotEmpty({ message: 'subscribeId is required' })
  subscribeId!: string;
}
