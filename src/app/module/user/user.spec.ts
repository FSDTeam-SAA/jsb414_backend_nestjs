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
      userSubscribe: {
        findFirst: jest.fn(),
      },
      userLead: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      order: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      savedSearch: {
        count: jest.fn(),
      },
      badLeadRequest: {
        findMany: jest.fn(),
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

  describe('getCustomerDetails', () => {
    it('returns full customer details with membership, purchased leads, and financials', async () => {
      const customerId = 'cust_123';
      db.user.findUnique.mockResolvedValueOnce({
        id: customerId,
        firstName: 'Budi',
        lastName: 'Santoso',
        email: 'budi@example.com',
        phoneNumber: '+1-555-1234',
        photo: null,
        role: 'user',
        verifiedEmail: true,
        walletBalance: 425,
        leadTypes: ['Pre-Foreclosure'],
        interestedStates: ['FL'],
        interestedCities: ['Miami'],
        createdAt: new Date(),
      });

      db.userSubscribe.findFirst.mockResolvedValueOnce({
        id: 'sub_1',
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
        subscribe: { id: 'plan_gold', title: 'Gold', price: 99, discount: 10 },
      });

      db.userLead.findMany.mockResolvedValueOnce([
        {
          id: 'ul_1',
          leadId: 'l_1',
          priceType: 'SHARED',
          pricePaid: 20.19,
          purchasedAt: new Date(),
          lead: {
            leadNumber: 112,
            category: { name: 'Pre-Foreclosure' },
            propertyAddress: '500 Ocean Dr',
            city: 'Miami Beach',
            state: 'FL',
            zipcode: '33139',
            phoneNumbers: ['(305) 555-1111'],
            emailAddresses: ['budi@example.com'],
          },
        },
      ]);
      db.userLead.count.mockResolvedValueOnce(1);

      db.order.aggregate.mockResolvedValueOnce({
        _count: { id: 2 },
        _sum: { totalAmount: 150, walletUsed: 50, cardPaid: 100 },
      });

      db.savedSearch.count.mockResolvedValueOnce(3);

      db.badLeadRequest.findMany.mockResolvedValueOnce([
        {
          id: 'blr_1',
          leadId: 'l_1',
          reason: 'INVALID_PHONE',
          explanation: 'Disconnected',
          status: 'PENDING',
          creditReturned: null,
          adminNotes: null,
          createdAt: new Date(),
          reviewedAt: null,
          lead: { leadNumber: 112, city: 'Miami Beach', state: 'FL' },
        },
      ]);

      db.order.findMany.mockResolvedValueOnce([
        {
          id: 'ord_1',
          orderNumber: 'FG-ORD-1001',
          totalAmount: 50,
          status: 'COMPLETED',
          createdAt: new Date(),
        },
      ]);

      const result = await service.getCustomerDetails(customerId);

      expect(result.customer.fullName).toBe('Budi Santoso');
      expect(result.membership.planName).toBe('Gold');
      expect(result.membership.discount).toBe(10);
      expect(result.financials.walletBalance).toBe(425);
      expect(result.financials.totalOrders).toBe(2);
      expect(result.financials.totalSpent).toBe(150);
      expect(result.leadsActivity.totalPurchasedLeads).toBe(1);
      expect(result.leadsActivity.savedSearchesCount).toBe(3);
      expect(result.leadsActivity.badLeadRequests.length).toBe(1);
      expect(result.leadsActivity.badLeadRequests[0].reason).toBe('INVALID_PHONE');
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
