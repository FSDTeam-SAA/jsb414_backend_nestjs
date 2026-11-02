import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateContactupDto {
  @ApiProperty({
    description: 'Subject of the contact message',
    example: 'Question about Silver membership plan',
  })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({
    description: 'Detailed contact message',
    example: 'Hello, I have a question regarding lead downloads in my account.',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;
}
