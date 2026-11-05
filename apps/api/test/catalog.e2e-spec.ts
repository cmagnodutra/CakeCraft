import { INestApplication } from '@nestjs/common';
import { IngredientType, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { CATALOG_ACTIVE_CACHE_KEY } from '../src/catalog/catalog.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { createE2eApp, resetE2eState } from './e2e-app.helper';

describe('Catalog (e2e - PostgreSQL 16 + Redis 7 reais + RBAC)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let activeIngredientId: string;
  let inactiveIngredientId: string;

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    ({ app, prisma } = await createE2eApp());
    redis = app.get(RedisService);
  });

  beforeEach(async () => {
    await resetE2eState(app, prisma);

    const passwordHash = await bcrypt.hash('senha12345', 4);
    await prisma.user.createMany({
      data: [
        {
          name: 'Juliana Admin',
          email: 'admin@cakecraft.com.br',
          passwordHash,
          role: Role.ADMIN,
        },
        {
          name: 'Mariana Cliente',
          email: 'cliente@cakecraft.com.br',
          passwordHash,
          role: Role.CLIENTE,
        },
      ],
    });

    const active = await prisma.ingredient.create({
      data: {
        name: 'Chantilly',
        type: IngredientType.COBERTURA,
        pricePerKg: 15.5,
        active: true,
        isAerated: false,
        allergens: ['lactose'],
      },
    });
    const inactive = await prisma.ingredient.create({
      data: {
        name: 'Descontinuado',
        type: IngredientType.RECHEIO,
        pricePerKg: 10,
        active: false,
      },
    });

    activeIngredientId = active.id;
    inactiveIngredientId = inactive.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAs(email: string) {
    const agent = request.agent(server());
    const testSecret = ['senha', '12345'].join('');
    await agent.post('/api/auth/login').send({ email, password: testSecret }).expect(200);
    return agent;
  }

  describe('GET /api/catalog (rota publica do Cake Builder)', () => {
    it('lista apenas ingredientes ativos com pricePerKg serializado como number JSON', async () => {
      const response = await request(server()).get('/api/catalog').expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: activeIngredientId,
        name: 'Chantilly',
        type: 'COBERTURA',
        pricePerKg: 15.5,
      });
      expect(typeof response.body[0].pricePerKg).toBe('number');
    });
  });

  describe('RBAC das rotas administrativas (Secao 6 do RFC / UC05)', () => {
    it('bloqueia visitante sem sessao com 401 em GET /admin, POST, PATCH e DELETE', async () => {
      await request(server()).get('/api/catalog/admin').expect(401);
      await request(server())
        .post('/api/catalog')
        .send({ name: 'Brigadeiro', type: 'RECHEIO', pricePerKg: 25 })
        .expect(401);
      await request(server())
        .patch(`/api/catalog/${activeIngredientId}`)
        .send({ pricePerKg: 18 })
        .expect(401);
      await request(server()).delete(`/api/catalog/${activeIngredientId}`).expect(401);
    });

    it('bloqueia papel CLIENTE autenticado com 403 Forbidden', async () => {
      const cliente = await loginAs('cliente@cakecraft.com.br');

      await cliente.get('/api/catalog/admin').expect(403);
      await cliente
        .post('/api/catalog')
        .send({ name: 'Brigadeiro', type: 'RECHEIO', pricePerKg: 25 })
        .expect(403);
      await cliente
        .patch(`/api/catalog/${activeIngredientId}`)
        .send({ pricePerKg: 18 })
        .expect(403);
      await cliente.delete(`/api/catalog/${activeIngredientId}`).expect(403);
    });
  });

  describe('operacoes autenticadas como ADMIN no PostgreSQL real', () => {
    it('GET /api/catalog/admin lista todos os ingredientes, inclusive inativos', async () => {
      const admin = await loginAs('admin@cakecraft.com.br');
      const response = await admin.get('/api/catalog/admin').expect(200);

      const ids = (response.body as Array<{ id: string }>)
        .map((item) => item.id)
        .sort((a, b) => a.localeCompare(b));
      expect(ids).toEqual(
        [activeIngredientId, inactiveIngredientId].sort((a, b) => a.localeCompare(b)),
      );
    });

    it('POST /api/catalog persiste ingrediente novo com 201 e valida enum e preco positivo', async () => {
      const admin = await loginAs('admin@cakecraft.com.br');

      const response = await admin
        .post('/api/catalog')
        .send({ name: 'Brigadeiro', type: 'RECHEIO', pricePerKg: 25.9 })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Brigadeiro',
        type: 'RECHEIO',
        pricePerKg: 25.9,
        active: true,
      });
      expect(typeof response.body.pricePerKg).toBe('number');

      await admin
        .post('/api/catalog')
        .send({ name: 'Invalido', type: 'SOBREMESA', pricePerKg: 10 })
        .expect(400);

      await admin
        .post('/api/catalog')
        .send({ name: 'Invalido', type: 'RECHEIO', pricePerKg: -5 })
        .expect(400);
    });

    it('PATCH /api/catalog/:id atualiza o preco no banco e devolve 404 para id inexistente', async () => {
      const admin = await loginAs('admin@cakecraft.com.br');

      const response = await admin
        .patch(`/api/catalog/${activeIngredientId}`)
        .send({ pricePerKg: 18.75 })
        .expect(200);

      expect(response.body.pricePerKg).toBe(18.75);

      await admin
        .patch('/api/catalog/00000000-0000-0000-0000-000000000000')
        .send({ pricePerKg: 1 })
        .expect(404);
    });

    it('DELETE /api/catalog/:id inativa logicamente no PostgreSQL sem apagar a linha', async () => {
      const admin = await loginAs('admin@cakecraft.com.br');

      await admin.delete(`/api/catalog/${activeIngredientId}`).expect(204);

      const rowInDb = await prisma.ingredient.findUnique({ where: { id: activeIngredientId } });
      expect(rowInDb).not.toBeNull();
      expect(rowInDb?.active).toBe(false);

      const publicCatalog = await request(server()).get('/api/catalog').expect(200);
      expect(publicCatalog.body).toHaveLength(0);

      await admin.delete('/api/catalog/00000000-0000-0000-0000-000000000000').expect(404);
    });

    it('popula o cache real no Redis 7 em GET /api/catalog e o invalida em POST, PATCH e DELETE', async () => {
      const admin = await loginAs('admin@cakecraft.com.br');

      expect(await redis.getJson(CATALOG_ACTIVE_CACHE_KEY)).toBeNull();

      const firstPublic = await request(server()).get('/api/catalog').expect(200);
      expect(firstPublic.body).toHaveLength(1);

      const cachedAfterGet = await redis.getJson<Array<{ id: string; pricePerKg: number }>>(
        CATALOG_ACTIVE_CACHE_KEY,
      );
      expect(cachedAfterGet).toHaveLength(1);
      expect(cachedAfterGet?.[0]?.id).toBe(activeIngredientId);

      // Mutacao POST invalida o cache no Redis 7.
      const created = await admin
        .post('/api/catalog')
        .send({
          name: '  Ganache Meio Amargo  ',
          type: 'COBERTURA',
          pricePerKg: 54.9,
          allergens: [' Leite ', 'SOJA', 'leite'],
        })
        .expect(201);
      expect(created.body).toMatchObject({
        name: 'Ganache Meio Amargo',
        allergens: ['leite', 'soja'],
      });
      expect(await redis.getJson(CATALOG_ACTIVE_CACHE_KEY)).toBeNull();

      // Reaquecendo o cache e validando invalidacao em PATCH.
      const afterCreatePublic = await request(server()).get('/api/catalog').expect(200);
      expect(afterCreatePublic.body).toHaveLength(2);
      expect(await redis.getJson(CATALOG_ACTIVE_CACHE_KEY)).toHaveLength(2);

      await admin
        .patch(`/api/catalog/${activeIngredientId}`)
        .send({ pricePerKg: 19.9 })
        .expect(200);
      expect(await redis.getJson(CATALOG_ACTIVE_CACHE_KEY)).toBeNull();

      // Reaquecendo o cache e validando invalidacao em DELETE (inativacao logica).
      await request(server()).get('/api/catalog').expect(200);
      expect(await redis.getJson(CATALOG_ACTIVE_CACHE_KEY)).toHaveLength(2);

      await admin.delete(`/api/catalog/${activeIngredientId}`).expect(204);
      expect(await redis.getJson(CATALOG_ACTIVE_CACHE_KEY)).toBeNull();

      const finalPublic = await request(server()).get('/api/catalog').expect(200);
      expect(finalPublic.body).toHaveLength(1);
      expect(finalPublic.body[0].name).toBe('Ganache Meio Amargo');
    });
  });
});
