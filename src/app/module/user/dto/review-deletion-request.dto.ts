import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReviewDeletionRequestDto {
  @ApiProperty({
    description: 'Decision action (Figma: Approved [blue button] or Deny [red button])',
    enum: ['APPROVED', 'DENIED'],
    example: 'APPROVED',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['APPROVED', 'DENIED'])
  status: 'APPROVED' | 'DENIED';

  @ApiPropertyOptional({
    description: 'Optional admin notes or reason for approval/denial',
    example: 'Processed according to customer request.',
  })
  @IsString()
  @IsOptional()
  adminNotes?: string;
}
