import { NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('Dashboard Module', () => {
  let service: DashboardService;
  let controller: DashboardController;
  let db: any;
  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockUserId = '11111111-1111-4111-8111-111111111111';

  beforeEach(async () => {
    db = {
      user: {
        findUnique: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      userSubscribe: {
        findFirst: jest.fn(),
      },
      userLead: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      cartItem: {
        count: jest.fn(),
      },
      savedSearch: {
        count: jest.fn(),
      },
      notification: {
        count: jest.fn(),
      },
      badLeadRequest: {
        groupBy: jest.fn(),
        count: jest.fn(),
      },
      order: {
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      agePriceRule: {
        findMany: jest.fn(),
      },
      lead: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: db },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    controller = module.get<DashboardController>(DashboardController);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(controller).toBeDefined();
  });

  describe('userDashboardOverview', () => {
    it('should return complete user dashboard overview with active subscription', async () => {
      const mockUser = {
        id: mockUserId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneNumber: '+1-555-1234',
        photo: null,
        role: 'user',
        walletBalance: 425.0,
        leadTypes: ['Foreclosure'],
        interestedStates: ['FL'],
        interestedCities: ['Miami'],
        createdAt: new Date('2026-01-01'),
      };

      const mockSub = {
        id: 'sub-1',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        subscribe: {
          id: 'plan-gold',
          title: 'Gold Member',
          subTitle: 'Premium Plan',
          price: 99.0,
          discount: 10,
        },
      };

      db.user.findUnique.mockResolvedValueOnce(mockUser);
      db.userSubscribe.findFirst.mockResolvedValueOnce(mockSub);
      db.userLead.count
        .mockResolvedValueOnce(15) // totalPurchased
        .mockResolvedValueOnce(5) // exclusive
        .mockResolvedValueOnce(10); // shared
      db.cartItem.count.mockResolvedValueOnce(2);
      db.savedSearch.count.mockResolvedValueOnce(4);
      db.notification.count.mockResolvedValueOnce(3); // unread notifications
      db.badLeadRequest.groupBy.mockResolvedValueOnce([
        { status: 'PENDING', _count: { _all: 1 } },
        { status: 'APPROVED', _count: { _all: 2 } },
      ]);
      db.userLead.findMany.mockResolvedValueOnce([
        {
          id: 'ul-1',
          leadId: 'lead-1',
          priceType: 'SHARED',
          pricePaid: 25.0,
          purchasedAt: new Date(),
          lead: {
            id: 'lead-1',
            leadNumber: 101,
            propertyAddress: '123 Ocean Dr',
            unitNumber: '4B',
            city: 'Miami',
            state: 'FL',
            zipcode: '33139',
            propertyType: 'Single Family',
            category: { id: 'cat-1', name: 'Foreclosure' },
            phoneNumbers: ['+1-555-0101'],
            emailAddresses: ['owner@example.com'],
          },
        },
      ]);
      db.order.findMany.mockResolvedValueOnce([
        {
          id: 'ord-1',
          orderNumber: 'FG-ORD-1001',
          totalAmount: 50.0,
          status: 'COMPLETED',
          createdAt: new Date(),
          _count: { orderItems: 2 },
        },
      ]);
      db.agePriceRule.findMany.mockResolvedValueOnce([]);
      db.lead.findMany.mockResolvedValueOnce([
        {
          id: 'lead-rec-1',
          leadNumber: 102,
          propertyAddress: '456 Palm Ave',
          unitNumber: null,
          city: 'Miami',
          state: 'FL',
          zipcode: '33139',
          propertyType: 'Condo',
          availability: 'SHARED',
          estValue: 400000,
          estEquity: 120000,
          mortgageBalance: 280000,
          saleDate: new Date(),
          stage: 'Pre-foreclosure',
          phoneNumbers: ['+1-555-0102'],
          emailAddresses: ['seller@example.com'],
          sharedLimit: 3,
          sharedSalesCount: 1,
          createdAt: new Date(),
          category: {
            id: 'cat-1',
            name: 'Foreclosure',
            sharedBasePrice: 30.0,
            exclusiveBasePrice: 100.0,
            agePricingEnabled: false,
          },
        },
      ]);

      const result = await service.userDashboardOverview(mockUserId);

      expect(result.user.email).toBe('john@example.com');
      expect(result.overviewCards.membership.planName).toBe('Gold Member');
      expect(result.overviewCards.membership.discountPercentage).toBe(10);
      expect(result.overviewCards.leads.totalPurchased).toBe(15);
      expect(result.overviewCards.accountBalance.currentBalance).toBe(425.0);
      expect(result.overviewCards.accountBalance.quickTopUpOptions).toEqual([
        100, 250, 500,
      ]);
      expect(result.counters.cartItemsCount).toBe(2);
      expect(result.counters.savedSearchesCount).toBe(4);
      expect(result.counters.unreadNotificationsCount).toBe(3);
      expect(result.counters.badLeadRequests.pending).toBe(1);
      expect(result.counters.badLeadRequests.approved).toBe(2);
      expect(result.recentPurchasedLeads.length).toBe(1);
      expect(result.recentPurchasedLeads[0].leadNumber).toBe(101);
      expect(result.recentOrders.length).toBe(1);
      expect(result.recentOrders[0].orderNumber).toBe('FG-ORD-1001');
      expect(result.recommendedLeads.length).toBe(1);
      expect(result.recommendedLeads[0].hasContactInfo).toBe(true);
    });

    it('should default to Free Plan if user has no subscription', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        id: mockUserId,
        firstName: 'Free',
        lastName: 'User',
        email: 'free@example.com',
        walletBalance: 0,
        createdAt: new Date(),
      });
      db.userSubscribe.findFirst.mockResolvedValueOnce(null);
      db.userLead.count.mockResolvedValue(0);
      db.cartItem.count.mockResolvedValue(0);
      db.savedSearch.count.mockResolvedValue(0);
      db.notification.count.mockResolvedValue(0);
      db.badLeadRequest.groupBy.mockResolvedValue([]);
      db.userLead.findMany.mockResolvedValue([]);
      db.order.findMany.mockResolvedValue([]);
      db.agePriceRule.findMany.mockResolvedValue([]);
      db.lead.findMany.mockResolvedValue([]);

      const result = await service.userDashboardOverview(mockUserId);
      expect(result.overviewCards.membership.planName).toBe('Free Plan');
      expect(result.overviewCards.membership.isFree).toBe(true);
      expect(result.overviewCards.membership.discountPercentage).toBe(0);
    });

    it('should throw NotFoundException if user is not found', async () => {
      db.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.userDashboardOverview('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('adminDashboardOverview', () => {
    it('should return platform overview metrics', async () => {
      db.user.count
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(45) // customers
        .mockResolvedValueOnce(5) // admins
        .mockResolvedValueOnce(10); // new this month
      db.lead.count
        .mockResolvedValueOnce(100) // total leads
        .mockResolvedValueOnce(80) // sellable
        .mockResolvedValueOnce(20); // exclusive sold
      db.order.count.mockResolvedValueOnce(30);
      db.order.aggregate.mockResolvedValueOnce({
        _count: { id: 28 },
        _sum: { totalAmount: 1500, walletUsed: 800, cardPaid: 700 },
      });
      db.badLeadRequest.count.mockResolvedValueOnce(2);
      db.order.findMany.mockResolvedValueOnce([]);
      db.user.findMany.mockResolvedValueOnce([]);

      const result = await service.adminDashboardOverview();

      expect(result.users.total).toBe(50);
      expect(result.users.customers).toBe(45);
      expect(result.leads.total).toBe(100);
      expect(result.leads.sellable).toBe(80);
      expect(result.financials.totalRevenue).toBe(1500);
      expect(result.pendingBadLeadRequests).toBe(2);
    });
  });

  describe('DashboardController', () => {
    it('should call userDashboardOverview on GET /dashboard/user-overview', async () => {
      const mockOverview = { overviewCards: {} };
      jest
        .spyOn(service, 'userDashboardOverview')
        .mockResolvedValueOnce(mockOverview as any);

      const req = { user: { id: mockUserId } } as any;
      const res = await controller.userDashboardOverview(req);

      expect(res.message).toBe('User dashboard overview fetched successfully');
      expect(res.data).toEqual(mockOverview);
    });

    it('should call adminDashboardOverview on GET /dashboard/admin-overview', async () => {
      const mockAdminOverview = { users: { total: 10 } };
      jest
        .spyOn(service, 'adminDashboardOverview')
        .mockResolvedValueOnce(mockAdminOverview as any);

      const res = await controller.adminDashboardOverview();

      expect(res.message).toBe('Admin dashboard overview fetched successfully');
      expect(res.data).toEqual(mockAdminOverview);
    });
  });
});
