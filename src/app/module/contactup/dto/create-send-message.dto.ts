import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSendMessageDto {
  @ApiProperty({
    description: 'First name of the sender',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName!: string;

  @ApiProperty({
    description: 'Last name of the sender',
    example: 'Smith',
  })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  lastName!: string;

  @ApiProperty({
    description: 'Contact phone number',
    example: '(555) 000-0000',
  })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phoneNumber!: string;

  @ApiProperty({
    description: 'Email address of the sender',
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email address is required' })
  email!: string;

  @ApiPropertyOptional({
    description:
      'Lead type or topic of interest selected from frontend dropdown (stored as plain string, no enum)',
    example: 'Tax Foreclosure',
  })
  @IsOptional()
  @IsString()
  interestedIn?: string;

  @ApiPropertyOptional({
    description: 'Alternative alias for interestedIn / issue category',
    example: 'Tax Foreclosure',
  })
  @IsOptional()
  @IsString()
  issueType?: string;

  @ApiProperty({
    description: 'Inquiry message',
    example:
      'Tell us about your business, target market, and monthly lead volume goals...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Message is required' })
  message!: string;
}
