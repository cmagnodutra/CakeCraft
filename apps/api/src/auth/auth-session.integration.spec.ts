import { randomUUID } from 'node:crypto';

import { Global, INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { configureApp } from '../app.setup';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from './auth.module';

/**
 * Teste de integracao HTTP da sessao: sobe o AuthModule REAL (controller,
 * guard, estrategia JWT, cookie-parser, ValidationPipe, filtro de erros e
 * CORS, via configureApp) e troca SO a persistencia por memoria. Assim roda
 * em qualquer maquina, sem Docker, e cobre o que os testes com mock nao
 * alcancam: o cookie sair do /register e ser aceito (ou recusado) no /me.
 * Os testes e2e com Postgres de verdade continuam em test/.
 */
const ENV = {
  NODE_ENV: 'test',
  CORS_ORIGIN: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'segredo-de-acesso-so-para-teste',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'segredo-de-refresh-so-para-teste',
  JWT_REFRESH_EXPIRES_IN: '7d',
  BCRYPT_SALT_ROUNDS: 4, // baixo so no teste, para nao demorar; producao usa 12 (RNF04)
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
  anonymizedAt: Date | null;
}

const users: StoredUser[] = [];

const fakePrisma = {
  user: {
    findUnique: ({ where }: { where: { id?: string; email?: string } }) =>
      Promise.resolve(
        users.find((u) => (where.id ? u.id === where.id : u.email === where.email)) ?? null,
      ),
    create: ({ data }: { data: Partial<StoredUser> & { email: string } }) => {
      const user = {
        id: randomUUID(),
        role: 'CLIENTE',
        xp: 0,
        level: 1,
        phone: null,
        anonymizedAt: null,
        ...data,
      } as StoredUser;
      users.push(user);
      return Promise.resolve(user);
    },
  },
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
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app, ENV.CORS_ORIGIN);
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(() => app.close());
  beforeEach(() => {
    users.length = 0;
  });

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  /** Cadastra e devolve um "navegador" (agent) que guarda os cookies, como o Chrome. */
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

    it('com a sessao criada pelo cadastro: 200 e o usuario publico (o cookie do /register serve no /me)', async () => {
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
      expect(Object.keys((res.body as { user: object }).user).sort()).toEqual([
        'email',
        'id',
        'level',
        'name',
        'role',
        'xp',
      ]);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|senha12345/);
    });

    it('reflete o banco, nao o token: o XP novo aparece sem precisar logar de novo', async () => {
      const browser = await loggedInBrowser();
      users[0].xp = 450;

      const res = await browser.get('/api/auth/me').expect(200);

      expect((res.body as { user: { xp: number } }).user.xp).toBe(450);
    });

    it('token adulterado: 401', async () => {
      await request(server())
        .get('/api/auth/me')
        .set('Cookie', ['access_token=isto.nao.e-um-jwt'])
        .expect(401);
    });

    it('token assinado com outro segredo: 401', async () => {
      const forged = await jwt.signAsync(
        { sub: 'x', email: 'a@b.com', role: 'ADMIN' },
        { secret: 'segredo-do-atacante', expiresIn: '15m' },
      );

      await request(server())
        .get('/api/auth/me')
        .set('Cookie', [`access_token=${forged}`])
        .expect(401);
    });

    it('token expirado: 401', async () => {
      const expired = await expiredAccessToken();

      await request(server())
        .get('/api/auth/me')
        .set('Cookie', [`access_token=${expired}`])
        .expect(401);
    });

    it('o refresh token NAO vale como access token (segredos diferentes)', async () => {
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

    it('usuario apagado depois do login: 401', async () => {
      const browser = await loggedInBrowser();
      users.length = 0;

      await browser.get('/api/auth/me').expect(401);
    });

    it('usuario anonimizado (LGPD) depois do login: 401, o token antigo deixa de valer', async () => {
      const browser = await loggedInBrowser();
      users[0].anonymizedAt = new Date();

      await browser.get('/api/auth/me').expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('responde 204 e manda apagar os DOIS cookies, com os mesmos path e flags do login', async () => {
      const browser = await loggedInBrowser();

      const res = await browser.post('/api/auth/logout').expect(204);

      const cookies = (res.headers['set-cookie'] as unknown as string[]).join('\n');
      expect(cookies).toMatch(/access_token=;[^\n]*Path=\/;[^\n]*Expires=Thu, 01 Jan 1970/);
      expect(cookies).toMatch(
        /refresh_token=;[^\n]*Path=\/api\/auth\/refresh;[^\n]*Expires=Thu, 01 Jan 1970/,
      );
      expect(cookies).toMatch(/HttpOnly/);
      expect(cookies).toMatch(/SameSite=Lax/);
    });

    it('depois do logout, o mesmo navegador nao tem mais sessao (/me volta a 401)', async () => {
      const browser = await loggedInBrowser();
      await browser.get('/api/auth/me').expect(200);

      await browser.post('/api/auth/logout').expect(204);

      await browser.get('/api/auth/me').expect(401);
    });

    it('funciona sem estar logado e com token expirado: sair nunca pode falhar (idempotente)', async () => {
      await request(server()).post('/api/auth/logout').expect(204);

      const expired = await expiredAccessToken();
      await request(server())
        .post('/api/auth/logout')
        .set('Cookie', [`access_token=${expired}`])
        .expect(204);
    });

    it('so aceita POST (um GET nao desloga ninguem por um link ou imagem)', async () => {
      await request(server()).get('/api/auth/logout').expect(404);
    });
  });
});
