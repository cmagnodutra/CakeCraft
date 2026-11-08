import { INestApplication } from '@nestjs/common';
import { IngredientType } from '@prisma/client';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { createE2eApp, resetE2eState } from './e2e-app.helper';

describe('Pricing (e2e - PostgreSQL 16 real)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let aeratedDoughId: string;
  let chocolateDoughId: string;
  let chantillyCoverageId: string;
  let brigadeiroFillingId: string;
  let inactiveFillingId: string;

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    ({ app, prisma } = await createE2eApp());
  });

  beforeEach(async () => {
    await resetE2eState(app, prisma);

    const [paoDeLo, chocolate, chantilly, brigadeiro, inativo] = await prisma.$transaction([
      prisma.ingredient.create({
        data: {
          name: 'Pao de Lo',
          type: IngredientType.MASSA,
          pricePerKg: '10.00',
          isAerated: true,
          allergens: ['gluten'],
        },
      }),
      prisma.ingredient.create({
        data: {
          name: 'Massa de Chocolate',
          type: IngredientType.MASSA,
          pricePerKg: '30.00',
          isAerated: false,
          allergens: ['gluten'],
        },
      }),
      prisma.ingredient.create({
        data: {
          name: 'Chantilly',
          type: IngredientType.COBERTURA,
          pricePerKg: '7.00',
          isAerated: false,
          allergens: ['lactose'],
        },
      }),
      prisma.ingredient.create({
        data: {
          name: 'Brigadeiro',
          type: IngredientType.RECHEIO,
          pricePerKg: '25.00',
          isAerated: false,
        },
      }),
      prisma.ingredient.create({
        data: {
          name: 'Descontinuado',
          type: IngredientType.RECHEIO,
          pricePerKg: '10.00',
          active: false,
        },
      }),
    ]);

    aeratedDoughId = paoDeLo.id;
    chocolateDoughId = chocolate.id;
    chantillyCoverageId = chantilly.id;
    brigadeiroFillingId = brigadeiro.id;
    inactiveFillingId = inativo.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const nonAeratedFloor = (floorNumber = 1) => ({
    floorNumber,
    doughIngredientId: chocolateDoughId,
    coverageIngredientId: chantillyCoverageId,
    fillingIngredientIds: [brigadeiroFillingId],
    estimatedWeightKg: 1,
  });

  const aeratedFloor = (floorNumber: number, estimatedWeightKg = 1) => ({
    floorNumber,
    doughIngredientId: aeratedDoughId,
    coverageIngredientId: chantillyCoverageId,
    fillingIngredientIds: [] as string[],
    estimatedWeightKg,
  });

  describe('POST /api/pricing/calculate', () => {
    it('calcula RN02 a partir de colunas Decimal(10,2) reais do PostgreSQL', async () => {
      const response = await request(server())
        .post('/api/pricing/calculate')
        .send({ floors: [nonAeratedFloor()] })
        .expect(200);

      // 30 (massa) + 7 (cobertura) + 25 (recheio) = 62/kg * 1kg = 62 + taxa base (0.25) = 62.25
      expect(response.body.layers[0].subtotal).toBe(62);
      expect(response.body.assemblyBaseFee).toBe(0.25);
      expect(response.body.totalPrice).toBe(62.25);
    });

    it('preserva precisao exata em centavos com Decimal do banco (17.00 x 1.005 = 17.09)', async () => {
      const response = await request(server())
        .post('/api/pricing/calculate')
        .send({ floors: [aeratedFloor(1, 1.005)] })
        .expect(200);

      // 10.00 (Pao de Lo) + 7.00 (Chantilly) = 17.00 * 1.005 kg = 17.085 -> 17.09 (1709 centavos) + 25 centavos = 1734
      expect(Math.round(Number(response.body.layers[0].subtotal) * 100)).toBe(1709);
      expect(Math.round(Number(response.body.totalPrice) * 100)).toBe(1734);
    });

    it('RN01 - permite massa aerada em 2 andares (200) e bloqueia em 3 andares (422)', async () => {
      const allowed = await request(server())
        .post('/api/pricing/calculate')
        .send({ floors: [aeratedFloor(1), aeratedFloor(2)] })
        .expect(200);

      expect(allowed.body.layers).toHaveLength(2);

      await request(server())
        .post('/api/pricing/calculate')
        .send({ floors: [aeratedFloor(1), aeratedFloor(2), aeratedFloor(3)] })
        .expect(422);
    });

    it('rejeita insumo de tipo incorreto no slot (ex.: RECHEIO usado como MASSA) com 422', async () => {
      await request(server())
        .post('/api/pricing/calculate')
        .send({
          floors: [{ ...nonAeratedFloor(), doughIngredientId: brigadeiroFillingId }],
        })
        .expect(422);
    });

    it('rejeita recheio duplicado no mesmo andar com 422', async () => {
      await request(server())
        .post('/api/pricing/calculate')
        .send({
          floors: [
            {
              ...nonAeratedFloor(),
              fillingIngredientIds: [brigadeiroFillingId, brigadeiroFillingId],
            },
          ],
        })
        .expect(422);
    });

    it('rejeita ingrediente inexistente ou inativo com 422', async () => {
      await request(server())
        .post('/api/pricing/calculate')
        .send({
          floors: [
            { ...nonAeratedFloor(), doughIngredientId: '00000000-0000-0000-0000-000000000000' },
          ],
        })
        .expect(422);

      await request(server())
        .post('/api/pricing/calculate')
        .send({
          floors: [{ ...nonAeratedFloor(), fillingIngredientIds: [inactiveFillingId] }],
        })
        .expect(422);
    });

    it('rejeita payloads malformados (floors vazio, peso negativo, > 3 decimais ou > 2 recheios) com 400', async () => {
      await request(server()).post('/api/pricing/calculate').send({ floors: [] }).expect(400);

      await request(server())
        .post('/api/pricing/calculate')
        .send({ floors: [{ ...nonAeratedFloor(), estimatedWeightKg: -1 }] })
        .expect(400);

      await request(server())
        .post('/api/pricing/calculate')
        .send({ floors: [{ ...nonAeratedFloor(), estimatedWeightKg: 1.1234 }] })
        .expect(400);

      await request(server())
        .post('/api/pricing/calculate')
        .send({
          floors: [{ ...nonAeratedFloor(), fillingIngredientIds: ['a', 'b', 'c'] }],
        })
        .expect(400);
    });
  });
});
