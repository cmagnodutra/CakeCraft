import { randomUUID } from 'node:crypto';

import { Global, INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { configureApp } from '../app.setup';
import { EMAIL_SENDER_PORT, SendEmailInput } from '../email/email-sender.port';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from './auth.module';

/**
 * Teste de integracao HTTP da sessao completa: sobe o AuthModule REAL
 * (AuthController + UsersController, guards, estrategia JWT, cookie-parser,
 * ValidationPipe, filtro de erros e CORS via configureApp) trocando apenas
 * persistencia e SMTP por memoria.
 */
const ENV = {
  NODE_ENV: 'test',
  CORS_ORIGIN: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'segredo-de-acesso-so-para-teste-longo',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'segredo-de-refresh-so-para-teste-longo',
  JWT_REFRESH_EXPIRES_IN: '7d',
  BCRYPT_SALT_ROUNDS: 4,
  SMTP_HOST: 'smtp-relay.brevo.com',
  SMTP_PORT: 587,
  SMTP_USER: 'smtp-user-test',
  SMTP_PASSWORD: 'smtp-pass-test',
  SMTP_FROM: 'CakeCraft <no-reply@cakecraft.dev>',
};

interface StoredUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  role: string;
  xp: number;
  level: number;
  dietaryRestrictions: string[];
  dietaryConsentAt: Date | null;
  anonymizedAt: Date | null;
}

interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

const users: StoredUser[] = [];
const refreshTokens: StoredRefreshToken[] = [];
const sentEmails: SendEmailInput[] = [];

const fakePrisma = {
  user: {
    findUnique: ({ where }: { where: { id?: string; email?: string } }) =>
      Promise.resolve(
        users.find((u) => (where.id ? u.id === where.id : u.email === where.email)) ?? null,
      ),
    create: ({ data }: { data: Partial<StoredUser> & { email: string } }) => {
      const user: StoredUser = {
        id: randomUUID(),
        name: 'Usuario',
        passwordHash: '',
        role: 'CLIENTE',
        xp: 0,
        level: 1,
        phone: null,
        dietaryRestrictions: [],
        dietaryConsentAt: null,
        anonymizedAt: null,
        ...data,
      };
      users.push(user);
      return Promise.resolve(user);
    },
    update: ({ where, data }: { where: { id: string }; data: Partial<StoredUser> }) => {
      const idx = users.findIndex((u) => u.id === where.id);
      users[idx] = { ...users[idx], ...data };
      return Promise.resolve(users[idx]);
    },
  },
  refreshToken: {
    create: ({ data }: { data: Omit<StoredRefreshToken, 'id' | 'revokedAt'> }) => {
      const created: StoredRefreshToken = {
        id: randomUUID(),
        revokedAt: null,
        ...data,
      };
      refreshTokens.push(created);
      return Promise.resolve(created);
    },
    findFirst: ({ where }: { where: { userId: string; tokenHash: string } }) =>
      Promise.resolve(
        refreshTokens.find(
          (item) => item.userId === where.userId && item.tokenHash === where.tokenHash,
        ) ?? null,
      ),
    update: ({ where, data }: { where: { id: string }; data: Partial<StoredRefreshToken> }) => {
      const idx = refreshTokens.findIndex((item) => item.id === where.id);
      refreshTokens[idx] = { ...refreshTokens[idx], ...data };
      return Promise.resolve(refreshTokens[idx]);
    },
    updateMany: ({
      where,
      data,
    }: {
      where: { userId: string; revokedAt: null };
      data: { revokedAt: Date };
    }) => {
      let count = 0;
      for (const item of refreshTokens) {
        if (item.userId === where.userId && item.revokedAt === null) {
          item.revokedAt = data.revokedAt;
          count++;
        }
      }
      return Promise.resolve({ count });
    },
  },
  order: {
    updateMany: () => Promise.resolve({ count: 0 }),
  },
  $transaction: (ops: Array<Promise<unknown>>) => Promise.all(ops),
};

@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: fakePrisma }],
  exports: [PrismaService],
})
class FakePrismaModule {}

const NEW_USER = { name: 'Mariana Silva', email: 'mariana@example.com', password: 'senha12345' };

describe('Sessao (integracao HTTP)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ENV] }),
        FakePrismaModule,
        AuthModule,
      ],
    })
      .overrideProvider(EMAIL_SENDER_PORT)
      .useValue({
        send: (email: SendEmailInput) => {
          sentEmails.push(email);
          return Promise.resolve();
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app, ENV.CORS_ORIGIN);
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(() => app.close());
  beforeEach(() => {
    users.length = 0;
    refreshTokens.length = 0;
    sentEmails.length = 0;
  });

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  async function loggedInBrowser() {
    const browser = request.agent(server());
    await browser.post('/api/auth/register').send(NEW_USER).expect(201);
    return browser;
  }

  const expiredAccessToken = () =>
    jwt.signAsync(
      { sub: 'x', email: 'a@b.com', role: 'CLIENTE', exp: Math.floor(Date.now() / 1000) - 60 },
      { secret: ENV.JWT_ACCESS_SECRET },
    );

  describe('GET /api/auth/me', () => {
    it('sem cookie: 401', async () => {
      await request(server()).get('/api/auth/me').expect(401);
    });

    it('com a sessao criada pelo cadastro: 200 e o usuario publico', async () => {
      const browser = await loggedInBrowser();

      const res = await browser.get('/api/auth/me').expect(200);

      expect(res.body).toEqual({
        user: expect.objectContaining({
          name: 'Mariana Silva',
          email: 'mariana@example.com',
          role: 'CLIENTE',
          xp: 0,
          level: 1,
        }),
      });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|senha12345/);
    });

    it('reflete o banco, nao o token: o XP novo aparece sem precisar logar de novo', async () => {
      const browser = await loggedInBrowser();
      users[0].xp = 450;

      const res = await browser.get('/api/auth/me').expect(200);

      expect((res.body as { user: { xp: number } }).user.xp).toBe(450);
    });

    it('token adulterado, com outro segredo, expirado ou usando refresh no lugar de access: 401', async () => {
      await request(server())
        .get('/api/auth/me')
        .set('Cookie', ['access_token=isto.nao.e-um-jwt'])
        .expect(401);

      const forged = await jwt.signAsync(
        { sub: 'x', email: 'a@b.com', role: 'ADMIN' },
        { secret: 'segredo-do-atacante', expiresIn: '15m' },
      );
      await request(server())
        .get('/api/auth/me')
        .set('Cookie', [`access_token=${forged}`])
        .expect(401);

      const expired = await expiredAccessToken();
      await request(server())
        .get('/api/auth/me')
        .set('Cookie', [`access_token=${expired}`])
        .expect(401);

      const register = await request(server())
        .post('/api/auth/register')
        .send(NEW_USER)
        .expect(201);
      const cookies = register.headers['set-cookie'] as unknown as string[];
      const refresh = /refresh_token=([^;]+)/.exec(cookies.join(';'))?.[1];

      await request(server())
        .get('/api/auth/me')
        .set('Cookie', [`access_token=${refresh}`])
        .expect(401);
    });

    it('usuario apagado ou anonimizado (LGPD) depois do login: 401', async () => {
      const browser = await loggedInBrowser();
      users[0].anonymizedAt = new Date();
      await browser.get('/api/auth/me').expect(401);

      users.length = 0;
      await browser.get('/api/auth/me').expect(401);
    });
  });

  describe('POST /api/auth/refresh (rotacao de cookie e deteccao de reuso)', () => {
    it('renova a sessao pelo cookie httpOnly refresh_token e invalida o refresh antigo contra reuso', async () => {
      const reg = await request(server()).post('/api/auth/register').send(NEW_USER).expect(201);
      const initialCookies = (reg.headers['set-cookie'] as unknown as string[]).join(';');
      const firstRefresh = /refresh_token=([^;]+)/.exec(initialCookies)?.[1] ?? '';

      const refreshed = await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', [`refresh_token=${firstRefresh}`])
        .expect(200);

      expect(refreshed.body.user.email).toBe('mariana@example.com');
      const rotatedCookies = (refreshed.headers['set-cookie'] as unknown as string[]).join(';');
      const secondRefresh = /refresh_token=([^;]+)/.exec(rotatedCookies)?.[1] ?? '';
      expect(secondRefresh).not.toBe(firstRefresh);

      // Reuso do primeiro refresh_token revoga inclusive o segundo!
      await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', [`refresh_token=${firstRefresh}`])
        .expect(401);

      await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', [`refresh_token=${secondRefresh}`])
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('responde 204, apaga os dois cookies e revoga o refresh token no servidor', async () => {
      const browser = await loggedInBrowser();
      await browser.get('/api/auth/me').expect(200);

      const res = await browser.post('/api/auth/logout').expect(204);

      const cookies = (res.headers['set-cookie'] as unknown as string[]).join('\n');
      expect(cookies).toMatch(/access_token=;[^\n]*Path=\/;[^\n]*Expires=Thu, 01 Jan 1970/);
      expect(cookies).toMatch(
        /refresh_token=;[^\n]*Path=\/api\/auth\/refresh;[^\n]*Expires=Thu, 01 Jan 1970/,
      );

      await browser.get('/api/auth/me').expect(401);
      await browser.post('/api/auth/refresh').expect(401);
    });

    it('funciona sem estar logado e so aceita POST', async () => {
      await request(server()).post('/api/auth/logout').expect(204);
      await request(server()).get('/api/auth/logout').expect(404);
    });
  });

  describe('POST /api/auth/forgot-password e POST /api/auth/reset-password', () => {
    it('envia link de recuperacao, redefine a senha, bloqueia reuso do token e permite login com a nova senha', async () => {
      await request(server()).post('/api/auth/register').send(NEW_USER).expect(201);

      await request(server())
        .post('/api/auth/forgot-password')
        .send({ email: NEW_USER.email })
        .expect(200);

      expect(sentEmails).toHaveLength(1);
      const tokenMatch = /token=([^"&]+)/.exec(sentEmails[0].html);
      const token = decodeURIComponent(tokenMatch?.[1] ?? '');

      await request(server())
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'novaSenhaForte123' })
        .expect(204);

      // Reuso do mesmo token falha com 400
      await request(server())
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'outraTentativa123' })
        .expect(400);

      // Senha antiga nao funciona mais; nova senha autentica
      await request(server())
        .post('/api/auth/login')
        .send({ email: NEW_USER.email, password: NEW_USER.password })
        .expect(401);

      await request(server())
        .post('/api/auth/login')
        .send({ email: NEW_USER.email, password: 'novaSenhaForte123' })
        .expect(200);
    });
  });

  describe('DELETE /api/usuarios/me/anonymize (LGPD - Secao 6.1)', () => {
    it('anonimiza dados pessoais, apaga os cookies e invalida sessao e login futuros', async () => {
      await request(server()).delete('/api/usuarios/me/anonymize').expect(401);

      const browser = await loggedInBrowser();
      await browser.delete('/api/usuarios/me/anonymize').expect(204);

      expect(users[0].name).toBe('Usuario Anonimizado');
      expect(users[0].anonymizedAt).not.toBeNull();

      await browser.get('/api/auth/me').expect(401);
      await request(server())
        .post('/api/auth/login')
        .send({ email: NEW_USER.email, password: NEW_USER.password })
        .expect(401);
    });
  });

  describe('limite de 72 bytes UTF-8 da senha (truncamento silencioso do bcrypt)', () => {
    it('aceita ate 72 bytes UTF-8 e rejeita acima disso com 400 (ASCII e caracteres acentuados)', async () => {
      const password72 = 'a'.repeat(72);
      const password73 = 'a'.repeat(73);
      const accented72Bytes = '\u00e1'.repeat(36);
      const accented74Bytes = '\u00e1'.repeat(37);

      await request(server())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'limite72@example.com', password: password72 })
        .expect(201);

      await request(server())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'acento72@example.com', password: accented72Bytes })
        .expect(201);

      await request(server())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'limite73@example.com', password: password73 })
        .expect(400);

      await request(server())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'acento74@example.com', password: accented74Bytes })
        .expect(400);

      await request(server())
        .post('/api/auth/login')
        .send({ email: 'limite72@example.com', password: password73 })
        .expect(400);
    });
  });
});
