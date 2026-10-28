import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { Prisma } from '../prisma/generated/prisma/client';
import { AppModule } from '../src/app.module';
import config from '../src/app/config';
import { passwordVersion } from '../src/app/helper/token';
import { setupApp } from '../src/app/helper/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';

describe('USD wallet HTTP and real Stripe signature verification (database mocked)', () => {
  let app: INestApplication;
  let balance: Prisma.Decimal;
  let settled: boolean;
  let db: any;
  const secret = 'whsec_wallet_http_test';
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'test@example.com',
    role: 'user',
    password: 'test-stored-hash',
  };
  const requestId = '22222222-2222-4222-8222-222222222222';
  const jwt = new JwtService();

  const eventBody = () =>
    JSON.stringify(
      {
        id: 'evt_wallet_test',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_wallet',
            object: 'checkout.session',
            mode: 'payment',
            payment_status: 'paid',
            currency: 'usd',
            amount_total: 200,
            client_reference_id: user.id,
            payment_intent: 'pi_wallet',
            metadata: { purpose: 'WALLET_FUNDING', paymentId: 'payment-1' },
          },
        },
      },
      null,
      2,
    );

  function signature(body: string) {
    const timestamp = Math.floor(Date.now() / 1000);
    const hash = createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');
    return `t=${timestamp},v1=${hash}`;
  }

  function token() {
    return jwt.sign(
      {
        id: user.id,
        purpose: 'access',
        passwordVersion: passwordVersion(user.password),
      },
      { secret: config.jwt.accessTokenSecret, expiresIn: 300 },
    );
  }

  beforeAll(async () => {
    config.stripe.secretKey = 'sk_test_no_network';
    config.stripe.webhookSecret = secret;
    db = {
      user: {
        findUnique: jest.fn(async () => ({ ...user, walletBalance: balance })),
        update: jest.fn(async ({ data }: any) => {
          balance = balance.plus(data.walletBalance.increment);
          return { walletBalance: balance };
        }),
      },
      payment: {
        findUnique: jest.fn(async () => ({
          id: 'payment-1',
          userId: user.id,
          amount: new Prisma.Decimal(2),
          currency: 'USD',
          paymentType: 'ACCOUNT_FUNDING',
          status: settled ? 'COMPLETED' : 'PENDING',
          stripeSessionId: 'cs_wallet',
        })),
        updateMany: jest.fn(async () => {
          if (settled) return { count: 0 };
          settled = true;
          return { count: 1 };
        }),
      },
      walletTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'entry-1' }),
      },
      $transaction: jest.fn(async (fn: any) => fn(db)),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();
    app = module.createNestApplication({ logger: false, rawBody: true });
    setupApp(app);
    await app.init();
  });

  beforeEach(() => {
    balance = new Prisma.Decimal(0);
    settled = false;
    jest.clearAllMocks();
  });
  afterAll(async () => {
    if (app) await app.close();
  });

  it('requires login to create wallet funding', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/wallet/add-funds')
      .send({ amount: 2, requestId })
      .expect(401);
  });

  it.each([
    { amount: 2.001, requestId },
    { amount: 2, requestId: 'bad-id' },
    { amountCents: 200, requestId },
  ])('rejects invalid or legacy wallet input: %j', async (body) => {
    await request(app.getHttpServer())
      .post('/api/v1/wallet/add-funds')
      .set('Authorization', `Bearer ${token()}`)
      .send(body)
      .expect(400);
    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });

  it('rejects unsigned and forged webhook requests', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/webhook/stripe')
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/webhook/stripe')
      .set('stripe-signature', 't=1,v1=fake')
      .send({})
      .expect(400);
    expect(db.payment.findUnique).not.toHaveBeenCalled();
  });

  it('preserves original body bytes, accepts the signed event once, and returns dollars to the customer', async () => {
    const body = eventBody();
    for (let i = 0; i < 2; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/webhook/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', signature(body))
        .send(body)
        .expect(200);
    }
    expect(balance.toNumber()).toBe(2);
    expect(db.walletTransaction.create).toHaveBeenCalledTimes(1);
    const response = await request(app.getHttpServer())
      .get('/api/v1/wallet/balance')
      .set('Authorization', `Bearer ${token()}`)
      .expect(200);
    expect(response.body.data.walletBalance).toBe(2);
    expect(response.body.data.formattedBalance).toBe('$2.00');
    expect(response.body.data.walletBalanceCents).toBeUndefined();
  });

  it('rejects a body changed after it was signed', async () => {
    const body = eventBody();
    await request(app.getHttpServer())
      .post('/api/v1/webhook/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature(body))
      .send(body.replace('200', '300'))
      .expect(400);
    expect(balance.toNumber()).toBe(0);
  });

  it('forbids ordinary customers from making manual credit adjustments', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/wallet/admin/adjust')
      .set('Authorization', `Bearer ${token()}`)
      .send({ userId: user.id, amount: 2, requestId, reason: 'Fake credit' })
      .expect(403);
  });
});
