import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export enum BadLeadReason {
  INVALID_PHONE = 'INVALID_PHONE', // Invalid/disconnected phone
  INVALID_EMAIL = 'INVALID_EMAIL', // Invalid email
  INCORRECT_CONTACT = 'INCORRECT_CONTACT', // Incorrect contact/person
  INCORRECT_PROPERTY = 'INCORRECT_PROPERTY', // Incorrect property information
  DUPLICATE_PURCHASE = 'DUPLICATE_PURCHASE', // Duplicate previously purchased lead
  OUTDATED_DATA = 'OUTDATED_DATA', // Materially inaccurate/outdated data
  OTHER = 'OTHER', // Other + explanation
}

export class SubmitBadLeadRequestDto {
  @ApiProperty({
    example: '2b3e63da-8ca1-4135-b6cd-59e141d626fa',
    description: 'The purchased lead ID to report as bad/inaccurate',
  })
  @IsUUID('4')
  @IsNotEmpty()
  leadId: string;

  @ApiProperty({
    enum: BadLeadReason,
    example: BadLeadReason.INVALID_PHONE,
    description: 'Reason for requesting account credit',
  })
  @IsEnum(BadLeadReason)
  @IsNotEmpty()
  reason: BadLeadReason;

  @ApiPropertyOptional({
    example: 'The primary phone number is disconnected when called.',
    description: 'Additional explanation or notes from customer',
  })
  @IsOptional()
  @IsString()
  explanation?: string;
}

export class ReviewBadLeadRequestDto {
  @ApiProperty({
    enum: ['APPROVED', 'REJECTED'],
    example: 'APPROVED',
    description: 'Admin review decision',
  })
  @IsEnum(['APPROVED', 'REJECTED'])
  @IsNotEmpty()
  status: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({
    example: 'Verified disconnected number. Returned $20.19 account credit to wallet.',
    description: 'Admin internal notes / reason for rejection or approval',
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}
