import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { createE2eApp, resetE2eState } from './e2e-app.helper';

describe('Auth (e2e - PostgreSQL 16 real)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    ({ app, prisma } = await createE2eApp());
  });

  beforeEach(async () => {
    await resetE2eState(app, prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('persiste no PostgreSQL com hash bcrypt e devolve 201 sem tokens no JSON', async () => {
      const response = await request(server())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'mariana@example.com', password: 'senha12345' })
        .expect(201);

      expect(response.body.user).toMatchObject({
        name: 'Mariana',
        email: 'mariana@example.com',
        role: 'CLIENTE',
        xp: 0,
        level: 1,
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('accessToken');
      expect(response.body).not.toHaveProperty('refreshToken');

      const persisted = await prisma.user.findUnique({ where: { email: 'mariana@example.com' } });
      expect(persisted).not.toBeNull();
      expect(persisted?.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('entrega os tokens como cookies httpOnly, nunca no corpo', async () => {
      const response = await request(server())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'mariana2@example.com', password: 'senha12345' })
        .expect(201);

      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.startsWith('access_token=') && c.includes('HttpOnly'))).toBe(
        true,
      );
      expect(
        cookies.some(
          (c) =>
            c.startsWith('refresh_token=') &&
            c.includes('HttpOnly') &&
            c.includes('Path=/api/auth/refresh'),
        ),
      ).toBe(true);
    });

    it('rejeita e-mail duplicado com 409 (inclusive com variacao de caixa)', async () => {
      await request(server())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'CaseTeste@Example.com', password: 'senha12345' })
        .expect(201);

      await request(server())
        .post('/api/auth/register')
        .send({ name: 'Outra Mariana', email: 'caseteste@example.com', password: 'outra-senha' })
        .expect(409);

      const loginResponse = await request(server())
        .post('/api/auth/login')
        .send({ email: 'CASETESTE@EXAMPLE.COM', password: 'senha12345' })
        .expect(200);

      expect(loginResponse.body.user.email).toBe('caseteste@example.com');
    });

    it('rejeita senha curta (< 8) ou acima de 72 bytes UTF-8 com 400', async () => {
      await request(server())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'curta@example.com', password: '123' })
        .expect(400);

      await request(server())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'longa@example.com', password: '\u00e1'.repeat(37) })
        .expect(400);
    });

    it('rejeita campos nao declarados no DTO - protecao contra mass assignment', async () => {
      await request(server())
        .post('/api/auth/register')
        .send({
          name: 'Mariana',
          email: 'mariana4@example.com',
          password: 'senha12345',
          role: 'ADMIN',
        })
        .expect(400);
    });
  });

  describe('ciclo completo de sessao via cookies httpOnly (login -> me -> logout)', () => {
    const credentials = { email: 'login@example.com', password: 'senha12345' };

    beforeEach(async () => {
      await request(server())
        .post('/api/auth/register')
        .send({ name: 'Mariana', ...credentials })
        .expect(201);
    });

    it('autentica, le a sessao em GET /api/auth/me via cookieParser e encerra em POST /api/auth/logout', async () => {
      const agent = request.agent(server());

      const loginResponse = await agent.post('/api/auth/login').send(credentials).expect(200);
      expect(loginResponse.body.user.email).toBe(credentials.email);

      const meResponse = await agent.get('/api/auth/me').expect(200);
      expect(meResponse.body.user).toMatchObject({
        name: 'Mariana',
        email: credentials.email,
        role: 'CLIENTE',
      });

      await agent.post('/api/auth/logout').expect(204);
      await agent.get('/api/auth/me').expect(401);
    });

    it('rejeita senha incorreta ou e-mail inexistente com 401', async () => {
      await request(server())
        .post('/api/auth/login')
        .send({ email: credentials.email, password: 'senha-errada' })
        .expect(401);

      await request(server())
        .post('/api/auth/login')
        .send({ email: 'nao-cadastrado@example.com', password: 'qualquer-coisa' })
        .expect(401);
    });
  });
});
