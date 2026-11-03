import { ExecutionContext, ForbiddenException, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import bcrypt from 'bcryptjs';
import { PermissionsGuard } from '../../middlewares/permissions.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import sendMailer from '../../helper/sendMailer';
import { AdminPermission } from './dto/create-admin.dto';
import { UserService } from './user.service';

jest.mock('../../helper/sendMailer', () => jest.fn().mockResolvedValue(true));
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_secret_password'),
}));

describe('UserService - Admin Role & Permissions', () => {
  let service: UserService;
  let db: any;

  beforeEach(() => {
    db = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }: any) => ({
          id: 'admin_id_1',
          ...data,
          password: 'hidden',
        })),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn().mockImplementation(({ data }: any) => ({
          id: 'admin_id_1',
          role: 'admin',
          ...data,
        })),
        delete: jest.fn().mockResolvedValue({ id: 'admin_id_1' }),
      },
    };

    service = new UserService(db as PrismaService);
  });

  describe('createAdminBySuperAdmin', () => {
    it('throws error if email already exists', async () => {
      db.user.findUnique.mockResolvedValueOnce({ id: 'existing_user' });

      await expect(
        service.createAdminBySuperAdmin({
          firstName: 'John',
          lastName: 'Doe',
          email: 'admin@example.com',
          permissions: [AdminPermission.LEADS],
        }),
      ).rejects.toThrow(HttpException);
    });

    it('creates a new admin with hashed password and sends credentials via email', async () => {
      db.user.findUnique.mockResolvedValueOnce(null);

      const result = await service.createAdminBySuperAdmin({
        firstName: 'Sharif',
        lastName: 'Ahmed',
        email: 'sharif@example.com',
        permissions: [AdminPermission.LEADS, AdminPermission.ORDERS],
      });

      expect(result.message).toContain('Admin account created successfully');
      expect(db.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'sharif@example.com',
            role: 'admin',
            verifiedEmail: true,
            permissions: [AdminPermission.LEADS, AdminPermission.ORDERS],
          }),
        }),
      );
      expect(sendMailer).toHaveBeenCalledWith(
        'sharif@example.com',
        expect.stringContaining('Admin Account Credentials'),
        expect.stringContaining('Portal Login URL'),
      );
    });
  });

  describe('updateAdminPermissions', () => {
    it('throws error if user is not an admin', async () => {
      db.user.findUnique.mockResolvedValueOnce({ id: 'u_1', role: 'user' });

      await expect(
        service.updateAdminPermissions('u_1', {
          permissions: [AdminPermission.CUSTOMERS],
        }),
      ).rejects.toThrow(HttpException);
    });

    it('updates permissions for staff admin', async () => {
      db.user.findUnique.mockResolvedValueOnce({ id: 'admin_1', role: 'admin' });

      const result = await service.updateAdminPermissions('admin_1', {
        permissions: [AdminPermission.LEADS, AdminPermission.CUSTOMERS],
      });

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'admin_1' },
          data: {
            permissions: [AdminPermission.LEADS, AdminPermission.CUSTOMERS],
          },
        }),
      );
      expect(result.message).toContain('updated successfully');
    });
  });

  describe('deleteAdmin', () => {
    it('prevents deleting superadmin', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        id: 'super_1',
        role: 'superadmin',
      });

      await expect(service.deleteAdmin('super_1')).rejects.toThrow(
        'Superadmin accounts cannot be deleted',
      );
    });

    it('deletes staff admin successfully', async () => {
      db.user.findUnique.mockResolvedValueOnce({ id: 'adm_1', role: 'admin' });

      const result = await service.deleteAdmin('adm_1');
      expect(db.user.delete).toHaveBeenCalledWith({ where: { id: 'adm_1' } });
      expect(result.message).toContain('removed successfully');
    });
  });
});

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  };

  it('allows Super Admin full access regardless of required permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['LEADS', 'PRICING']);
    const context = createMockContext({ role: 'superadmin', permissions: [] });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows Admin who has the required permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['LEADS']);
    const context = createMockContext({
      role: 'admin',
      permissions: ['LEADS', 'ORDERS'],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException if Admin lacks required permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['PRICING']);
    const context = createMockContext({
      role: 'admin',
      permissions: ['LEADS'],
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
