import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ContactStatus } from '../../../../../prisma/generated/prisma/enums';
import { CreateContactupDto } from './create-contactup.dto';

export class UpdateContactupDto extends PartialType(CreateContactupDto) {
  @ApiPropertyOptional({
    description: 'Status of the contact message',
    enum: ContactStatus,
    example: ContactStatus.RESOLVED,
  })
  @IsOptional()
  @IsEnum(ContactStatus)
  status?: ContactStatus;

  @ApiPropertyOptional({
    description: 'Admin reply message',
    example: 'Thank you for reaching out, your issue has been resolved.',
  })
  @IsOptional()
  @IsString()
  adminReply?: string;
}
