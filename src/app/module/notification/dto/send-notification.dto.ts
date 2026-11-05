import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { NotificationType } from '../../../../../prisma/generated/prisma/enums';

export class SendNotificationDto {
  @ApiProperty({ description: 'Recipient user ID' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Notification title' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification body message' })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiPropertyOptional({
    enum: NotificationType,
    default: 'SYSTEM',
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({
    description: 'Optional redirection URL or route path',
  })
  @IsOptional()
  @IsString()
  link?: string;
}

export class BroadcastNotificationDto {
  @ApiProperty({ description: 'Notification title' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification body message' })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiPropertyOptional({
    enum: NotificationType,
    default: 'SYSTEM',
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({
    description: 'Optional redirection URL or route path',
  })
  @IsOptional()
  @IsString()
  link?: string;
}
