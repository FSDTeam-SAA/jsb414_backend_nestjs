import {
  ExecutionContext,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';
import sendMailer from '../../helper/sendMailer';
import { PermissionsGuard } from '../../middlewares/permissions.guard';
import { AdminPermission } from './dto/create-admin.dto';
import { UserService } from './user.service';

jest.mock('../../helper/sendMailer', () => jest.fn().mockResolvedValue(true));
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_secret_password'),
  compare: jest
    .fn()
    .mockImplementation((raw: string) =>
      Promise.resolve(raw === 'correct_pass'),
    ),
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
        update: jest.fn(),
      },
      cartItem: {
        deleteMany: jest.fn(),
      },
      payment: {
        count: jest.fn(),
      },
      userLead: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      order: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      savedSearch: {
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
      badLeadRequest: {
        findMany: jest.fn(),
      },
      deletionRequest: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockNotificationService: any = {
      createNotification: jest.fn().mockResolvedValue(true),
    };

    service = new UserService(db as PrismaService, mockNotificationService);
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
      db.user.findUnique.mockResolvedValueOnce({
        id: 'admin_1',
        role: 'admin',
      });

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
      expect(result.leadsActivity.badLeadRequests[0].reason).toBe(
        'INVALID_PHONE',
      );
    });
  });

  describe('getSingleUser', () => {
    it('returns user profile with activeSubscribe populated when user has an active subscription', async () => {
      const now = new Date();
      const future = new Date(Date.now() + 15 * 86400000);

      db.user.findUnique.mockResolvedValueOnce({
        id: 'u_100',
        firstName: 'Rahim',
        lastName: 'Uddin',
        email: 'rahim@example.com',
        phoneNumber: '+8801700000000',
        photo: 'https://example.com/avatar.jpg',
        role: 'user',
        verifiedEmail: true,
        walletBalance: 250,
        createdAt: now,
        updatedAt: now,
      });

      db.userSubscribe.findFirst.mockResolvedValueOnce({
        id: 'us_1',
        userId: 'u_100',
        status: 'ACTIVE',
        startDate: now,
        endDate: future,
        subscribe: {
          id: 'sub_gold',
          title: 'Gold',
          subTitle: '10% Lead Discount',
          price: 99,
          discount: 10,
          currency: 'USD',
        },
      });

      const result = await service.getSingleUser('u_100');

      expect(result.id).toBe('u_100');
      expect(result.walletBalance).toBe(250);
      expect(result.activeSubscribe).not.toBeNull();
      expect(result.activeSubscribe).toEqual({
        id: 'us_1',
        subscribeId: 'sub_gold',
        title: 'Gold',
        planName: 'Gold Member',
        subTitle: '10% Lead Discount',
        price: 99,
        discount: 10,
        currency: 'USD',
        status: 'ACTIVE',
        startDate: now,
        endDate: future,
      });
      expect(result.activeSubscription).toEqual(result.activeSubscribe);
    });

    it('returns user profile with activeSubscribe: null when user has no active subscription', async () => {
      const now = new Date();

      db.user.findUnique.mockResolvedValueOnce({
        id: 'u_200',
        firstName: 'Karim',
        lastName: 'Ahmed',
        email: 'karim@example.com',
        walletBalance: 0,
        createdAt: now,
        updatedAt: now,
      });

      db.userSubscribe.findFirst.mockResolvedValueOnce(null);

      const result = await service.getSingleUser('u_200');

      expect(result.id).toBe('u_200');
      expect(result.walletBalance).toBe(0);
      expect(result.activeSubscribe).toBeNull();
      expect(result.activeSubscription).toBeNull();
    });

    it('throws 404 HttpException if user does not exist', async () => {
      db.user.findUnique.mockResolvedValueOnce(null);
      db.userSubscribe.findFirst.mockResolvedValueOnce(null);

      await expect(service.getSingleUser('u_missing')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('deleteUserAccount', () => {
    it('throws HttpException if password does not match', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        id: 'u_1',
        password: 'hashed_password',
      });

      await expect(
        service.deleteUserAccount('u_1', { password: 'wrong_pass' }),
      ).rejects.toThrow('Incorrect password');
    });

    it('permanently deletes user if there are no financial records (0 orders, 0 payments)', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        id: 'u_clean',
        password: 'hashed_password',
      });
      db.userSubscribe.findFirst.mockResolvedValueOnce(null);
      db.cartItem.deleteMany.mockResolvedValueOnce({ count: 0 });
      db.savedSearch.deleteMany.mockResolvedValueOnce({ count: 0 });
      db.order.count.mockResolvedValueOnce(0);
      db.payment.count.mockResolvedValueOnce(0);
      db.user.delete.mockResolvedValueOnce({ id: 'u_clean' });

      const result = await service.deleteUserAccount('u_clean', {
        password: 'correct_pass',
      });

      expect(result.deleted).toBe(true);
      expect(db.user.delete).toHaveBeenCalledWith({ where: { id: 'u_clean' } });
    });

    it('anonymizes and deactivates user if user has financial history (orders/payments)', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        id: 'u_has_orders',
        password: 'hashed_password',
      });
      db.userSubscribe.findFirst.mockResolvedValueOnce(null);
      db.cartItem.deleteMany.mockResolvedValueOnce({ count: 0 });
      db.savedSearch.deleteMany.mockResolvedValueOnce({ count: 0 });
      db.order.count.mockResolvedValueOnce(2);
      db.payment.count.mockResolvedValueOnce(2);
      db.user.update.mockResolvedValueOnce({ id: 'u_has_orders' });

      const result = await service.deleteUserAccount('u_has_orders', {
        password: 'correct_pass',
      });

      expect(result.deactivated).toBe(true);
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u_has_orders' },
          data: expect.objectContaining({
            firstName: 'Deactivated',
            lastName: 'Account',
            walletBalance: 0,
            verifiedEmail: false,
          }),
        }),
      );
    });
  });

  describe('Deletion Requests (Figma Screen)', () => {
    describe('submitDeletionRequest', () => {
      it('successfully submits a deletion request with reason', async () => {
        db.user.findUnique.mockResolvedValueOnce({ id: 'u_client_1' });
        db.deletionRequest.findFirst.mockResolvedValueOnce(null);
        db.deletionRequest.create.mockResolvedValueOnce({
          id: 'del_1',
          userId: 'u_client_1',
          reason: "I can't continue this platform.",
          status: 'PENDING',
        });

        const result = await service.submitDeletionRequest('u_client_1', {
          reason: "I can't continue this platform.",
        });

        expect(result.message).toContain('submitted successfully');
        expect(db.deletionRequest.create).toHaveBeenCalledWith({
          data: {
            userId: 'u_client_1',
            reason: "I can't continue this platform.",
            status: 'PENDING',
          },
        });
      });

      it('rejects if customer already has a pending deletion request', async () => {
        db.user.findUnique.mockResolvedValueOnce({ id: 'u_client_1' });
        db.deletionRequest.findFirst.mockResolvedValueOnce({
          id: 'del_existing',
          status: 'PENDING',
        });

        await expect(
          service.submitDeletionRequest('u_client_1', {
            reason: 'Duplicate request',
          }),
        ).rejects.toThrow(
          'You already have an account deletion request pending review',
        );
      });
    });

    describe('getAllDeletionRequestsAdmin', () => {
      it('returns formatted table data matching Figma Deletion Requests columns', async () => {
        db.deletionRequest.findMany.mockResolvedValueOnce([
          {
            id: 'del_req_1',
            userId: 'u_100',
            reason: "I can't continue this platform.",
            status: 'PENDING',
            adminNotes: null,
            createdAt: new Date('2026-10-23T10:00:00Z'),
            user: {
              id: 'u_100',
              firstName: 'John',
              lastName: 'Bhawal',
              email: 'johnbhawal@gmail.com',
              phoneNumber: '+345 345 2353',
              photo: null,
              createdAt: new Date('2026-10-23T08:00:00Z'),
              updatedAt: new Date(),
              userSubscribes: [{ subscribe: { title: 'Gold' } }],
            },
          },
        ]);
        db.deletionRequest.count.mockResolvedValueOnce(1);

        const result = await service.getAllDeletionRequestsAdmin({
          page: 1,
          limit: 25,
        });

        expect(result.data.length).toBe(1);
        const item = result.data[0];
        expect(item.customerName).toBe('John Bhawal');
        expect(item.customerId).toContain('FG-C-');
        expect(item.email).toBe('johnbhawal@gmail.com');
        expect(item.membership).toBe('Gold');
        expect(item.status).toBe('PENDING');
        expect(item.reason).toBe("I can't continue this platform.");
        expect(result.meta.total).toBe(1);
      });
    });

    describe('getSingleDeletionRequestAdmin', () => {
      it('returns single deletion request details for modal', async () => {
        db.deletionRequest.findUnique.mockResolvedValueOnce({
          id: 'del_req_1',
          userId: 'u_100',
          reason: "I can't continue this platform.",
          status: 'PENDING',
          adminNotes: null,
          createdAt: new Date('2026-10-23T10:00:00Z'),
          reviewedAt: null,
          reviewedById: null,
          user: {
            id: 'u_100',
            firstName: 'John',
            lastName: 'Bhawal',
            email: 'johnbhawal@gmail.com',
            phoneNumber: '+345 345 2353',
            photo: null,
            role: 'user',
            createdAt: new Date('2026-10-23T08:00:00Z'),
            updatedAt: new Date(),
            userSubscribes: [{ subscribe: { title: 'Gold' } }],
          },
        });

        const result = await service.getSingleDeletionRequestAdmin('del_req_1');

        expect(result.id).toBe('del_req_1');
        expect(result.customer.name).toBe('John Bhawal');
        expect(result.customer.initials).toBe('JB');
        expect(result.customer.membership).toBe('Gold');
        expect(result.customer.phoneNumber).toBe('+345 345 2353');
        expect(result.reason).toBe("I can't continue this platform.");
      });
    });

    describe('reviewDeletionRequest', () => {
      it('approves deletion request and triggers account anonymization/deletion', async () => {
        db.deletionRequest.findUnique.mockResolvedValueOnce({
          id: 'del_req_1',
          userId: 'u_100',
          status: 'PENDING',
        });
        db.userSubscribe.findFirst.mockResolvedValueOnce(null);
        db.cartItem.deleteMany.mockResolvedValueOnce({ count: 0 });
        db.savedSearch.deleteMany.mockResolvedValueOnce({ count: 0 });
        db.order.count.mockResolvedValueOnce(0);
        db.payment.count.mockResolvedValueOnce(0);
        db.user.delete.mockResolvedValueOnce({ id: 'u_100' });
        db.deletionRequest.update.mockResolvedValueOnce({
          id: 'del_req_1',
          status: 'APPROVED',
          adminNotes: 'Confirmed by admin',
        });

        const result = await service.reviewDeletionRequest(
          'del_req_1',
          'admin_1',
          {
            status: 'APPROVED',
            adminNotes: 'Confirmed by admin',
          },
        );

        expect(result.message).toContain('approved');
        expect(db.deletionRequest.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'del_req_1' },
            data: expect.objectContaining({
              status: 'APPROVED',
              adminNotes: 'Confirmed by admin',
              reviewedById: 'admin_1',
            }),
          }),
        );
      });

      it('denies deletion request and updates status to DENIED', async () => {
        db.deletionRequest.findUnique.mockResolvedValueOnce({
          id: 'del_req_2',
          userId: 'u_200',
          status: 'PENDING',
        });
        db.deletionRequest.update.mockResolvedValueOnce({
          id: 'del_req_2',
          status: 'DENIED',
          adminNotes: 'Active contracts pending',
        });

        const result = await service.reviewDeletionRequest(
          'del_req_2',
          'admin_1',
          {
            status: 'DENIED',
            adminNotes: 'Active contracts pending',
          },
        );

        expect(result.message).toContain('denied');
        expect(db.deletionRequest.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'del_req_2' },
            data: expect.objectContaining({
              status: 'DENIED',
              adminNotes: 'Active contracts pending',
              reviewedById: 'admin_1',
            }),
          }),
        );
      });
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
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['LEADS', 'PRICING']);
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
