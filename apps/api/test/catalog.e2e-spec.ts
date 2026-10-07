import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

interface FakeIngredient {
  id: string;
  name: string;
  type: string;
  pricePerKg: number;
  active: boolean;
  isAerated: boolean;
  allergens: string[];
}

/**
 * Fake em memoria do catalogo de ingredientes - findMany/findUnique/
 * create/update, o suficiente para exercitar o CRUD completo do
 * CatalogController via HTTP real, sem depender de um Postgres de
 * verdade. A logica isolada ja e coberta por catalog.service.spec.ts.
 *
 * NOTA: as rotas de escrita (POST/PATCH/DELETE) e GET /admin ainda sao
 * publicas nesta branch de proposito - RBAC (JwtAuthGuard/RolesGuard)
 * so fica disponivel apos feature/auth ser mergeada em main (ver TODO
 * explicito em catalog.controller.ts). Os testes abaixo refletem esse
 * estado atual; nao testam autorizacao porque ainda nao existe aqui.
 */
class FakeIngredientStore {
  private ingredients: FakeIngredient[] = [
    {
      id: 'ativo-1',
      name: 'Chantilly',
      type: 'COBERTURA',
      pricePerKg: 15,
      active: true,
      isAerated: false,
      allergens: ['lactose'],
    },
    {
      id: 'inativo-1',
      name: 'Descontinuado',
      type: 'RECHEIO',
      pricePerKg: 10,
      active: false,
      isAerated: false,
      allergens: [],
    },
  ];

  private nextId = 1;

  ingredient = {
    findMany: ({ where, orderBy }: { where?: { active?: boolean }; orderBy?: unknown }) => {
      let result = this.ingredients;
      if (where?.active !== undefined) {
        result = result.filter((i) => i.active === where.active);
      }
      void orderBy; // ordenacao nao importa para os testes abaixo
      return Promise.resolve([...result]);
    },
    findUnique: ({ where }: { where: { id: string } }) => {
      const found = this.ingredients.find((i) => i.id === where.id);
      return Promise.resolve(found ?? null);
    },
    create: ({ data }: { data: Partial<FakeIngredient> }) => {
      const ingredient: FakeIngredient = {
        id: `novo-${this.nextId++}`,
        active: true,
        isAerated: false,
        allergens: [],
        ...data,
      } as FakeIngredient;
      this.ingredients.push(ingredient);
      return Promise.resolve(ingredient);
    },
    update: ({ where, data }: { where: { id: string }; data: Partial<FakeIngredient> }) => {
      const index = this.ingredients.findIndex((i) => i.id === where.id);
      this.ingredients[index] = { ...this.ingredients[index], ...data };
      return Promise.resolve(this.ingredients[index]);
    },
  };
}

describe('Catalog (e2e)', () => {
  let app: INestApplication;
  const fakePrisma = new FakeIngredientStore();

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

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/catalog', () => {
    it('lista so os ingredientes ativos (rota publica, consumida pelo Cake Builder)', async () => {
      const response = await request(app.getHttpServer()).get('/api/catalog').expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('ativo-1');
    });
  });

  describe('GET /api/catalog/admin', () => {
    it('lista todos os ingredientes, inclusive inativos', async () => {
      const response = await request(app.getHttpServer()).get('/api/catalog/admin').expect(200);

      expect(response.body.map((i: FakeIngredient) => i.id).sort()).toEqual([
        'ativo-1',
        'inativo-1',
      ]);
    });
  });

  describe('POST /api/catalog', () => {
    it('cria um ingrediente novo com 201', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/catalog')
        .send({ name: 'Brigadeiro', type: 'RECHEIO', pricePerKg: 25 })
        .expect(201);

      expect(response.body).toMatchObject({ name: 'Brigadeiro', type: 'RECHEIO', pricePerKg: 25 });
      expect(response.body.active).toBe(true);
    });

    it('rejeita type fora do enum IngredientType com 400', async () => {
      await request(app.getHttpServer())
        .post('/api/catalog')
        .send({ name: 'Invalido', type: 'SOBREMESA', pricePerKg: 10 })
        .expect(400);
    });

    it('rejeita pricePerKg negativo com 400', async () => {
      await request(app.getHttpServer())
        .post('/api/catalog')
        .send({ name: 'Invalido', type: 'RECHEIO', pricePerKg: -5 })
        .expect(400);
    });
  });

  describe('PATCH /api/catalog/:id', () => {
    it('atualiza o preco de um ingrediente existente', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/catalog/ativo-1')
        .send({ pricePerKg: 18 })
        .expect(200);

      expect(response.body.pricePerKg).toBe(18);
    });

    it('responde 404 ao atualizar um id inexistente', async () => {
      await request(app.getHttpServer())
        .patch('/api/catalog/id-que-nao-existe')
        .send({ pricePerKg: 1 })
        .expect(404);
    });
  });

  describe('DELETE /api/catalog/:id', () => {
    it('inativa (nao deleta fisicamente) e devolve 204', async () => {
      await request(app.getHttpServer()).delete('/api/catalog/ativo-1').expect(204);

      const lista = await request(app.getHttpServer()).get('/api/catalog/admin').expect(200);
      const atualizado = lista.body.find((i: FakeIngredient) => i.id === 'ativo-1');
      expect(atualizado.active).toBe(false);
    });

    it('responde 404 ao inativar um id inexistente', async () => {
      await request(app.getHttpServer()).delete('/api/catalog/id-que-nao-existe').expect(404);
    });
  });
});
