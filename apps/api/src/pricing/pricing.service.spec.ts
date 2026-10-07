import { Test, TestingModule } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ASSEMBLY_BASE_FEE, PricingService } from './pricing.service';
import { CakeLayerInputDto } from './dto/calculate-price.dto';

/**
 * Meta de cobertura do Apendice B do RFC: 95% para o PricingService, dada
 * a criticidade financeira (RN02) e estrutural (RN01) deste componente.
 */
describe('PricingService', () => {
  let service: PricingService;

  const prismaMock = {
    ingredient: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PricingService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  describe('RN02 - calculo volumetrico de preco', () => {
    it('soma (preco/kg x peso) de um andar e adiciona a taxa base', async () => {
      prismaMock.ingredient.findMany.mockResolvedValue([
        { id: 'massa-choc', isAerated: false, pricePerKg: 38 },
        { id: 'brigadeiro', isAerated: false, pricePerKg: 40 },
        { id: 'chantilly', isAerated: false, pricePerKg: 50 },
      ]);

      const result = await service.calculate({
        floors: [
          floor({
            floorNumber: 1,
            doughIngredientId: 'massa-choc',
            coverageIngredientId: 'chantilly',
            fillingIngredientIds: ['brigadeiro'],
            estimatedWeightKg: 1.5,
          }),
        ],
      });

      // (38 + 50 + 40) * 1.5 = 192
      expect(result.layers[0].subtotal).toBeCloseTo(192);
      expect(result.totalPrice).toBeCloseTo(192 + ASSEMBLY_BASE_FEE);
    });

    it('soma o subtotal de cada andar independentemente antes de aplicar a taxa base uma unica vez', async () => {
      prismaMock.ingredient.findMany.mockResolvedValue([
        { id: 'massa-choc', isAerated: false, pricePerKg: 30 },
        { id: 'chantilly', isAerated: false, pricePerKg: 20 },
      ]);

      const result = await service.calculate({
        floors: [
          floor({
            floorNumber: 1,
            doughIngredientId: 'massa-choc',
            coverageIngredientId: 'chantilly',
            fillingIngredientIds: [],
            estimatedWeightKg: 1,
          }),
          floor({
            floorNumber: 2,
            doughIngredientId: 'massa-choc',
            coverageIngredientId: 'chantilly',
            fillingIngredientIds: [],
            estimatedWeightKg: 2,
          }),
        ],
      });

      // andar 1: (30+20)*1 = 50 ; andar 2: (30+20)*2 = 100
      expect(result.layers[0].subtotal).toBeCloseTo(50);
      expect(result.layers[1].subtotal).toBeCloseTo(100);
      // taxa base aparece uma unica vez, nao por andar
      expect(result.totalPrice).toBeCloseTo(150 + ASSEMBLY_BASE_FEE);
    });

    it('ignora ingredientes inativos na precificacao (nao entram no mapa de precos)', async () => {
      // O findMany real ja filtra active: true - aqui simulamos que o
      // ingrediente inativo simplesmente nao volta na consulta.
      prismaMock.ingredient.findMany.mockResolvedValue([]);

      await expect(
        service.calculate({
          floors: [floor({ floorNumber: 1, doughIngredientId: 'ingrediente-inativo' })],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('RN01 - integridade estrutural', () => {
    it('permite massa aerada em bolo de exatamente 2 andares (fronteira permitida)', () => {
      const aerated = new Set(['pao-de-lo']);
      const floors = [
        floor({ floorNumber: 1, doughIngredientId: 'pao-de-lo' }),
        floor({ floorNumber: 2, doughIngredientId: 'massa-choc' }),
      ];

      expect(() => service.assertStructuralIntegrity(floors, aerated)).not.toThrow();
    });

    it('bloqueia massa aerada em bolo de 3 andares (fronteira bloqueada)', () => {
      const aerated = new Set(['pao-de-lo']);
      const floors = [
        floor({ floorNumber: 1, doughIngredientId: 'pao-de-lo' }),
        floor({ floorNumber: 2, doughIngredientId: 'massa-choc' }),
        floor({ floorNumber: 3, doughIngredientId: 'massa-choc' }),
      ];

      expect(() => service.assertStructuralIntegrity(floors, aerated)).toThrow(
        UnprocessableEntityException,
      );
    });

    it('permite mais de 2 andares se nenhuma massa selecionada for aerada', () => {
      const aerated = new Set(['pao-de-lo']);
      const floors = [
        floor({ floorNumber: 1, doughIngredientId: 'massa-choc' }),
        floor({ floorNumber: 2, doughIngredientId: 'massa-choc' }),
        floor({ floorNumber: 3, doughIngredientId: 'massa-choc' }),
      ];

      expect(() => service.assertStructuralIntegrity(floors, aerated)).not.toThrow();
    });

    it('bloqueia mesmo quando a massa aerada esta em um andar que nao o primeiro', () => {
      const aerated = new Set(['pao-de-lo']);
      const floors = [
        floor({ floorNumber: 1, doughIngredientId: 'massa-choc' }),
        floor({ floorNumber: 2, doughIngredientId: 'massa-choc' }),
        floor({ floorNumber: 3, doughIngredientId: 'pao-de-lo' }),
      ];

      expect(() => service.assertStructuralIntegrity(floors, aerated)).toThrow(
        UnprocessableEntityException,
      );
    });

    it('o calculate() completo tambem rejeita a combinacao invalida com 422', async () => {
      prismaMock.ingredient.findMany.mockResolvedValue([
        { id: 'pao-de-lo', isAerated: true, pricePerKg: 35 },
        { id: 'massa-choc', isAerated: false, pricePerKg: 38 },
        { id: 'chantilly', isAerated: false, pricePerKg: 50 },
      ]);

      await expect(
        service.calculate({
          floors: [
            floor({ floorNumber: 1, doughIngredientId: 'pao-de-lo' }),
            floor({ floorNumber: 2, doughIngredientId: 'massa-choc' }),
            floor({ floorNumber: 3, doughIngredientId: 'massa-choc' }),
          ],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('validacao de ingredientes', () => {
    it('rejeita ingrediente inexistente com 422, listando o id no erro', async () => {
      prismaMock.ingredient.findMany.mockResolvedValue([]);

      await expect(
        service.calculate({
          floors: [floor({ floorNumber: 1, doughIngredientId: 'id-que-nao-existe' })],
        }),
      ).rejects.toThrow(/id-que-nao-existe/);
    });

    it('busca no banco apenas os ingredientes referenciados na requisicao (RNF01)', async () => {
      prismaMock.ingredient.findMany.mockResolvedValue([
        { id: 'massa-choc', isAerated: false, pricePerKg: 38 },
        { id: 'chantilly', isAerated: false, pricePerKg: 50 },
      ]);

      await service.calculate({
        floors: [floor({ floorNumber: 1, doughIngredientId: 'massa-choc' })],
      });

      expect(prismaMock.ingredient.findMany).toHaveBeenCalledWith({
        where: { id: { in: expect.arrayContaining(['massa-choc', 'chantilly']) }, active: true },
      });
    });
  });
});

/** Helper para nao repetir campos irrelevantes ao caso de teste em questao. */
function floor(overrides: Partial<CakeLayerInputDto> & { floorNumber: number; doughIngredientId: string }): CakeLayerInputDto {
  return {
    coverageIngredientId: 'chantilly',
    fillingIngredientIds: [],
    estimatedWeightKg: 1,
    ...overrides,
  };
}
