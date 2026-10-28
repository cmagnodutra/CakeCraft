import { randomUUID } from 'node:crypto';

import { Global, INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { IngredientType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { configureApp } from '../app.setup';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogModule } from './catalog.module';

/**
 * Teste de integracao HTTP do controle de acesso (RBAC) do catalogo.
 * Sobe AuthModule + CatalogModule reais (JwtAuthGuard, RolesGuard, JwtStrategy,
 * cookie-parser, ValidationPipe e filtro global via configureApp) para provar
 * que rotas administrativas bloqueiam visitantes (401) e clientes comuns (403),
 * mantendo apenas GET /api/catalog aberta para o Cake Builder.
 */
const ENV = {
  NODE_ENV: 'test',
  CORS_ORIGIN: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'segredo-de-acesso-rbac-catalogo-teste',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'segredo-de-refresh-rbac-catalogo-teste',
  JWT_REFRESH_EXPIRES_IN: '7d',
  BCRYPT_SALT_ROUNDS: 4,
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

interface StoredIngredient {
  id: string;
  name: string;
  type: IngredientType;
  pricePerKg: number;
  active: boolean;
  isAerated: boolean;
  allergens: string[];
}

const users: StoredUser[] = [];
const ingredients: StoredIngredient[] = [];

const fakePrisma = {
  user: {
    findUnique: ({ where }: { where: { id?: string; email?: string } }) =>
      Promise.resolve(
        users.find((u) => (where.id ? u.id === where.id : u.email === where.email)) ?? null,
      ),
    create: ({ data }: { data: Partial<StoredUser> & { email: string } }) => {
      const created: StoredUser = {
        id: randomUUID(),
        name: 'Usuario',
        passwordHash: '',
        role: 'CLIENTE',
        xp: 0,
        level: 1,
        phone: null,
        anonymizedAt: null,
        ...data,
      };
      users.push(created);
      return Promise.resolve(created);
    },
  },
  ingredient: {
    findMany: ({ where }: { where?: { active?: boolean } }) => {
      const list =
        where?.active === undefined
          ? ingredients
          : ingredients.filter((item) => item.active === where.active);
      return Promise.resolve([...list]);
    },
    findUnique: ({ where }: { where: { id: string } }) =>
      Promise.resolve(ingredients.find((item) => item.id === where.id) ?? null),
    create: ({ data }: { data: Partial<StoredIngredient> & { name: string } }) => {
      const created: StoredIngredient = {
        id: randomUUID(),
        type: IngredientType.RECHEIO,
        pricePerKg: 30,
        active: true,
        isAerated: false,
        allergens: [],
        ...data,
      };
      ingredients.push(created);
      return Promise.resolve(created);
    },
    update: ({ where, data }: { where: { id: string }; data: Partial<StoredIngredient> }) => {
      const index = ingredients.findIndex((item) => item.id === where.id);
      ingredients[index] = { ...ingredients[index], ...data };
      return Promise.resolve(ingredients[index]);
    },
  },
};

@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: fakePrisma }],
  exports: [PrismaService],
})
class FakePrismaModule {}

describe('Catalogo - RBAC (integracao HTTP)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ENV] }),
        FakePrismaModule,
        AuthModule,
        CatalogModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app, ENV.CORS_ORIGIN);
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    users.length = 0;
    ingredients.length = 0;

    const passwordHash = await bcrypt.hash('senha12345', 4);
    users.push(
      {
        id: 'cliente-1',
        name: 'Mariana Cliente',
        email: 'cliente@example.com',
        phone: null,
        passwordHash,
        role: 'CLIENTE',
        xp: 0,
        level: 1,
        anonymizedAt: null,
      },
      {
        id: 'admin-1',
        name: 'Juliana Admin',
        email: 'admin@example.com',
        phone: null,
        passwordHash,
        role: 'ADMIN',
        xp: 0,
        level: 1,
        anonymizedAt: null,
      },
    );

    ingredients.push(
      {
        id: 'ing-ativo',
        name: 'Chantilly',
        type: IngredientType.COBERTURA,
        pricePerKg: 50,
        active: true,
        isAerated: false,
        allergens: ['leite'],
      },
      {
        id: 'ing-inativo',
        name: 'Cobertura Antiga',
        type: IngredientType.COBERTURA,
        pricePerKg: 40,
        active: false,
        isAerated: false,
        allergens: [],
      },
    );
  });

  async function loginAs(email: string) {
    const agent = request.agent(server());
    await agent.post('/api/auth/login').send({ email, password: 'senha12345' }).expect(200);
    return agent;
  }

  it('mantem GET /api/catalog publica para visitantes no Cake Builder', async () => {
    const res = await request(server()).get('/api/catalog').expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('ing-ativo');
  });

  describe('visitante sem sessao (401 Unauthorized)', () => {
    it('bloqueia GET /api/catalog/admin com 401', async () => {
      await request(server()).get('/api/catalog/admin').expect(401);
    });

    it('bloqueia POST /api/catalog com 401', async () => {
      await request(server())
        .post('/api/catalog')
        .send({ name: 'Brigadeiro', type: 'RECHEIO', pricePerKg: 40 })
        .expect(401);
    });

    it('bloqueia PATCH /api/catalog/:id com 401', async () => {
      await request(server())
        .patch('/api/catalog/ing-ativo')
        .send({ pricePerKg: 55 })
        .expect(401);
    });

    it('bloqueia DELETE /api/catalog/:id com 401', async () => {
      await request(server()).delete('/api/catalog/ing-ativo').expect(401);
    });
  });

  describe('papel CLIENTE autenticado (403 Forbidden - Secao 6 do RFC)', () => {
    it('bloqueia GET /api/catalog/admin com 403', async () => {
      const cliente = await loginAs('cliente@example.com');
      await cliente.get('/api/catalog/admin').expect(403);
    });

    it('bloqueia POST /api/catalog com 403', async () => {
      const cliente = await loginAs('cliente@example.com');
      await cliente
        .post('/api/catalog')
        .send({ name: 'Tentativa Cliente', type: 'RECHEIO', pricePerKg: 1 })
        .expect(403);
    });

    it('bloqueia PATCH /api/catalog/:id com 403', async () => {
      const cliente = await loginAs('cliente@example.com');
      await cliente.patch('/api/catalog/ing-ativo').send({ pricePerKg: 1 }).expect(403);
    });

    it('bloqueia DELETE /api/catalog/:id com 403', async () => {
      const cliente = await loginAs('cliente@example.com');
      await cliente.delete('/api/catalog/ing-ativo').expect(403);
    });
  });

  describe('papel ADMIN autenticado (UC05 permitido)', () => {
    it('permite listar todos os ingredientes (ativos e inativos), criar, editar e inativar', async () => {
      const admin = await loginAs('admin@example.com');

      const allBefore = await admin.get('/api/catalog/admin').expect(200);
      expect(allBefore.body).toHaveLength(2);

      const created = await admin
        .post('/api/catalog')
        .send({ name: 'Brigadeiro Gourmet', type: 'RECHEIO', pricePerKg: 48 })
        .expect(201);
      const createdId = (created.body as { id: string }).id;

      const updated = await admin
        .patch(`/api/catalog/${createdId}`)
        .send({ pricePerKg: 52 })
        .expect(200);
      expect((updated.body as { pricePerKg: number }).pricePerKg).toBe(52);

      await admin.delete(`/api/catalog/${createdId}`).expect(204);

      const activeAfter = await request(server()).get('/api/catalog').expect(200);
      expect(
        (activeAfter.body as Array<{ id: string }>).some((item) => item.id === createdId),
      ).toBe(false);
    });
  });
});
