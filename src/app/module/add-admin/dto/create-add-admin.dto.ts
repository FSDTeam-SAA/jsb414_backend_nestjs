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
  READ_ONLY = 'READ_ONLY', // রিড-অনলি মোড: সব দেখতে পারবে কিন্তু কোনো পরিবর্তন বা অ্যাকশন নিতে পারবে না
  LEADS = 'LEADS', // লিড তৈরি, এডিট, ডিলিট ও ফাইল ইমপোর্ট
  CUSTOMERS = 'CUSTOMERS', // কাস্টমার তালিকা ও প্রোফাইল
  ORDERS = 'ORDERS', // কাস্টমার অর্ডার ও ট্রানজেকশন
  SUPPORT = 'SUPPORT', // কাস্টমার সাপোর্ট ও Contact Us মেসেজ রিপ্লাই
  PRICING = 'PRICING', // ক্যাটাগরি ও বয়স ভিত্তিক প্রাইসিং কনফিগারেশন
}

export class CreateAddAdminDto {
  @ApiProperty({ example: 'Sharif', description: 'Admin first name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Ahmed', description: 'Admin last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'admin@foreclosuregold.com', description: 'Admin login email' })
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
