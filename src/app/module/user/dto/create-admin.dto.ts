import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum AdminPermission {
  LEADS = 'LEADS', // লিড ম্যানেজমেন্ট ও ফাইল ইমপোর্ট
  CUSTOMERS = 'CUSTOMERS', // কাস্টমার ম্যানেজমেন্ট
  ORDERS = 'ORDERS', // অর্ডার ও সেলস ট্রানজেকশন
  SUPPORT = 'SUPPORT', // কাস্টমার সাপোর্ট ও Contact Us রিপ্লাই
  PRICING = 'PRICING', // ক্যাটাগরি ও বয়স ভিত্তিক প্রাইসিং রুলস
}

export class CreateAdminDto {
  @ApiProperty({ example: 'Sharif', description: 'Admin first name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Ahmed', description: 'Admin last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'staff.admin@example.com', description: 'Admin login email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+1-555-0199', description: 'Phone number' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'AdminPass@123',
    description: 'Temporary password (auto-generated if omitted)',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiProperty({
    example: [AdminPermission.LEADS, AdminPermission.ORDERS],
    enum: AdminPermission,
    isArray: true,
    description: 'Assigned permissions for this admin',
  })
  @IsArray()
  @IsEnum(AdminPermission, { each: true })
  permissions: AdminPermission[];
}

export class UpdateAdminPermissionsDto {
  @ApiProperty({
    example: [AdminPermission.LEADS, AdminPermission.CUSTOMERS, AdminPermission.ORDERS],
    enum: AdminPermission,
    isArray: true,
    description: 'Updated permissions for this admin',
  })
  @IsArray()
  @IsEnum(AdminPermission, { each: true })
  permissions: AdminPermission[];
}
