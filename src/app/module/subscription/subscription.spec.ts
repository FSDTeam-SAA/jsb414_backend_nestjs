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
});
