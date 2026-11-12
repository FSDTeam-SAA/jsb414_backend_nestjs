import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateDeletionRequestDto {
  @ApiProperty({
    description: 'Reason for requesting account deletion (Figma: Reason text area)',
    example: "I can't continue this platform.",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  reason: string;
}
