import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

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
    it('busca so ingredientes ativos', async () => {
      prismaMock.ingredient.findMany.mockResolvedValue([]);

      await service.findAllActive();

      expect(prismaMock.ingredient.findMany).toHaveBeenCalledWith({ where: { active: true } });
    });
  });

  describe('findAllForAdmin', () => {
    it('busca todos os ingredientes, ordenados por tipo', async () => {
      prismaMock.ingredient.findMany.mockResolvedValue([]);

      await service.findAllForAdmin();

      expect(prismaMock.ingredient.findMany).toHaveBeenCalledWith({ orderBy: { type: 'asc' } });
    });
  });

  describe('findById', () => {
    it('retorna o ingrediente quando existe', async () => {
      const ingredient = { id: 'abc', name: 'Chantilly' };
      prismaMock.ingredient.findUnique.mockResolvedValue(ingredient);

      await expect(service.findById('abc')).resolves.toEqual(ingredient);
    });

    it('lanca NotFoundException quando nao existe', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue(null);

      await expect(service.findById('id-invalido')).rejects.toBeInstanceOf(NotFoundException);
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

    it('atualiza quando o ingrediente existe', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue({ id: 'abc' });
      prismaMock.ingredient.update.mockResolvedValue({ id: 'abc', pricePerKg: 45 });

      await service.update('abc', { pricePerKg: 45 });

      expect(prismaMock.ingredient.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: { pricePerKg: 45 },
      });
    });
  });

  describe('deactivate', () => {
    it('inativa em vez de excluir fisicamente', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue({ id: 'abc' });

      await service.deactivate('abc');

      expect(prismaMock.ingredient.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: { active: false },
      });
    });

    it('lanca NotFoundException se o ingrediente nao existir', async () => {
      prismaMock.ingredient.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('id-invalido')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
