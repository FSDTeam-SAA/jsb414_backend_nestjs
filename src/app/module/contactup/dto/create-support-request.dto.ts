import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSupportRequestDto {
  @ApiProperty({
    description: 'First name of the requester',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName!: string;

  @ApiProperty({
    description: 'Last name of the requester',
    example: 'Smith',
  })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  lastName!: string;

  @ApiProperty({
    description: 'Email address of the requester',
    example: 'your@email.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email address is required' })
  email!: string;

  @ApiPropertyOptional({
    description: 'Optional phone number',
    example: '(555) 000-0000',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description:
      'Issue type selected from frontend dropdown (stored as plain string, no enum)',
    example: 'Billing Issue',
  })
  @IsOptional()
  @IsString()
  issueType?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the issue',
    example:
      'Please describe your issue in detail — the more specific you are, the faster we can resolve it.',
  })
  @IsOptional()
  @IsString()
  describeYourIssue?: string;

  @ApiPropertyOptional({
    description: 'Alternative alias for describeYourIssue',
    example: 'I am unable to download my purchased leads.',
  })
  @IsOptional()
  @IsString()
  message?: string;
}
