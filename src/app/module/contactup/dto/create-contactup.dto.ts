import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateContactupDto {
  @ApiPropertyOptional({
    description: 'Type of submission: CONTACT or SUPPORT',
    example: 'CONTACT',
    default: 'CONTACT',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'First name of the sender',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name of the sender',
    example: 'Smith',
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description:
      'Full name (can be auto-constructed from firstName and lastName)',
    example: 'John Smith',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Email address of the sender',
    example: 'john@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Contact phone number',
    example: '(555) 000-0000',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description:
      'Issue type or lead interest (stored as plain string, no enum, handled by frontend)',
    example: 'Tax Foreclosure',
  })
  @IsOptional()
  @IsString()
  issueType?: string;

  @ApiPropertyOptional({
    description: 'Alias for issueType (from Send Us A Message form)',
    example: 'Mortgage Foreclosure',
  })
  @IsOptional()
  @IsString()
  interestedIn?: string;

  @ApiPropertyOptional({
    description: 'Subject of the message / support request',
    example: 'Question about Lead Volume',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    description: 'Detailed message body',
    example: 'Hello, I would like to inquire about monthly lead volume...',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    description: 'Alias for message (from Submit Support Request form)',
    example: 'Please describe your issue in detail...',
  })
  @IsOptional()
  @IsString()
  describeYourIssue?: string;
}
