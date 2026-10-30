import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ConfigService } from '@nestjs/config';

import { configureApp } from '../../app.setup';
import { AppEnvironment } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

/**
 * Teste de integracao HTTP de Rate Limiting (RNF05 e Secao 6 do RFC).
 * Sobe o AppModule real com configureApp para provar:
 *   1. Limite global padrao (60 req/min) aplicado automaticamente via APP_GUARD;
 *   2. Limite mais estrito (10 req/min) contra forca bruta em /api/auth/login e /register;
 *   3. Isencao real de /api/health (> 60 chamadas consecutivas continuam 200 OK);
 *   4. Resposta 429 formatada pelo AllExceptionsFilter + cabecalho Retry-After.
 */
describe('Rate Limiting - ThrottlerGuard (integracao HTTP)', () => {
  let app: INestApplication;

  const fakePrisma = {
    user: {
      findUnique: () => Promise.resolve(null),
      create: () => Promise.resolve(null),
    },
    ingredient: {
      findMany: () => Promise.resolve([]),
    },
  };

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    // Garante variaveis minimas caso rode em CI sem arquivo .env local.
    process.env.NODE_ENV ??= 'test';
    process.env.DATABASE_URL ??= 'postgresql://cakecraft:cakecraft@localhost:5432/cakecraft';
    process.env.REDIS_URL ??= 'redis://localhost:6379';
    process.env.JWT_ACCESS_SECRET ??= 'segredo-throttle-acesso-com-16-mais';
    process.env.JWT_REFRESH_SECRET ??= 'segredo-throttle-refresh-com-16-mais';
    process.env.SMTP_HOST ??= 'smtp-relay.brevo.com';
    process.env.SMTP_USER ??= 'smtp-user';
    process.env.SMTP_PASSWORD ??= 'smtp-password';
    process.env.SMTP_FROM ??= 'CakeCraft <no-reply@cakecraft.dev>';

    const { AppModule } = await import('../../app.module');

    const localRedis = new RedisService({
      get: () => undefined,
    } as unknown as ConfigService<Partial<AppEnvironment>>);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .overrideProvider(RedisService)
      .useValue(localRedis)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    await app.init();
  }, 15_000);

  afterAll(async () => {
    await app.close();
  });

  it('mantem GET /api/health isenta de rate limiting (@SkipThrottle) mesmo acima do teto global de 60 req/min', async () => {
    for (let i = 0; i < 65; i++) {
      await request(server()).get('/api/health').expect(200);
    }
  });

  it('bloqueia inundacao em rota geral (GET /api/catalog) com 429 padronizado apos 60 req/min', async () => {
    for (let i = 0; i < 60; i++) {
      const ok = await request(server()).get('/api/catalog').expect(200);
      expect(ok.headers['x-ratelimit-limit']).toBe('60');
    }

    const blocked = await request(server()).get('/api/catalog').expect(429);

    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.body).toMatchObject({
      statusCode: 429,
      path: '/api/catalog',
    });
    expect(typeof blocked.body.timestamp).toBe('string');
  });

  it('aplica limite estrito (10 req/min) contra forca bruta em POST /api/auth/login', async () => {
    for (let i = 0; i < 10; i++) {
      await request(server())
        .post('/api/auth/login')
        .send({ email: 'alvo@example.com', password: 'tentativa-forca-bruta' })
        .expect(401);
    }

    const blocked = await request(server())
      .post('/api/auth/login')
      .send({ email: 'alvo@example.com', password: 'tentativa-forca-bruta' })
      .expect(429);

    expect(blocked.body).toMatchObject({
      statusCode: 429,
      path: '/api/auth/login',
    });
  });

  it('aplica limite estrito (10 req/min) em POST /api/auth/register', async () => {
    for (let i = 0; i < 10; i++) {
      await request(server())
        .post('/api/auth/register')
        .send({ name: 'Bot', email: 'email-invalido', password: '123' })
        .expect(400);
    }

    await request(server())
      .post('/api/auth/register')
      .send({ name: 'Bot', email: 'email-invalido', password: '123' })
      .expect(429);
  });
});
