import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ContactStatus } from '../../../../../prisma/generated/prisma/enums';

export class AdminReplyContactupDto {
  @ApiProperty({
    description: 'Admin reply message to the user',
    example:
      'Hello, your issue regarding your subscription has been resolved. Please check your account.',
  })
  @IsString()
  @IsNotEmpty()
  adminReply!: string;

  @ApiPropertyOptional({
    description: 'Updated ticket status',
    enum: ContactStatus,
    default: ContactStatus.RESOLVED,
    example: ContactStatus.RESOLVED,
  })
  @IsOptional()
  @IsEnum(ContactStatus)
  status?: ContactStatus;

  @ApiPropertyOptional({
    description: 'Whether to send an email notification to the user',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}
