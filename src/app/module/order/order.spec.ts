import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { Prisma } from '../../../../prisma/generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import config from '../../config';
import { OrderService } from './order.service';

jest.mock('stripe', () => ({ __esModule: true, default: jest.fn() }));

describe('OrderService', () => {
  let service: OrderService;
  let db: any;
  let stripeMock: any;
  const userId = '11111111-1111-4111-8111-111111111111';

  beforeAll(() => {
    config.stripe.secretKey = 'sk_test_order_mock';
    config.frontendUrl = 'http://localhost:3000';
  });

  beforeEach(() => {
    stripeMock = {
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: 'cs_order_session_123',
            url: 'https://checkout.stripe.com/pay/cs_order_session_123',
          }),
        },
      },
    };
    (Stripe as unknown as jest.Mock).mockImplementation(() => stripeMock);

    db = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      cartItem: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      userLead: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      lead: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      order: {
        create: jest.fn().mockImplementation(({ data }: any) => ({
          id: 'order_uuid_1',
          ...data,
        })),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      orderItem: {
        createMany: jest.fn(),
      },
      walletTransaction: {
        create: jest.fn(),
      },
      agePriceRule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userSubscribe: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (cb: any) => cb(db)),
    };

    service = new OrderService(db as PrismaService);
  });

  describe('checkout', () => {
    const mockLead = {
      id: 'lead_1',
      leadNumber: 101,
      createdAt: new Date(),
      status: 'ACTIVE',
      classification: 'SELLABLE',
      availability: 'SHARED',
      exclusiveSoldAt: null,
      sharedLimit: 5,
      sharedSalesCount: 1,
      category: {
        id: 'cat_1',
        name: 'Tax Liens',
        isActive: true,
        sharedBasePrice: new Prisma.Decimal('10.00'),
        exclusiveBasePrice: new Prisma.Decimal('50.00'),
        agePricingEnabled: false,
      },
    };

    it('throws NotFoundException if user does not exist', async () => {
      db.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.checkout(userId, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException if cart is empty', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        id: userId,
        email: 'test@example.com',
        walletBalance: 100,
      });
      db.cartItem.findMany.mockResolvedValueOnce([]);

      await expect(service.checkout(userId, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if lead was already purchased by user', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        id: userId,
        email: 'test@example.com',
        walletBalance: 100,
      });
      db.cartItem.findMany.mockResolvedValueOnce([
        {
          id: 'cart_1',
          priceType: 'SHARED',
          lead: mockLead,
        },
      ]);
      db.userLead.findUnique.mockResolvedValueOnce({ id: 'user_lead_existing' });

      await expect(service.checkout(userId, {})).rejects.toThrow(
        'is already purchased by you',
      );
    });

    it('throws BadRequestException if exclusive lead was already sold', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        id: userId,
        email: 'test@example.com',
        walletBalance: 100,
      });
      db.cartItem.findMany.mockResolvedValueOnce([
        {
          id: 'cart_1',
          priceType: 'EXCLUSIVE',
          lead: { ...mockLead, exclusiveSoldAt: new Date() },
        },
      ]);

      await expect(service.checkout(userId, {})).rejects.toThrow(
        'not available for exclusive purchase',
      );
    });

    it('completes order with 100% wallet balance when funds are sufficient', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        id: userId,
        email: 'test@example.com',
        walletBalance: 100, // $100 balance vs $10 lead
      });
      db.cartItem.findMany.mockResolvedValueOnce([
        {
          id: 'cart_1',
          priceType: 'SHARED',
          lead: mockLead,
        },
      ]);

      const result = await service.checkout(userId, { useWallet: true });

      expect(result.checkoutUrl).toBeNull();
      expect(result.walletUsed).toBe(10);
      expect(result.cardPaid).toBe(0);
      expect(result.totalAmount).toBe(10);
      expect(result.itemsCount).toBe(1);
      expect(result.message).toContain('wallet balance');

      expect(db.order.create).toHaveBeenCalled();
      expect(db.orderItem.createMany).toHaveBeenCalled();
      expect(db.userLead.create).toHaveBeenCalled();
      expect(db.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead_1' },
          data: { sharedSalesCount: { increment: 1 } },
        }),
      );
      expect(db.cartItem.deleteMany).toHaveBeenCalled();
      expect(db.walletTransaction.create).toHaveBeenCalled();
    });

    it('creates Stripe checkout session when card payment is required', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        id: userId,
        email: 'test@example.com',
        walletBalance: 4, // $4 wallet balance vs $10 lead -> $6 card needed
      });
      db.cartItem.findMany.mockResolvedValueOnce([
        {
          id: 'cart_1',
          priceType: 'SHARED',
          lead: mockLead,
        },
      ]);

      const result = await service.checkout(userId, { useWallet: true });

      expect(result.checkoutUrl).toBe(
        'https://checkout.stripe.com/pay/cs_order_session_123',
      );
      expect(result.walletUsed).toBe(4);
      expect(result.cardPaid).toBe(6);
      expect(result.totalAmount).toBe(10);
      expect(stripeMock.checkout.sessions.create).toHaveBeenCalled();
      expect(db.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { stripePaymentId: 'cs_order_session_123' },
        }),
      );
    });
  });

  describe('getMyLeads', () => {
    it('returns paginated purchased leads for the user with full details', async () => {
      db.userLead.findMany.mockResolvedValueOnce([
        {
          id: 'ul_1',
          leadId: 'lead_1',
          priceType: 'SHARED',
          pricePaid: new Prisma.Decimal('10.00'),
          purchasedAt: new Date(),
          orderId: 'ord_1',
          lead: {
            id: 'lead_1',
            leadNumber: 101,
            firstName: 'John',
            lastName: 'Doe',
            propertyAddress: '123 Main St',
            unitNumber: null,
            city: 'Tampa',
            county: 'Hillsborough',
            state: 'FL',
            zipcode: '33601',
            propertyType: 'Single Family',
            propertyImage: null,
            estValue: 350000,
            estEquity: 120000,
            mortgageBalance: 230000,
            saleDate: null,
            stage: 'Pre-Foreclosure',
            mortgageInformation: 'Wells Fargo',
            phoneNumbers: ['+1-555-1234'],
            emailAddresses: ['john@example.com'],
            source: 'County Clerk',
            category: { id: 'cat_1', name: 'Pre-Foreclosure' },
          },
        },
      ]);
      db.userLead.count.mockResolvedValueOnce(1);

      const result = await service.getMyLeads(
        userId,
        { city: 'Tampa' },
        { page: 1, limit: 10 },
      );

      expect(result.meta.total).toBe(1);
      expect(result.data.length).toBe(1);
      expect(result.data[0].lead.firstName).toBe('John');
      expect(result.data[0].lead.phoneNumbers).toContain('+1-555-1234');
      expect(result.data[0].lead.emailAddresses).toContain('john@example.com');
      expect(db.userLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { purchasedAt: 'desc' },
        }),
      );
    });
  });

  describe('exportMyLeadsCsv', () => {
    it('formats CSV and sends it via express Response', async () => {
      db.userLead.findMany.mockResolvedValueOnce([
        {
          id: 'ul_1',
          priceType: 'SHARED',
          pricePaid: new Prisma.Decimal('15.50'),
          purchasedAt: new Date('2026-11-01T12:00:00Z'),
          lead: {
            leadNumber: 101,
            firstName: 'Alice',
            lastName: 'Smith',
            propertyAddress: '456 Ocean Dr',
            unitNumber: 'Apt 4B',
            city: 'Miami',
            county: 'Miami-Dade',
            state: 'FL',
            zipcode: '33139',
            propertyType: 'Condo',
            estValue: 500000,
            estEquity: 200000,
            mortgageBalance: 300000,
            stage: 'Auction',
            phoneNumbers: ['+1-555-9999'],
            emailAddresses: ['alice@example.com'],
            category: { name: 'Tax Deed' },
          },
        },
      ]);

      const res: any = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await service.exportMyLeadsCsv(userId, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv; charset=utf-8',
      );
      expect(res.send).toHaveBeenCalled();
      const csvOutput = res.send.mock.calls[0][0];
      expect(csvOutput).toContain('Alice');
      expect(csvOutput).toContain('456 Ocean Dr');
      expect(csvOutput).toContain('$15.50');
    });
  });

  describe('getMyOrders', () => {
    it('returns paginated orders for the user', async () => {
      db.order.findMany.mockResolvedValueOnce([
        {
          id: 'ord_1',
          orderNumber: 'FG-ORD-10001',
          subtotal: new Prisma.Decimal('20.00'),
          discount: new Prisma.Decimal('0.00'),
          totalAmount: new Prisma.Decimal('20.00'),
          walletUsed: new Prisma.Decimal('20.00'),
          cardPaid: new Prisma.Decimal('0.00'),
          status: 'COMPLETED',
          stripePaymentId: null,
          receiptUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          orderItems: [
            {
              id: 'oi_1',
              leadId: 'lead_1',
              priceType: 'SHARED',
              originalPrice: new Prisma.Decimal('20.00'),
              discount: new Prisma.Decimal('0.00'),
              pricePaid: new Prisma.Decimal('20.00'),
              lead: {
                id: 'lead_1',
                leadNumber: 101,
                city: 'Tampa',
                state: 'FL',
                propertyType: 'Single Family',
              },
            },
          ],
        },
      ]);
      db.order.count.mockResolvedValueOnce(1);

      const result = await service.getMyOrders(userId, {}, { page: 1, limit: 10 });
      expect(result.meta.total).toBe(1);
      expect(result.data[0].orderNumber).toBe('FG-ORD-10001');
      expect(result.data[0].itemsCount).toBe(1);
    });
  });

  describe('getOrderById', () => {
    it('returns single order details for owner', async () => {
      db.order.findUnique.mockResolvedValueOnce({
        id: 'ord_1',
        orderNumber: 'FG-ORD-10001',
        userId,
        user: { id: userId, email: 'test@example.com' },
        subtotal: new Prisma.Decimal('20.00'),
        discount: new Prisma.Decimal('0.00'),
        totalAmount: new Prisma.Decimal('20.00'),
        walletUsed: new Prisma.Decimal('20.00'),
        cardPaid: new Prisma.Decimal('0.00'),
        status: 'COMPLETED',
        orderItems: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getOrderById('ord_1', userId);
      expect(result.orderNumber).toBe('FG-ORD-10001');
    });

    it('throws ForbiddenException if another non-admin user attempts to view the order', async () => {
      db.order.findUnique.mockResolvedValueOnce({
        id: 'ord_1',
        orderNumber: 'FG-ORD-10001',
        userId: 'other_user_id',
        user: { id: 'other_user_id', email: 'other@example.com' },
      });
      db.user.findUnique.mockResolvedValueOnce({
        id: userId,
        role: 'user', // non-admin
      });

      await expect(service.getOrderById('ord_1', userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getAllOrdersAdmin', () => {
    it('returns paginated orders for admin', async () => {
      db.order.findMany.mockResolvedValueOnce([
        {
          id: 'ord_1',
          orderNumber: 'FG-ORD-10001',
          user: { id: userId, email: 'customer@example.com' },
          subtotal: new Prisma.Decimal('50.00'),
          discount: new Prisma.Decimal('0.00'),
          totalAmount: new Prisma.Decimal('50.00'),
          walletUsed: new Prisma.Decimal('10.00'),
          cardPaid: new Prisma.Decimal('40.00'),
          status: 'COMPLETED',
          orderItems: [{}],
          createdAt: new Date(),
        },
      ]);
      db.order.count.mockResolvedValueOnce(1);

      const result = await service.getAllOrdersAdmin({}, { page: 1, limit: 10 });
      expect(result.meta.total).toBe(1);
      expect(result.data[0].orderNumber).toBe('FG-ORD-10001');
      expect(result.data[0].cardPaid).toBe(40);
    });
  });
});
