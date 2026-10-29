import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CreateUserDto } from '../../user/dto/create-user.dto';

export class CreateAuthDto extends CreateUserDto {}

export class LoginAuthDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'A-strong-password123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class VerifyEmailOtp extends ForgotPasswordDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must contain exactly 6 digits' })
  otp!: string;
}

export class ResetPasswordDto extends ForgotPasswordDto {
  @ApiProperty({ example: 'A-new-strong-password123' })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword!: string;

  @ApiProperty({ description: 'Token returned by verify-email-otp' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  resetToken!: string;
}

export class ChangePassword {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  oldPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword!: string;
}

export class VerifyRegistrationOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must contain exactly 6 digits' })
  otp!: string;
}

export class ResendRegistrationOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
