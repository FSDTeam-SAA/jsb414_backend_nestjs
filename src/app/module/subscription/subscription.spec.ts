import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../../../prisma/prisma.service';
import Stripe from 'stripe';
import config from '../../config';

jest.mock('stripe', () => ({ __esModule: true, default: jest.fn() }));

describe('Subscription Service - Checkout URL & Free Activation', () => {
  let service: SubscriptionService;
  let db: any;
  let stripeMock: any;
  const userId = '11111111-1111-4111-8111-111111111111';

  beforeAll(() => {
    config.stripe.secretKey = 'sk_test_mock';
    config.frontendUrl = 'http://localhost:3000';
  });

  beforeEach(() => {
    stripeMock = {
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: 'cs_mock_123',
            url: 'https://checkout.stripe.com/pay/cs_mock_123',
          }),
        },
      },
    };
    (Stripe as unknown as jest.Mock).mockImplementation(() => stripeMock);

    db = {
      subscribe: {
        findUnique: jest.fn(),
      },
      userSubscribe: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => ({
          id: 'sub_1',
          ...data,
        })),
        update: jest.fn().mockImplementation(({ data }: any) => ({
          id: 'sub_1',
          ...data,
        })),
        count: jest.fn(),
      },
      payment: {
        create: jest.fn().mockImplementation(({ data }: any) => ({
          id: 'pay_1',
          ...data,
        })),
        update: jest.fn().mockImplementation(({ data }: any) => ({
          id: 'pay_1',
          ...data,
        })),
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(db)),
    };

    service = new SubscriptionService(db as PrismaService);
  });

  it('activates Free ($0) plan immediately with checkoutUrl = null', async () => {
    db.subscribe.findUnique.mockResolvedValueOnce({
      id: 'plan_free',
      title: 'Free',
      price: 0,
      discount: 0,
      isActive: true,
    });

    const result = await service.createSubscriptionPayment(userId, {
      subscribeId: 'plan_free',
    });
    expect(result.checkoutUrl).toBeNull();
    expect(result.message).toContain('Free subscription activated');
    expect(db.userSubscribe.create).toHaveBeenCalled();
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('generates Stripe Checkout URL for paid plan ($49)', async () => {
    db.subscribe.findUnique.mockResolvedValueOnce({
      id: 'plan_silver',
      title: 'Silver',
      price: 49,
      discount: 5,
      currency: 'USD',
      isActive: true,
    });

    const result = await service.createSubscriptionPayment(userId, {
      subscribeId: 'plan_silver',
    });
    expect(result.checkoutUrl).toBe(
      'https://checkout.stripe.com/pay/cs_mock_123',
    );
    expect(result.plan.title).toBe('Silver');
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        client_reference_id: userId,
        metadata: expect.objectContaining({
          purpose: 'SUBSCRIPTION',
          userId,
          subscribeId: 'plan_silver',
        }),
      }),
    );
  });

  describe('recentSubscribeTionUser', () => {
    it('fetches paginated recent subscribers with default options', async () => {
      const mockPayments = [
        {
          id: 'pay_sub_1',
          amount: '49.00',
          currency: 'USD',
          status: 'COMPLETED',
          paymentType: 'SUBSCRIPTION',
          stripeSessionId: 'cs_123',
          receiptUrl: null,
          createdAt: new Date('2026-10-31T10:00:00Z'),
          updatedAt: new Date('2026-10-31T10:05:00Z'),
          user: {
            id: 'u1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phoneNumber: '+1234567890',
            photo: null,
            role: 'user',
            walletBalance: '10.00',
            userSubscribes: [
              {
                id: 'us_1',
                status: 'ACTIVE',
                startDate: new Date('2026-10-31'),
                endDate: new Date('2026-11-30'),
              },
            ],
          },
          subscribe: {
            id: 'sub_silver',
            title: 'Silver',
            subTitle: 'Silver Plan',
            price: '49.00',
            discount: 5,
            currency: 'USD',
            leadAccessLimit: 100,
            features: ['Feature 1'],
          },
        },
      ];

      db.payment.findMany.mockResolvedValueOnce(mockPayments);
      db.payment.count.mockResolvedValueOnce(1);

      const result = await service.recentSubscribeTionUser({}, { page: 1, limit: 10 });

      expect(db.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ paymentType: 'SUBSCRIPTION' }]),
          }),
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );

      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(mockPayments[0]);
    });

    it('applies searchTerm and status filters', async () => {
      db.payment.findMany.mockResolvedValueOnce([]);
      db.payment.count.mockResolvedValueOnce(0);

      await service.recentSubscribeTionUser(
        {
          searchTerm: 'gold',
          status: 'COMPLETED' as any,
        },
        { page: 2, limit: 5 },
      );

      expect(db.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { paymentType: 'SUBSCRIPTION' },
              expect.objectContaining({
                AND: expect.arrayContaining([{ status: 'COMPLETED' }]),
              }),
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { receiptUrl: { contains: 'gold', mode: 'insensitive' } },
                ]),
              }),
            ]),
          }),
          skip: 5,
          take: 5,
        }),
      );
    });
  });

  describe('subscripeOverview', () => {
    it('calculates active member counts and plan revenues matching dashboard cards', async () => {
      // 1. activePadTotalUser: 1842
      // 2. silverTotalMember: 600
      // 3. goldTotalMemeber: 400
      // 4. diamonTotalMember: 842
      db.userSubscribe.count
        .mockResolvedValueOnce(1842)
        .mockResolvedValueOnce(600)
        .mockResolvedValueOnce(400)
        .mockResolvedValueOnce(842);

      // 5. totalMemeberSubscribeRevenue: 10842
      // 6. silverPlanReveniy: 6000
      // 7. goldPlanReveniy: 4000
      // 8. diamonPlanReveniy: 842
      db.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amount: '10842.00' } })
        .mockResolvedValueOnce({ _sum: { amount: '6000.00' } })
        .mockResolvedValueOnce({ _sum: { amount: '4000.00' } })
        .mockResolvedValueOnce({ _sum: { amount: '842.00' } });

      const overview = await service.subscripeOverview();

      expect(overview).toEqual({
        activePadTotalUser: 1842,
        silverTotalMember: 600,
        goldTotalMemeber: 400,
        diamonTotalMember: 842,

        totalMemeberSubscribeRevenue: 10842,
        silverPlanReveniy: 6000,
        goldPlanReveniy: 4000,
        diamonPlanReveniy: 842,

        activePaidTotalUser: 1842,
        goldTotalMember: 400,
        diamondTotalMember: 842,
        totalMemberSubscribeRevenue: 10842,
        silverPlanRevenue: 6000,
        goldPlanRevenue: 4000,
        diamondPlanRevenue: 842,
      });
    });

    it('defaults revenues to 0 when no payments exist', async () => {
      db.userSubscribe.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      db.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });

      const overview = await service.subscripeOverview();

      expect(overview.activePadTotalUser).toBe(0);
      expect(overview.totalMemeberSubscribeRevenue).toBe(0);
      expect(overview.silverPlanReveniy).toBe(0);
      expect(overview.goldPlanReveniy).toBe(0);
      expect(overview.diamonPlanReveniy).toBe(0);
    });
  });
});
