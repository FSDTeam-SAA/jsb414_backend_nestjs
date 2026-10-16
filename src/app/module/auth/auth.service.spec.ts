import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import config from '../../config';
import { passwordVersion } from '../../helper/token';

describe('Authentication security', () => {
  let service: AuthService;
  let stored: any;
  let db: any;
  let sendMail: jest.Mock;
  const jwt = new JwtService();

  beforeAll(() => {
    config.jwt.accessTokenSecret = 'test-access-secret-at-least-32-characters';
    config.jwt.refreshTokenSecret =
      'test-refresh-secret-at-least-32-characters';
    config.bcryptSaltRounds = 10;
  });

  beforeEach(async () => {
    stored = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'user@example.com',
      password: await bcrypt.hash('Old-password123', 4),
      role: 'user',
      otp: null,
      otpExpiry: null,
      verifiedForget: false,
    };
    const selectUser = (select: any) =>
      select
        ? Object.fromEntries(
            Object.keys(select)
              .filter((key) => select[key])
              .map((key) => [key, stored[key]]),
          )
        : { ...stored };
    db = {
      user: {
        findUnique: jest.fn(async ({ where, select }: any) =>
          where.email && where.email !== stored.email
            ? null
            : selectUser(select),
        ),
        create: jest.fn(async ({ data, select }: any) => {
          stored = { ...stored, ...data };
          return selectUser(select);
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          for (const [key, value] of Object.entries(where)) {
            if (value && typeof value === 'object' && 'gt' in value) {
              if (!stored[key] || stored[key] <= (value as any).gt)
                return { count: 0 };
            } else if (stored[key] !== value) return { count: 0 };
          }
          Object.assign(stored, data);
          return { count: 1 };
        }),
      },
    };
    sendMail = jest.fn().mockResolvedValue({} as never);
    jest
      .spyOn(nodemailer, 'createTransport')
      .mockReturnValue({ sendMail } as any);
    service = new AuthService(db as PrismaService, jwt);
  });
  afterEach(() => jest.restoreAllMocks());

  async function getResetToken() {
    await service.forgotPassword(stored.email);
    const html = (sendMail.mock.calls[0][0] as any).html as string;
    const otp = /<strong>(\d{6})<\/strong>/.exec(html)![1];
    expect(stored.otp).not.toBe(otp);
    return (await service.verifyEmailOtp(stored.email, otp)).resetToken;
  }

  it('returns the same forgot-password response for unknown accounts', async () => {
    expect(await service.forgotPassword('missing@example.com')).toEqual(
      await service.forgotPassword(stored.email),
    );
  });

  it('rejects expired OTPs', async () => {
    await service.forgotPassword(stored.email);
    const otp = /<strong>(\d{6})<\/strong>/.exec(
      (sendMail.mock.calls[0][0] as any).html,
    )![1];
    stored.otpExpiry = new Date(Date.now() - 1);
    await expect(service.verifyEmailOtp(stored.email, otp)).rejects.toThrow(
      'Invalid or expired OTP',
    );
  });

  it('rejects OTP verification when the account does not exist', async () => {
    await expect(
      service.verifyEmailOtp('missing@example.com', '123456'),
    ).rejects.toThrow('Invalid or expired OTP');
  });

  it('requires proof of OTP verification, not only the boolean flag', async () => {
    stored.verifiedForget = true;
    await expect(
      service.resetPassword(stored.email, 'New-password123', 'invalid'),
    ).rejects.toThrow('Invalid or expired reset token');
  });

  it('completes reset once and refuses token replay', async () => {
    const token = await getResetToken();
    await service.resetPassword(stored.email, 'New-password123', token);
    expect(await bcrypt.compare('New-password123', stored.password)).toBe(true);
    expect(stored.otp).toBeNull();
    expect(stored.verifiedForget).toBe(false);
    await expect(
      service.resetPassword(stored.email, 'Another-password123', token),
    ).rejects.toThrow();
  });

  it('allows only one of two concurrent password resets to succeed', async () => {
    const token = await getResetToken();
    const results = await Promise.allSettled([
      service.resetPassword(stored.email, 'First-password123', token),
      service.resetPassword(stored.email, 'Second-password123', token),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
  });

  it('refuses a password reset token at the refresh endpoint', async () => {
    const token = await getResetToken();
    await expect(service.refreshToken(token)).rejects.toThrow(
      'Invalid refresh token',
    );
  });

  it('does not return password or OTP fields on login and refresh', async () => {
    const res = { cookie: jest.fn() } as unknown as Response;
    const login = await service.login(
      { email: stored.email, password: 'Old-password123' },
      res,
    );
    expect(login.user).not.toHaveProperty('password');
    expect(login.user).not.toHaveProperty('otp');
    const refresh = (res.cookie as jest.Mock).mock.calls[0][1] as string;
    const result = await service.refreshToken(refresh);
    expect(result.user).not.toHaveProperty('password');
    expect(result.user).not.toHaveProperty('otpExpiry');
  });

  it('invalidates previous refresh tokens after a password change', async () => {
    const token = jwt.sign(
      {
        id: stored.id,
        purpose: 'refresh',
        passwordVersion: passwordVersion(stored.password),
      },
      { secret: config.jwt.refreshTokenSecret, expiresIn: 300 },
    );
    stored.password = await bcrypt.hash('Updated-password123', 4);
    await expect(service.refreshToken(token)).rejects.toThrow(
      'Please login again',
    );
  });

  it('never returns a password hash from registration', async () => {
    db.user.findUnique.mockResolvedValueOnce(null);
    const result = await service.register({
      firstName: 'Test',
      lastName: 'User',
      email: stored.email,
      phoneNumber: '+8801700000000',
      password: 'New-password123',
    });
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('otp');
  });
});
