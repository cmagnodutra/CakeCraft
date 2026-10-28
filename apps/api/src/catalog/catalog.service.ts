import { Injectable, NotFoundException } from '@nestjs/common';
import { Ingredient } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';

export type CatalogIngredient = Omit<Ingredient, 'pricePerKg'> & {
  pricePerKg: number;
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista o catalogo ativo - consumido pelo Cake Builder e pelo PricingService. */
  async findAllActive(): Promise<CatalogIngredient[]> {
    const items = await this.prisma.ingredient.findMany({ where: { active: true } });
    return items.map(toCatalogIngredient);
  }

  /** Visao administrativa completa (inclui itens inativos). */
  async findAllForAdmin(): Promise<CatalogIngredient[]> {
    const items = await this.prisma.ingredient.findMany({ orderBy: { type: 'asc' } });
    return items.map(toCatalogIngredient);
  }

  async findById(id: string): Promise<CatalogIngredient> {
    const ingredient = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      throw new NotFoundException('Ingrediente nao encontrado.');
    }
    return toCatalogIngredient(ingredient);
  }

  async create(dto: CreateIngredientDto): Promise<CatalogIngredient> {
    const created = await this.prisma.ingredient.create({ data: dto });
    return toCatalogIngredient(created);
  }

  async update(id: string, dto: UpdateIngredientDto): Promise<CatalogIngredient> {
    await this.findById(id);
    const updated = await this.prisma.ingredient.update({ where: { id }, data: dto });
    return toCatalogIngredient(updated);
  }

  /** Inativacao logica (nunca deletar fisicamente - preserva o historico de pedidos). */
  async deactivate(id: string): Promise<CatalogIngredient> {
    await this.findById(id);
    const updated = await this.prisma.ingredient.update({ where: { id }, data: { active: false } });
    return toCatalogIngredient(updated);
  }
}

/**
 * Prisma devolve colunas Decimal(10, 2) como instancias de Prisma.Decimal, cujo
 * toJSON padrao serializa como string ("25.9"). Convertemos para number na
 * borda de leitura do servico para manter o contrato JSON numerico da API.
 */
function toCatalogIngredient(ingredient: Ingredient): CatalogIngredient {
  return {
    ...ingredient,
    pricePerKg: Number(ingredient.pricePerKg),
  };
}
