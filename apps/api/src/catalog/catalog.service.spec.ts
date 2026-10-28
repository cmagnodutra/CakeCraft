import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IngredientType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CatalogService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
  });

  describe('findAllActive', () => {
    it('busca so ingredientes ativos e converte Decimal pricePerKg para number', async () => {
      prismaMock.ingredient.findMany.mockResolvedValue([baseRecord]);

      const result = await service.findAllActive();

      expect(prismaMock.ingredient.findMany).toHaveBeenCalledWith({ where: { active: true } });
      expect(result[0]?.pricePerKg).toBe(45.5);
      expect(typeof result[0]?.pricePerKg).toBe('number');
    });
  });

  describe('findAllForAdmin', () => {
    it('busca todos os ingredientes ordenados por tipo com pricePerKg numerico', async () => {
      prismaMock.ingredient.findMany.mockResolvedValue([baseRecord]);

      const result = await service.findAllForAdmin();

      expect(prismaMock.ingredient.findMany).toHaveBeenCalledWith({ orderBy: { type: 'asc' } });
      expect(result[0]?.pricePerKg).toBe(45.5);
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
    it('persiste no Prisma e devolve pricePerKg como number JSON', async () => {
      prismaMock.ingredient.create.mockResolvedValue({
        ...baseRecord,
        name: 'Brigadeiro',
        type: IngredientType.RECHEIO,
        pricePerKg: new Prisma.Decimal('25.00'),
      });

      const created = await service.create({
        name: 'Brigadeiro',
        type: IngredientType.RECHEIO,
        pricePerKg: 25,
      });

      expect(created.pricePerKg).toBe(25);
      expect(typeof created.pricePerKg).toBe('number');
    });
  });

  describe('update', () => {
    it('lanca NotFoundException se o ingrediente nao existir antes de tentar atualizar', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue(null);

      await expect(service.update('id-invalido', { pricePerKg: 10 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prismaMock.ingredient.update).not.toHaveBeenCalled();
    });

    it('atualiza quando o ingrediente existe e devolve pricePerKg numerico', async () => {
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
    });
  });

  describe('deactivate', () => {
    it('inativa em vez de excluir fisicamente', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue(baseRecord);
      prismaMock.ingredient.update.mockResolvedValue({ ...baseRecord, active: false });

      const deactivated = await service.deactivate('abc');

      expect(prismaMock.ingredient.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: { active: false },
      });
      expect(deactivated.active).toBe(false);
    });

    it('lanca NotFoundException se o ingrediente nao existir', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('id-invalido')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
