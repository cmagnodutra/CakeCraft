import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { createE2eApp, RecordingEmailSender, resetE2eState } from './e2e-app.helper';

describe('Auth & LGPD (e2e - PostgreSQL 16 real)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let emails: RecordingEmailSender;
  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    ({ app, prisma, emails } = await createE2eApp());
  });

  beforeEach(async () => {
    await resetE2eState(app, prisma, emails);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('persiste usuario e refresh_token no PostgreSQL e entrega cookies httpOnly sem tokens no JSON', async () => {
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

      const persistedUser = await prisma.user.findUnique({
        where: { email: 'mariana@example.com' },
        include: { refreshTokens: true },
      });
      expect(persistedUser?.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(persistedUser?.refreshTokens).toHaveLength(1);
    });

    it('rejeita e-mail duplicado com 409 (case-insensitive), senha invalida (> 72B ou < 8) e mass assignment com 400', async () => {
      await request(server())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'CaseTeste@Example.com', password: 'senha12345' })
        .expect(201);

      await request(server())
        .post('/api/auth/register')
        .send({ name: 'Outra Mariana', email: 'caseteste@example.com', password: 'outra-senha' })
        .expect(409);

      await request(server())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'curta@example.com', password: '123' })
        .expect(400);

      await request(server())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'longa@example.com', password: '\u00e1'.repeat(37) })
        .expect(400);

      await request(server())
        .post('/api/auth/register')
        .send({
          name: 'Mariana',
          email: 'role@example.com',
          password: 'senha12345',
          role: 'ADMIN',
        })
        .expect(400);
    });
  });

  describe('ciclo completo de sessao, rotacao de refresh token, recuperacao de senha e LGPD', () => {
    const credentials = { email: 'mariana@example.com', password: 'senha12345' };

    it('rotaciona refresh_token no PostgreSQL, detecta reuso e revoga sessao no logout', async () => {
      const reg = await request(server())
        .post('/api/auth/register')
        .send({ name: 'Mariana', ...credentials })
        .expect(201);

      const firstCookies = (reg.headers['set-cookie'] as unknown as string[]).join(';');
      const firstRefresh = /refresh_token=([^;]+)/.exec(firstCookies)?.[1] ?? '';

      const rotated = await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', [`refresh_token=${firstRefresh}`])
        .expect(200);

      const secondCookies = (rotated.headers['set-cookie'] as unknown as string[]).join(';');
      const secondRefresh = /refresh_token=([^;]+)/.exec(secondCookies)?.[1] ?? '';
      expect(secondRefresh).not.toBe(firstRefresh);

      // Reuso do refresh antigo invalida todas as sessoes ativas no PostgreSQL
      await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', [`refresh_token=${firstRefresh}`])
        .expect(401);

      await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', [`refresh_token=${secondRefresh}`])
        .expect(401);

      // Novo login seguido de logout revoga o refresh token persistido
      const agent = request.agent(server());
      await agent.post('/api/auth/login').send(credentials).expect(200);
      await agent.get('/api/auth/me').expect(200);
      await agent.post('/api/auth/logout').expect(204);
      await agent.get('/api/auth/me').expect(401);
      await agent.post('/api/auth/refresh').expect(401);
    });

    it('executa forgot-password -> reset-password no PostgreSQL real com token de uso unico', async () => {
      await request(server())
        .post('/api/auth/register')
        .send({ name: 'Mariana', ...credentials })
        .expect(201);

      await request(server())
        .post('/api/auth/forgot-password')
        .send({ email: credentials.email })
        .expect(200);

      expect(emails.sent).toHaveLength(1);
      const tokenMatch = /token=([^"&]+)/.exec(emails.sent[0].html);
      const resetToken = decodeURIComponent(tokenMatch?.[1] ?? '');

      await request(server())
        .post('/api/auth/reset-password')
        .send({ token: resetToken, newPassword: 'novaSenhaSegura456' })
        .expect(204);

      await request(server())
        .post('/api/auth/reset-password')
        .send({ token: resetToken, newPassword: 'outraTentativa456' })
        .expect(400);

      await request(server()).post('/api/auth/login').send(credentials).expect(401);
      await request(server())
        .post('/api/auth/login')
        .send({ email: credentials.email, password: 'novaSenhaSegura456' })
        .expect(200);
    });

    it('anonimiza dados pessoais via DELETE /api/usuarios/me/anonymize (LGPD - Secao 6.1)', async () => {
      const agent = request.agent(server());
      const reg = await agent
        .post('/api/auth/register')
        .send({ name: 'Mariana', phone: '47999999999', ...credentials })
        .expect(201);
      const userId = (reg.body as { user: { id: string } }).user.id;

      await agent.delete('/api/usuarios/me/anonymize').expect(204);

      const row = await prisma.user.findUnique({ where: { id: userId } });
      expect(row?.name).toBe('Usuario Anonimizado');
      expect(row?.email).toBe(`anonimizado-${userId}@anon.cakecraft.local`);
      expect(row?.phone).toBeNull();
      expect(row?.anonymizedAt).not.toBeNull();

      await agent.get('/api/auth/me').expect(401);
      await request(server()).post('/api/auth/login').send(credentials).expect(401);
    });
  });
});
