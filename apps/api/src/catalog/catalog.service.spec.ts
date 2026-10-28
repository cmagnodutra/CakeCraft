import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IngredientType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  CATALOG_ACTIVE_CACHE_KEY,
  CATALOG_ACTIVE_CACHE_TTL_SECONDS,
  CatalogService,
} from './catalog.service';

const baseRecord = {
  id: 'abc',
  name: 'Chantilly',
  type: IngredientType.COBERTURA,
  pricePerKg: new Prisma.Decimal('45.50'),
  active: true,
  isAerated: false,
  allergens: ['leite'],
  createdAt: new Date('2026-10-28T00:00:00.000Z'),
  updatedAt: new Date('2026-10-28T00:00:00.000Z'),
};

describe('CatalogService', () => {
  let service: CatalogService;

  const prismaMock = {
    ingredient: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const redisMock = {
    getJson: jest.fn(),
    setJson: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    redisMock.getJson.mockResolvedValue(null);
    redisMock.setJson.mockResolvedValue(undefined);
    redisMock.del.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
  });

  describe('findAllActive', () => {
    it('em cache MISS, consulta o Postgres, converte Decimal para number e grava no Redis com TTL', async () => {
      prismaMock.ingredient.findMany.mockResolvedValue([baseRecord]);

      const result = await service.findAllActive();

      expect(redisMock.getJson).toHaveBeenCalledWith(CATALOG_ACTIVE_CACHE_KEY);
      expect(prismaMock.ingredient.findMany).toHaveBeenCalledWith({
        where: { active: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
      expect(result[0]?.pricePerKg).toBe(45.5);
      expect(typeof result[0]?.pricePerKg).toBe('number');
      expect(redisMock.setJson).toHaveBeenCalledWith(
        CATALOG_ACTIVE_CACHE_KEY,
        result,
        CATALOG_ACTIVE_CACHE_TTL_SECONDS,
      );
    });

    it('em cache HIT, devolve os itens do Redis hidratando createdAt/updatedAt sem ir ao Postgres', async () => {
      redisMock.getJson.mockResolvedValueOnce([
        {
          ...baseRecord,
          pricePerKg: 45.5,
          createdAt: '2026-10-28T00:00:00.000Z',
          updatedAt: '2026-10-28T00:00:00.000Z',
        },
      ]);

      const result = await service.findAllActive();

      expect(prismaMock.ingredient.findMany).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]?.pricePerKg).toBe(45.5);
      expect(result[0]?.createdAt).toBeInstanceOf(Date);
      expect(result[0]?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('findAllForAdmin', () => {
    it('busca todos os ingredientes ordenados por tipo e nome direto do Postgres (sem cache)', async () => {
      prismaMock.ingredient.findMany.mockResolvedValue([baseRecord]);

      const result = await service.findAllForAdmin();

      expect(prismaMock.ingredient.findMany).toHaveBeenCalledWith({
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
      expect(result[0]?.pricePerKg).toBe(45.5);
      expect(redisMock.getJson).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('retorna o ingrediente serializado quando existe', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue(baseRecord);

      await expect(service.findById('abc')).resolves.toMatchObject({
        id: 'abc',
        name: 'Chantilly',
        pricePerKg: 45.5,
      });
    });

    it('lanca NotFoundException quando nao existe', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue(null);

      await expect(service.findById('id-invalido')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('normaliza nome e alergenicos, persiste no Prisma e invalida o cache do catalogo no Redis', async () => {
      prismaMock.ingredient.create.mockResolvedValue({
        ...baseRecord,
        name: 'Brigadeiro',
        type: IngredientType.RECHEIO,
        pricePerKg: new Prisma.Decimal('25.00'),
        allergens: ['leite', 'lactose'],
      });

      const created = await service.create({
        name: '  Brigadeiro  ',
        type: IngredientType.RECHEIO,
        pricePerKg: 25,
        allergens: [' Leite ', 'lactose', 'LEITE', '   '],
      });

      expect(prismaMock.ingredient.create).toHaveBeenCalledWith({
        data: {
          name: 'Brigadeiro',
          type: IngredientType.RECHEIO,
          pricePerKg: 25,
          allergens: ['leite', 'lactose'],
        },
      });
      expect(created.pricePerKg).toBe(25);
      expect(redisMock.del).toHaveBeenCalledWith(CATALOG_ACTIVE_CACHE_KEY);
    });
  });

  describe('update', () => {
    it('lanca NotFoundException se o ingrediente nao existir antes de tentar atualizar', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue(null);

      await expect(service.update('id-invalido', { pricePerKg: 10 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prismaMock.ingredient.update).not.toHaveBeenCalled();
      expect(redisMock.del).not.toHaveBeenCalled();
    });

    it('atualiza quando o ingrediente existe, devolve pricePerKg numerico e invalida o cache no Redis', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue(baseRecord);
      prismaMock.ingredient.update.mockResolvedValue({
        ...baseRecord,
        pricePerKg: new Prisma.Decimal('48.90'),
      });

      const updated = await service.update('abc', { pricePerKg: 48.9 });

      expect(prismaMock.ingredient.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: { pricePerKg: 48.9 },
      });
      expect(updated.pricePerKg).toBe(48.9);
      expect(redisMock.del).toHaveBeenCalledWith(CATALOG_ACTIVE_CACHE_KEY);
    });
  });

  describe('deactivate', () => {
    it('inativa em vez de excluir fisicamente e invalida o cache do catalogo no Redis', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue(baseRecord);
      prismaMock.ingredient.update.mockResolvedValue({ ...baseRecord, active: false });

      const deactivated = await service.deactivate('abc');

      expect(prismaMock.ingredient.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: { active: false },
      });
      expect(deactivated.active).toBe(false);
      expect(redisMock.del).toHaveBeenCalledWith(CATALOG_ACTIVE_CACHE_KEY);
    });

    it('lanca NotFoundException se o ingrediente nao existir', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('id-invalido')).rejects.toBeInstanceOf(NotFoundException);
      expect(redisMock.del).not.toHaveBeenCalled();
    });
  });
});
