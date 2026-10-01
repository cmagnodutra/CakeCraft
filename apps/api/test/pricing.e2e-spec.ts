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
 * Catalogo de ingredientes fake, pre-populado com o suficiente para
 * exercitar RN01 (integridade estrutural) e RN02 (calculo volumetrico)
 * via HTTP real, sem depender de um Postgres de verdade. A logica
 * isolada ja e coberta por pricing.service.spec.ts; este arquivo cobre a
 * integracao da pilha HTTP (routing + ValidationPipe, inclusive a
 * validacao aninhada de floors[] via class-transformer).
 */
class FakeIngredientStore {
  ingredients: FakeIngredient[] = [
    {
      id: 'massa-pao-de-lo',
      name: 'Pao de Lo',
      type: 'MASSA',
      pricePerKg: 20,
      active: true,
      isAerated: true,
      allergens: ['gluten'],
    },
    {
      id: 'massa-chocolate',
      name: 'Massa de Chocolate',
      type: 'MASSA',
      pricePerKg: 30,
      active: true,
      isAerated: false,
      allergens: ['gluten'],
    },
    {
      id: 'cobertura-chantilly',
      name: 'Chantilly',
      type: 'COBERTURA',
      pricePerKg: 15,
      active: true,
      isAerated: false,
      allergens: ['lactose'],
    },
    {
      id: 'recheio-brigadeiro',
      name: 'Brigadeiro',
      type: 'RECHEIO',
      pricePerKg: 25,
      active: true,
      isAerated: false,
      allergens: [],
    },
    {
      id: 'ingrediente-inativo',
      name: 'Descontinuado',
      type: 'RECHEIO',
      pricePerKg: 10,
      active: false,
      isAerated: false,
      allergens: [],
    },
  ];

  ingredient = {
    findMany: ({
      where,
    }: {
      where: { id: { in: string[] }; active: boolean };
    }): Promise<FakeIngredient[]> => {
      const ids = new Set(where.id.in);
      return Promise.resolve(
        this.ingredients.filter((ingredient) => ids.has(ingredient.id) && ingredient.active === where.active),
      );
    },
  };
}

describe('Pricing (e2e)', () => {
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

  const nonAeratedFloor = (floorNumber = 1) => ({
    floorNumber,
    doughIngredientId: 'massa-chocolate',
    coverageIngredientId: 'cobertura-chantilly',
    fillingIngredientIds: ['recheio-brigadeiro'],
    estimatedWeightKg: 1,
  });

  const aeratedFloor = (floorNumber: number) => ({
    floorNumber,
    doughIngredientId: 'massa-pao-de-lo',
    coverageIngredientId: 'cobertura-chantilly',
    fillingIngredientIds: [] as string[],
    estimatedWeightKg: 1,
  });

  describe('POST /api/pricing/calculate', () => {
    it('calcula RN02 corretamente para um bolo de 1 andar (soma preco/kg x peso + taxa base)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/pricing/calculate')
        .send({ floors: [nonAeratedFloor()] });

      expect(response.status).toBeLessThan(300);
      // 30 (massa) + 15 (cobertura) + 25 (recheio) = 70/kg * 1kg = 70 + taxa base (25) = 95
      expect(response.body.layers[0].subtotal).toBe(70);
      expect(response.body.assemblyBaseFee).toBe(25);
      expect(response.body.totalPrice).toBe(95);
    });

    it('RN01 - permite massa aerada em exatamente 2 andares (fronteira permitida)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/pricing/calculate')
        .send({ floors: [aeratedFloor(1), aeratedFloor(2)] });

      expect(response.status).toBeLessThan(300);
      expect(response.body.layers).toHaveLength(2);
    });

    it('RN01 - bloqueia massa aerada em 3 andares com 422 (fronteira bloqueada)', async () => {
      await request(app.getHttpServer())
        .post('/api/pricing/calculate')
        .send({ floors: [aeratedFloor(1), aeratedFloor(2), aeratedFloor(3)] })
        .expect(422);
    });

    it('rejeita ingrediente inexistente com 422', async () => {
      await request(app.getHttpServer())
        .post('/api/pricing/calculate')
        .send({
          floors: [{ ...nonAeratedFloor(), doughIngredientId: 'ingrediente-que-nao-existe' }],
        })
        .expect(422);
    });

    it('rejeita ingrediente inativo com 422 (mesmo existindo no catalogo)', async () => {
      await request(app.getHttpServer())
        .post('/api/pricing/calculate')
        .send({ floors: [{ ...nonAeratedFloor(), doughIngredientId: 'ingrediente-inativo' }] })
        .expect(422);
    });

    it('rejeita corpo sem nenhum andar (floors vazio) com 400', async () => {
      await request(app.getHttpServer())
        .post('/api/pricing/calculate')
        .send({ floors: [] })
        .expect(400);
    });

    it('rejeita peso negativo dentro de um andar com 400 (validacao aninhada)', async () => {
      await request(app.getHttpServer())
        .post('/api/pricing/calculate')
        .send({ floors: [{ ...nonAeratedFloor(), estimatedWeightKg: -1 }] })
        .expect(400);
    });

    it('rejeita mais de 2 recheios por andar com 400 (ArrayMaxSize)', async () => {
      await request(app.getHttpServer())
        .post('/api/pricing/calculate')
        .send({
          floors: [
            { ...nonAeratedFloor(), fillingIngredientIds: ['a', 'b', 'c'] },
          ],
        })
        .expect(400);
    });
  });
});
