import { validate } from 'class-validator';
import Stripe from 'stripe';
import { Prisma } from '../../../../prisma/generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import config from '../../config';
import { stripeCents, usd } from '../../helper/usd';
import { WebhookService } from '../webhook/webhook.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { AdminAdjustWalletDto } from './dto/admin-adjust-wallet.dto';
import { WalletService } from './wallet.service';

jest.mock('stripe', () => ({ __esModule: true, default: jest.fn() }));

describe('USD wallet funding (Stripe and database mocked)', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const requestId = '22222222-2222-4222-8222-222222222222';
  let db: any;
  let stripe: any;
  let payment: any;
  let session: any;
  let balance: Prisma.Decimal;
  let wallet: WalletService;
  let webhook: WebhookService;

  beforeEach(() => {
    config.stripe.secretKey = 'sk_test_mock';
    config.stripe.webhookSecret = 'whsec_mock';
    balance = new Prisma.Decimal(0);
    payment = {
      id: 'payment-1',
      userId,
      amount: new Prisma.Decimal(2),
      currency: 'USD',
      paymentType: 'ACCOUNT_FUNDING',
      status: 'PENDING',
      stripeSessionId: null,
      createdAt: new Date(),
    };
    session = {
      id: 'cs_wallet',
      mode: 'payment',
      status: 'open',
      payment_status: 'paid',
      amount_total: 200,
      currency: 'usd',
      client_reference_id: userId,
      payment_intent: 'pi_wallet',
      metadata: { purpose: 'WALLET_FUNDING', paymentId: payment.id },
      url: 'https://checkout.stripe.com/mock',
    };
    stripe = {
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue(session),
          retrieve: jest.fn().mockResolvedValue(session),
        },
      },
      webhooks: {
        constructEvent: jest.fn(() => ({
          type: 'checkout.session.completed',
          data: { object: session },
        })),
      },
    };
    (Stripe as unknown as jest.Mock).mockImplementation(() => stripe);
    db = {
      payment: {
        upsert: jest.fn().mockResolvedValue(payment),
        findUnique: jest.fn().mockResolvedValue(payment),
        update: jest.fn().mockResolvedValue(payment),
        updateMany: jest.fn(async () => {
          if (payment.status !== 'PENDING') return { count: 0 };
          payment.status = 'COMPLETED';
          return { count: 1 };
        }),
      },
      user: {
        findUnique: jest.fn(async () => ({ walletBalance: balance })),
        update: jest.fn(async ({ data }: any) => {
          balance = balance.plus(data.walletBalance.increment);
          return { walletBalance: balance };
        }),
      },
      walletTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'entry-1' }),
      },
    };
    db.$transaction = jest.fn(async (operation: any) => operation(db));
    wallet = new WalletService(db as PrismaService);
    webhook = new WebhookService(db as PrismaService);
  });

  it.each([2, 2.5, 10, 1000])(
    'keeps $%s in the database but converts only the Stripe boundary',
    async (amount) => {
      payment.amount = usd(amount);
      await wallet.addFunds(userId, { amount, requestId });
      const create = db.payment.upsert.mock.calls[0][0].create;
      expect(create.amount.toNumber()).toBe(amount);
      expect(create.status).toBe('PENDING');
      const params = stripe.checkout.sessions.create.mock.calls[0][0];
      expect(params.line_items[0].price_data.unit_amount).toBe(
        Math.round(amount * 100),
      );
      expect(db.user.update).not.toHaveBeenCalled();
      expect(db.walletTransaction.create).not.toHaveBeenCalled();
    },
  );

  it('accepts an amount-only funding DTO', async () => {
    expect(
      await validate(Object.assign(new CreateWalletDto(), { amount: 2 })),
    ).toHaveLength(0);
  });

  it('generates and returns a UUID when the customer only sends amount', async () => {
    const result = await wallet.addFunds(userId, { amount: 2 });
    expect(result.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(db.payment.upsert.mock.calls[0][0].where.fundingRequestKey).toBe(
      `wallet:${userId}:${result.requestId}`,
    );
    expect(result.amount).toBe(2);
  });

  it('does not treat separate amount-only requests as the same attempt', async () => {
    const first = await wallet.addFunds(userId, { amount: 2 });
    const second = await wallet.addFunds(userId, { amount: 2 });
    expect(first.requestId).not.toBe(second.requestId);
  });

  it('preserves a supplied UUID so the frontend can retry safely', async () => {
    const result = await wallet.addFunds(userId, { amount: 2, requestId });
    expect(result.requestId).toBe(requestId);
    expect(db.payment.upsert.mock.calls[0][0].where.fundingRequestKey).toBe(
      `wallet:${userId}:${requestId}`,
    );
  });

  it('credits $2 once when the same signed event is delivered repeatedly', async () => {
    await webhook.handleStripeWebhook(Buffer.from('{}'), 'signature');
    await webhook.handleStripeWebhook(Buffer.from('{}'), 'signature');
    expect(balance.toNumber()).toBe(2);
    expect(db.walletTransaction.create).toHaveBeenCalledTimes(1);
    const data = db.walletTransaction.create.mock.calls[0][0].data;
    expect(data.amount.toNumber()).toBe(2);
    expect(data.balanceAfter.toNumber()).toBe(2);
    expect(data.operationKey).toBe('funding:payment-1');
  });

  it('does not credit the duplicate completed/async-success event pair twice', async () => {
    await webhook.handleStripeWebhook(Buffer.from('{}'), 'signature');
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.async_payment_succeeded',
      data: { object: session },
    });
    await webhook.handleStripeWebhook(Buffer.from('{}'), 'signature');
    expect(balance.toNumber()).toBe(2);
  });

  it.each([
    { amount_total: 2 },
    { currency: 'eur' },
    { client_reference_id: 'another-user' },
  ])(
    'rejects paid events that do not match the pending payment: %j',
    async (change) => {
      Object.assign(session, change);
      await expect(
        webhook.handleStripeWebhook(Buffer.from('{}'), 'signature'),
      ).rejects.toThrow('verification failed');
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(balance.toNumber()).toBe(0);
    },
  );

  it('rejects a different Checkout Session for the same local payment', async () => {
    payment.stripeSessionId = 'cs_other';
    await expect(
      webhook.handleStripeWebhook(Buffer.from('{}'), 'signature'),
    ).rejects.toThrow('verification failed');
    expect(balance.toNumber()).toBe(0);
  });

  it('does not credit an unpaid completed session', async () => {
    session.payment_status = 'unpaid';
    await webhook.handleStripeWebhook(Buffer.from('{}'), 'signature');
    expect(db.payment.findUnique).not.toHaveBeenCalled();
  });

  it('does not accept a forged signature', async () => {
    stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });
    await expect(
      webhook.handleStripeWebhook(Buffer.from('{}'), 'fake'),
    ).rejects.toThrow('Invalid Stripe webhook signature');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('ignores unrelated checkout purposes', async () => {
    session.metadata.purpose = 'LEAD_PURCHASE';
    await webhook.handleStripeWebhook(Buffer.from('{}'), 'signature');
    expect(db.payment.findUnique).not.toHaveBeenCalled();
  });

  it('propagates database failures so Stripe can retry instead of acknowledging lost credit', async () => {
    db.user.update.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(
      webhook.handleStripeWebhook(Buffer.from('{}'), 'signature'),
    ).rejects.toThrow('database unavailable');
    expect(db.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('reuses an existing Checkout Session on a funding retry', async () => {
    payment.stripeSessionId = session.id;
    await wallet.addFunds(userId, { amount: 2, requestId });
    expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith(session.id);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('rejects changing the amount for the same funding request', async () => {
    await expect(
      wallet.addFunds(userId, { amount: 3, requestId }),
    ).rejects.toThrow('different amount');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('does not create a second charge for completed funding', async () => {
    payment.status = 'COMPLETED';
    const result = await wallet.addFunds(userId, { amount: 2, requestId });
    expect(result.status).toBe('COMPLETED');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('blocks recreation of an uncertain session beyond the Stripe idempotency window', async () => {
    payment.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await expect(
      wallet.addFunds(userId, { amount: 2, requestId }),
    ).rejects.toThrow('reconciliation');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('returns the wallet balance in dollars', async () => {
    balance = new Prisma.Decimal('2.50');
    expect(await wallet.getBalance(userId)).toEqual({
      walletBalance: 2.5,
      currency: 'USD',
      formattedBalance: '$2.50',
      balanceType: 'ACCOUNT_CREDIT',
    });
  });

  it.each([2, 2.5, 10000])(
    'accepts valid dollar funding %s',
    async (amount) => {
      expect(
        await validate(
          Object.assign(new CreateWalletDto(), { amount, requestId }),
        ),
      ).toHaveLength(0);
    },
  );

  it.each([0, -2, 2.001, 10001, '2', NaN, Infinity])(
    'rejects invalid dollar funding %s',
    async (amount) => {
      expect(
        (
          await validate(
            Object.assign(new CreateWalletDto(), { amount, requestId }),
          )
        ).length,
      ).toBeGreaterThan(0);
    },
  );

  it('rejects zero adjustments and excess decimal places', async () => {
    for (const amount of [0, 0.001]) {
      const dto = Object.assign(new AdminAdjustWalletDto(), {
        userId,
        requestId,
        amount,
        reason: 'Correction',
      });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    }
    expect(stripeCents(usd(2.5))).toBe(250);
  });

  it('checks balance atomically for admin deductions and records the actor', async () => {
    db.walletTransaction.findUnique = jest.fn().mockResolvedValue(null);
    db.user.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    await expect(
      wallet.adminAdjustBalance('admin-1', {
        userId,
        requestId,
        amount: -2,
        reason: 'Correction',
      }),
    ).rejects.toThrow('Insufficient');
    const where = db.user.updateMany.mock.calls[0][0].where;
    expect(where.walletBalance.gte.toNumber()).toBe(2);
    expect(db.walletTransaction.create).not.toHaveBeenCalled();
  });
});
