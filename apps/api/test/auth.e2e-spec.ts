import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

interface FakeUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: string;
  xp: number;
  level: number;
  anonymizedAt: Date | null;
}

/**
 * Fake em memoria do Prisma - so o suficiente (user.findUnique/create)
 * para exercitar as rotas de auth via HTTP de ponta a ponta, sem
 * depender de um Postgres real. A logica de negocio isolada ja e coberta
 * por auth.service.spec.ts com mocks; este arquivo cobre a integracao da
 * pilha HTTP (routing + ValidationPipe + cookies), como pede o
 * Apendice B do RFC para as rotas criticas de autenticacao.
 */
class FakePrismaUserStore {
  private users: FakeUser[] = [];

  private nextId = 1;

  user = {
    findUnique: ({
      where,
    }: {
      where: { email?: string; id?: string };
    }): Promise<FakeUser | null> => {
      const found = where.email
        ? this.users.find((u) => u.email === where.email)
        : this.users.find((u) => u.id === where.id);
      return Promise.resolve(found ?? null);
    },
    create: ({ data }: { data: Partial<FakeUser> }): Promise<FakeUser> => {
      const user: FakeUser = {
        id: `user-${this.nextId++}`,
        role: 'CLIENTE',
        xp: 0,
        level: 1,
        anonymizedAt: null,
        ...data,
      } as FakeUser;
      this.users.push(user);
      return Promise.resolve(user);
    },
  };

  reset(): void {
    this.users = [];
    this.nextId = 1;
  }
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  const fakePrisma = new FakePrismaUserStore();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterEach(() => {
    fakePrisma.reset();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('cadastra e devolve 201 com o usuario, sem tokens no corpo', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'mariana@example.com', password: 'senha12345' })
        .expect(201);

      expect(response.body.user).toMatchObject({ name: 'Mariana', email: 'mariana@example.com' });
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('accessToken');
      expect(response.body).not.toHaveProperty('refreshToken');
    });

    it('entrega os tokens como cookies httpOnly, nunca no corpo', async () => {
      const response = await request(app.getHttpServer())
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

    it('rejeita e-mail duplicado com 409', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'duplicado@example.com', password: 'senha12345' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Outra Mariana', email: 'duplicado@example.com', password: 'outra-senha' })
        .expect(409);
    });

    it('rejeita corpo invalido (senha curta demais) com 400', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'mariana3@example.com', password: '123' })
        .expect(400);
    });

    it('rejeita campos nao declarados no DTO - protecao contra mass assignment', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Mariana',
          email: 'mariana4@example.com',
          password: 'senha12345',
          role: 'ADMIN',
        })
        .expect(400);
    });

    it('trata variacoes de maiusculas/minusculas do mesmo e-mail como a mesma conta', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Mariana', email: 'CaseTeste@Example.com', password: 'senha12345' })
        .expect(201);

      // Mesmo e-mail, caixa diferente - antes da correcao, o Postgres (e
      // aqui, o fake em memoria) teria tratado como um e-mail diferente
      // e permitido o cadastro duplicado com 201 em vez de 409.
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Outra Pessoa', email: 'caseteste@example.com', password: 'outra-senha' })
        .expect(409);

      // E o login funciona com ainda outra variacao de caixa.
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'CASETESTE@EXAMPLE.COM', password: 'senha12345' })
        .expect(200);

      expect(loginResponse.body.user.email).toBe('caseteste@example.com');
    });
  });

  describe('POST /api/auth/login', () => {
    const credentials = { email: 'login@example.com', password: 'senha12345' };

    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Mariana', ...credentials });
    });

    it('autentica com sucesso e devolve 200 com o usuario e os cookies', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(credentials)
        .expect(200);

      expect(response.body.user.email).toBe(credentials.email);
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('rejeita senha incorreta com 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: credentials.email, password: 'senha-errada' })
        .expect(401);
    });

    it('rejeita e-mail inexistente com 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nao-cadastrado@example.com', password: 'qualquer-coisa' })
        .expect(401);
    });
  });
});
