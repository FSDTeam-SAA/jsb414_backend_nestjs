import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import config from '../../config';
import { validatePasswordBytes } from '../../helper/password';
import { publicUserSelect } from '../../helper/public-user-select';
import sendMailer from '../../helper/sendMailer';
import { passwordVersion, tokenDurationSeconds } from '../../helper/token';
import { ChangePassword, CreateAuthDto, LoginAuthDto } from './dto/create-auth.dto';

interface AuthTokenPayload {
  id: string;
  purpose: 'access' | 'refresh' | 'password-reset';
  passwordVersion?: string;
  nonce?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax' as const,
      path: '/api/v1/auth',
    };
  }

  // Use a keyed hash so a database leak cannot reveal six-digit OTP values.
  private hashResetValue(value: string) {
    return createHmac('sha256', config.jwt.refreshTokenSecret!)
      .update(value)
      .digest('hex');
  }

  private signToken(
    user: { id: string; email: string; role: string; password: string },
    purpose: 'access' | 'refresh',
  ) {
    return this.jwtService.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        purpose,
        passwordVersion: passwordVersion(user.password),
      },
      {
        secret:
          purpose === 'access'
            ? config.jwt.accessTokenSecret
            : config.jwt.refreshTokenSecret,
        algorithm: 'HS256',
        expiresIn: tokenDurationSeconds(
          purpose === 'access'
            ? config.jwt.accessTokenExpires
            : config.jwt.refreshTokenExpires,
        ),
      },
    );
  }

  async register(dto: CreateAuthDto) {
    validatePasswordBytes(dto.password);
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email is already registered');
    const password = await bcrypt.hash(dto.password, config.bcryptSaltRounds);
    return this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        password,
      },
      select: publicUserSelect,
    });
  }

  async login(dto: LoginAuthDto, res: Response) {
    validatePasswordBytes(dto.password);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const accessToken = this.signToken(user, 'access');
    const refreshToken = this.signToken(user, 'refresh');
    res.cookie('refreshToken', refreshToken, {
      ...this.cookieOptions(),
      maxAge: tokenDurationSeconds(config.jwt.refreshTokenExpires) * 1000,
    });
    const safeUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: publicUserSelect,
    });

    return { user: safeUser, accessToken };
  }

  async refreshToken(token: string) {
    let payload: AuthTokenPayload;
    try {
      payload = this.jwtService.verify<AuthTokenPayload>(token, {
        secret: config.jwt.refreshTokenSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.purpose !== 'refresh' || typeof payload.id !== 'string') {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
    });
    if (!user || payload.passwordVersion !== passwordVersion(user.password)) {
      throw new UnauthorizedException('Please login again');
    }
    const safeUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: publicUserSelect,
    });
    return { user: safeUser, accessToken: this.signToken(user, 'access') };
  }

  logout(res: Response) {
    res.clearCookie('refreshToken', this.cookieOptions());
    return { message: 'User logged out successfully' };
  }

  async forgotPassword(email: string) {
    const message = 'If an account exists, a password reset code has been sent';
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message };

    // Keep resend requests from continuously replacing an active code.
    if (
      user.otp &&
      user.otpExpiry &&
      user.otpExpiry.getTime() > Date.now() + 9 * 60 * 1000
    ) {
      return { message };
    }
    const otp = randomInt(100000, 1000000).toString();
    const otpHash = this.hashResetValue(otp);
    const claimed = await this.prisma.user.updateMany({
      where: { id: user.id, otp: user.otp, otpExpiry: user.otpExpiry },
      data: {
        otp: otpHash,
        otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
        verifiedForget: false,
      },
    });
    if (claimed.count !== 1) return { message };
    try {
      await sendMailer(
        user.email,
        'Reset Password OTP',
        '<h2>Password Reset</h2><p>Your code is <strong>' +
          otp +
          '</strong>. It expires in 10 minutes.</p>',
      );
    } catch (error) {
      // Clear this failed delivery only; do not clear a newer request.
      await this.prisma.user.updateMany({
        where: { id: user.id, otp: otpHash },
        data: { otp: null, otpExpiry: null, verifiedForget: false },
      });
      throw error;
    }
    return { message };
  }

  async verifyEmailOtp(email: string, otp: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      !user.otp ||
      !user.otpExpiry ||
      user.otpExpiry.getTime() <= Date.now() ||
      user.verifiedForget ||
      user.otp !== this.hashResetValue(otp)
    ) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Exchange the OTP for a short-lived, single-use reset token.
    const nonce = randomBytes(32).toString('hex');
    const result = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        otp: user.otp,
        otpExpiry: { gt: new Date() },
        verifiedForget: user.verifiedForget,
      },
      data: {
        otp: this.hashResetValue(nonce),
        otpExpiry: new Date(Date.now() + 5 * 60 * 1000),
        verifiedForget: true,
      },
    });
    if (result.count !== 1)
      throw new BadRequestException('Invalid or expired OTP');
    const resetToken = this.jwtService.sign(
      { id: user.id, purpose: 'password-reset', nonce },
      {
        secret: config.jwt.refreshTokenSecret,
        algorithm: 'HS256',
        expiresIn: 300,
      },
    );
    return { message: 'OTP verified successfully', resetToken };
  }

  async resetPassword(email: string, newPassword: string, resetToken: string) {
    validatePasswordBytes(newPassword);
    let payload: AuthTokenPayload;
    try {
      payload = this.jwtService.verify<AuthTokenPayload>(resetToken, {
        secret: config.jwt.refreshTokenSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }
    if (
      payload.purpose !== 'password-reset' ||
      typeof payload.id !== 'string' ||
      typeof payload.nonce !== 'string'
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      user.id !== payload.id ||
      !user.verifiedForget ||
      !user.otp ||
      !user.otpExpiry ||
      user.otpExpiry.getTime() <= Date.now() ||
      user.otp !== this.hashResetValue(payload.nonce)
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    const password = await bcrypt.hash(newPassword, config.bcryptSaltRounds);
    const result = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        otp: user.otp,
        otpExpiry: { gt: new Date() },
        verifiedForget: true,
      },
      data: { password, otp: null, otpExpiry: null, verifiedForget: false },
    });
    if (result.count !== 1)
      throw new BadRequestException('Invalid or expired reset token');
    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: string, dto: ChangePassword) {
    validatePasswordBytes(dto.newPassword);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const isPasswordValid = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Incorrect current password');
    }
    const password = await bcrypt.hash(dto.newPassword, config.bcryptSaltRounds);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password },
    });
    return { message: 'Password changed successfully' };
  }
}
