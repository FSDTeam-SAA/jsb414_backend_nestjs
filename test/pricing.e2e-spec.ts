import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { Prisma } from '../prisma/generated/prisma/client';
import { AppModule } from '../src/app.module';
import config from '../src/app/config';
import { passwordVersion } from '../src/app/helper/token';
import { setupApp } from '../src/app/helper/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Direct dollar pricing API contracts (database mocked)', () => {
  let app: INestApplication;
  let db: any;
  const id = '11111111-1111-4111-8111-111111111111';
  const user = {
    id,
    email: 'admin@example.com',
    role: 'admin',
    password: 'stored-test-hash',
  };
  const category = {
    id,
    name: 'Mortgage',
    isActive: true,
    sharedBasePrice: new Prisma.Decimal('2.50'),
    exclusiveBasePrice: new Prisma.Decimal(10),
    agePricingEnabled: false,
  };

  function token() {
    return new JwtService().sign(
      {
        id,
        purpose: 'access',
        passwordVersion: passwordVersion(user.password),
      },
      { secret: config.jwt.accessTokenSecret, expiresIn: 300 },
    );
  }

  beforeAll(async () => {
    db = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      catagorie: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(category),
        create: jest.fn(async ({ data }: any) => ({
          id,
          ...data,
          sharedBasePrice: new Prisma.Decimal(data.sharedBasePrice),
          exclusiveBasePrice: new Prisma.Decimal(data.exclusiveBasePrice),
        })),
      },
      agePriceRule: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }: any) => ({
          id,
          ...data,
          price: new Prisma.Decimal(data.price),
        })),
      },
      lead: {
        create: jest.fn(async ({ data }: any) => ({
          id,
          ...data,
          category,
        })),
      },
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();
    app = module.createNestApplication({ logger: false });
    setupApp(app);
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterAll(async () => {
    if (app) await app.close();
  });

  it('takes multipart category price 2.50 as $2.50 and returns numbers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/categories/create')
      .set('Authorization', `Bearer ${token()}`)
      .field('name', 'Mortgage')
      .field('sharedBasePrice', '2.50')
      .field('exclusiveBasePrice', '10')
      .expect(201);
    expect(db.catagorie.create.mock.calls[0][0].data.sharedBasePrice).toBe(2.5);
    expect(response.body.data.sharedBasePrice).toBe(2.5);
    expect(response.body.data.exclusiveBasePrice).toBe(10);
    expect(response.body.data.sharedBasePriceCents).toBeUndefined();
  });

  it('rejects legacy category cents input instead of reinterpreting it', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/categories/create')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Mortgage', sharedBasePriceCents: 250 })
      .expect(400);
    expect(db.catagorie.create).not.toHaveBeenCalled();
  });

  it('takes an age-rule price of 2.50 as dollars', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/age-price')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        categoryId: id,
        priceType: 'SHARED',
        minDays: 0,
        maxDays: 7,
        price: 2.5,
      })
      .expect(201);
    expect(response.body.data.price).toBe(2.5);
    expect(db.agePriceRule.create.mock.calls[0][0].data.price).toBe(2.5);
  });

  it('rejects over-precision price input', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/age-price')
      .set('Authorization', `Bearer ${token()}`)
      .send({ categoryId: id, priceType: 'SHARED', minDays: 0, price: 2.001 })
      .expect(400);
    expect(db.agePriceRule.create).not.toHaveBeenCalled();
  });

  it('creates a lead without copying category prices and shows the current category dollar price', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/lead/create')
      .set('Authorization', `Bearer ${token()}`)
      .send({ categoryId: id, availability: 'SHARED' })
      .expect(201);
    const data = db.lead.create.mock.calls[0][0].data;
    expect(data.sharedBasePriceCents).toBeUndefined();
    expect(data.legacySharedPrice).toBeUndefined();
    expect(response.body.data.sharedPrice).toBe(2.5);
    expect(response.body.data.legacySharedPrice).toBeUndefined();
    expect(response.body.data.exclusivePrice).toBeNull();
  });

  it('rejects the removed manual lead price field', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/lead/create')
      .set('Authorization', `Bearer ${token()}`)
      .send({ categoryId: id, priceCents: 250 })
      .expect(400);
    expect(db.lead.create).not.toHaveBeenCalled();
  });

  it('requires authentication for membership-aware marketplace prices', async () => {
    await request(app.getHttpServer()).get('/api/v1/marketplace').expect(401);
  });
});
