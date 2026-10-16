import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthRateLimitGuard } from '../../middlewares/auth-rate-limit.guard';
import { AuthService } from './auth.service';
import {
  CreateAuthDto,
  ForgotPasswordDto,
  LoginAuthDto,
  ResetPasswordDto,
  VerifyEmailOtp,
} from './dto/create-auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'register user' })
  @Post()
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() createAuthDto: CreateAuthDto) {
    const result = await this.authService.register(createAuthDto);
    return {
      message: 'User Created Successfully',
      data: result,
    };
  }

  @ApiOperation({ summary: 'Login user' })
  @Post('login')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginAuthDto: LoginAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginAuthDto, res);
    return {
      message: 'Login successful',
      data: result,
    };
  }

  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string', example: 'your-refresh-token-here' },
      },
    },
    required: false,
  })
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() req: Request,
    @Body('refreshToken') bodyToken?: string,
  ) {
    const token = req.cookies?.refreshToken || bodyToken;
    if (!token) {
      throw new HttpException(
        'Refresh token is required',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const result = await this.authService.refreshToken(token);
    return {
      message: 'Token refreshed successfully',
      data: result,
    };
  }

  @ApiOperation({ summary: 'Logout user' })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    const result = await this.authService.logout(res);
    return {
      message: 'Logout successful',
      data: {
        user: result,
      },
    };
  }

  @ApiOperation({ summary: 'Forgot password' })
  @Post('forgot-password')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(
      forgotPasswordDto.email,
    );
    return {
      message: 'Forgot password successful',
      data: result,
    };
  }

  @ApiOperation({ summary: 'Verify email OTP' })
  @Post('verify-email-otp')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async verifyEmailOtp(@Body() verifyEmailOtpDto: VerifyEmailOtp) {
    const result = await this.authService.verifyEmailOtp(
      verifyEmailOtpDto.email,
      verifyEmailOtpDto.otp,
    );
    return {
      message: 'Email verified successfully',
      data: result,
    };
  }

  @ApiOperation({ summary: 'Reset password' })
  @Post('reset-password')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const result = await this.authService.resetPassword(
      resetPasswordDto.email,
      resetPasswordDto.newPassword,
      resetPasswordDto.resetToken,
    );
    return {
      message: 'Password reset successfully',
      data: result,
    };
  }
}
