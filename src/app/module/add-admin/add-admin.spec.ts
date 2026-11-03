import { HttpException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import sendMailer from '../../helper/sendMailer';
import { AddAdminService } from './add-admin.service';
import { AdminPermission } from './dto/create-add-admin.dto';

jest.mock('../../helper/sendMailer', () => jest.fn().mockResolvedValue(true));
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_secret_password'),
}));

describe('AddAdminService', () => {
  let service: AddAdminService;
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

    service = new AddAdminService(db as PrismaService);
  });

  describe('create', () => {
    it('throws error if email already exists', async () => {
      db.user.findUnique.mockResolvedValueOnce({ id: 'existing_id' });

      await expect(
        service.create({
          firstName: 'Sharif',
          lastName: 'Ahmed',
          email: 'sharif@example.com',
          permissions: [AdminPermission.LEADS],
        }),
      ).rejects.toThrow(HttpException);
    });

    it('creates a new admin and sends credentials email', async () => {
      db.user.findUnique.mockResolvedValueOnce(null);

      const result = await service.create({
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

  describe('findAll', () => {
    it('returns all staff admins with pagination', async () => {
      db.user.findMany.mockResolvedValueOnce([
        { id: 'adm_1', email: 'adm1@example.com', permissions: ['LEADS'] },
      ]);
      db.user.count.mockResolvedValueOnce(1);

      const result = await service.findAll({}, { page: 1, limit: 10 });
      expect(result.meta.total).toBe(1);
      expect(result.data.length).toBe(1);
    });
  });

  describe('update', () => {
    it('updates admin permissions and profile details', async () => {
      db.user.findUnique.mockResolvedValueOnce({ id: 'adm_1', role: 'admin' });

      const result = await service.update('adm_1', {
        permissions: [AdminPermission.LEADS, AdminPermission.CUSTOMERS],
      });

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'adm_1' },
          data: expect.objectContaining({
            permissions: [AdminPermission.LEADS, AdminPermission.CUSTOMERS],
          }),
        }),
      );
      expect(result.message).toContain('Admin updated successfully');
    });
  });

  describe('remove', () => {
    it('prevents deleting superadmin', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        id: 'super_1',
        role: 'superadmin',
      });

      await expect(service.remove('super_1')).rejects.toThrow(
        'Superadmin accounts cannot be deleted',
      );
    });

    it('deletes staff admin', async () => {
      db.user.findUnique.mockResolvedValueOnce({ id: 'adm_1', role: 'admin' });

      const result = await service.remove('adm_1');
      expect(db.user.delete).toHaveBeenCalledWith({ where: { id: 'adm_1' } });
      expect(result.message).toContain('removed successfully');
    });
  });
});
