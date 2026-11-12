import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({
    description: 'Current account password for deletion confirmation',
    example: 'SecretPassword123!',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({
    description: 'Optional reason for account deletion',
    example: 'No longer investing in this market',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
