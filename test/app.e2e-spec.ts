import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/app/helper/setup-app';
import config from '../src/app/config';
import { passwordVersion } from '../src/app/helper/token';

describe('HTTP validation and permissions (database mocked)', () => {
  let app: INestApplication;
  let db: any;
  const jwt = new JwtService();
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'user@example.com',
    role: 'user',
    password: 'stored-hash',
  };

  function token(purpose = 'access') {
    return jwt.sign(
      { id: user.id, purpose, passwordVersion: passwordVersion(user.password) },
      { secret: config.jwt.accessTokenSecret, expiresIn: 300 },
    );
  }

  beforeAll(async () => {
    config.jwt.accessTokenSecret = 'test-access-secret-at-least-32-characters';
    config.jwt.refreshTokenSecret =
      'test-refresh-secret-at-least-32-characters';
    db = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      subscribe: {
        create: jest.fn(),
        update: jest.fn(async ({ data }: any) => ({ id: user.id, ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
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
    user.role = 'user';
    jest.clearAllMocks();
  });
  afterAll(async () => {
    if (app) await app.close();
  });

  it('serves the actual HTML landing response', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Server');
  });

  it('returns live status without exposing server details', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200);
    expect(response.body.data).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('returns 503 when the database health check fails', async () => {
    db.$queryRaw.mockRejectedValueOnce(
      new Error('secret database connection string'),
    );
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(503);
    expect(JSON.stringify(response.body)).not.toContain('secret database');
  });

  it('rejects fields that could give a registering user admin privileges', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth')
      .send({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phoneNumber: '+8801700000000',
        password: 'Strong-password123',
        role: 'admin',
      })
      .expect(400);
  });

  it('rejects password resets without the reset token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ email: 'test@example.com', newPassword: 'Strong-password123' })
      .expect(400);
  });

  it('requires authentication to read a user profile', async () => {
    await request(app.getHttpServer()).get('/api/v1/user/profile').expect(401);
  });

  it('refuses a reset token as an access token, even with a valid signature', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/user/profile')
      .set('Authorization', 'Bearer ' + token('password-reset'))
      .expect(401);
  });

  it('prevents ordinary users from creating subscription plans', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/subscription')
      .set('Authorization', 'Bearer ' + token())
      .send({ title: 'Silver', subTitle: 'Plan', price: 4900, discount: 5 })
      .expect(403);
    expect(db.subscribe.create).not.toHaveBeenCalled();
  });

  it('exposes active plans publicly without selecting admin details', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/subscription/active')
      .expect(200);
    const query = db.subscribe.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ isActive: true });
    expect(query).not.toHaveProperty('include');
    expect(query.select).not.toHaveProperty('createdById');
  });

  it('protects full plan listings containing admin information', async () => {
    await request(app.getHttpServer()).get('/api/v1/subscription').expect(401);
  });

  it('converts isActive=false to a real boolean in admin filters', async () => {
    user.role = 'admin';
    await request(app.getHttpServer())
      .get('/api/v1/subscription?isActive=false')
      .set('Authorization', 'Bearer ' + token())
      .expect(200);
    expect(db.subscribe.findMany.mock.calls[0][0].where.AND).toContainEqual({
      AND: [{ isActive: false }],
    });
  });

  it('rejects null plan titles before updating the database', async () => {
    user.role = 'admin';
    await request(app.getHttpServer())
      .patch('/api/v1/subscription/' + user.id)
      .set('Authorization', 'Bearer ' + token())
      .send({ title: null })
      .expect(400);
    expect(db.subscribe.update).not.toHaveBeenCalled();
  });

  it('uses the current database role, not old role claims from a token', async () => {
    const oldAdminToken = jwt.sign(
      {
        id: user.id,
        role: 'admin',
        purpose: 'access',
        passwordVersion: passwordVersion(user.password),
      },
      { secret: config.jwt.accessTokenSecret, expiresIn: 300 },
    );
    await request(app.getHttpServer())
      .post('/api/v1/subscription')
      .set('Authorization', 'Bearer ' + oldAdminToken)
      .send({})
      .expect(403);
  });

  it('rejects negative pagination before querying the database', async () => {
    user.role = 'admin';
    await request(app.getHttpServer())
      .get('/api/v1/user?page=-1')
      .set('Authorization', 'Bearer ' + token())
      .expect(400);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it('rejects invalid user IDs', async () => {
    user.role = 'admin';
    await request(app.getHttpServer())
      .get('/api/v1/user/not-a-uuid')
      .set('Authorization', 'Bearer ' + token())
      .expect(400);
  });

  it('records which superadmin updated a plan', async () => {
    user.role = 'superadmin';
    await request(app.getHttpServer())
      .patch('/api/v1/subscription/' + user.id)
      .set('Authorization', 'Bearer ' + token())
      .send({ title: 'Updated', isActive: false })
      .expect(200);
    expect(db.subscribe.update.mock.calls[0][0].data.updatedById).toBe(user.id);
  });

  it('limits repeated authentication requests', async () => {
    const clock = jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.now() + 16 * 60 * 1000);
    try {
      for (let i = 0; i < 20; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({})
          .expect(400);
      }
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(429);
    } finally {
      clock.mockRestore();
    }
  });
});
