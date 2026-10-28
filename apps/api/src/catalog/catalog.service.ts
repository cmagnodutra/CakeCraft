import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Ingredient } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';

export const CATALOG_ACTIVE_CACHE_KEY = 'catalog:active:v1';
export const CATALOG_ACTIVE_CACHE_TTL_SECONDS = 300;

export type CatalogIngredient = Omit<Ingredient, 'pricePerKg'> & {
  pricePerKg: number;
};

type CachedCatalogIngredient = Omit<CatalogIngredient, 'createdAt' | 'updatedAt'> & {
  createdAt: string | Date;
  updatedAt: string | Date;
};

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  /**
   * Lista o catalogo ativo - consumido pelo Cake Builder e pelo PricingService.
   * Servido a partir do Redis (TTL 5 min) e invalidado automaticamente a cada
   * mutacao administrativa (POST, PATCH, DELETE), conforme Secao 5.4 do RFC.
   */
  async findAllActive(): Promise<CatalogIngredient[]> {
    const cached = await this.redis?.getJson<CachedCatalogIngredient[]>(CATALOG_ACTIVE_CACHE_KEY);
    if (cached) {
      return cached.map(reviveCachedIngredient);
    }

    const items = await this.prisma.ingredient.findMany({
      where: { active: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    const normalized = items.map(toCatalogIngredient);

    await this.redis?.setJson(
      CATALOG_ACTIVE_CACHE_KEY,
      normalized,
      CATALOG_ACTIVE_CACHE_TTL_SECONDS,
    );

    return normalized;
  }

  /** Visao administrativa completa (inclui itens inativos, sempre direto do PostgreSQL). */
  async findAllForAdmin(): Promise<CatalogIngredient[]> {
    const items = await this.prisma.ingredient.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
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
    const created = await this.prisma.ingredient.create({
      data: normalizeCreatePayload(dto),
    });
    await this.invalidateActiveCache();
    return toCatalogIngredient(created);
  }

  async update(id: string, dto: UpdateIngredientDto): Promise<CatalogIngredient> {
    await this.findById(id);
    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: normalizeUpdatePayload(dto),
    });
    await this.invalidateActiveCache();
    return toCatalogIngredient(updated);
  }

  /** Inativacao logica (nunca deletar fisicamente - preserva o historico de pedidos). */
  async deactivate(id: string): Promise<CatalogIngredient> {
    await this.findById(id);
    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: { active: false },
    });
    await this.invalidateActiveCache();
    return toCatalogIngredient(updated);
  }

  private async invalidateActiveCache(): Promise<void> {
    await this.redis?.del(CATALOG_ACTIVE_CACHE_KEY);
  }
}

function normalizeAllergens(allergens: string[]): string[] {
  const unique = new Set<string>();
  for (const item of allergens) {
    const cleaned = item.trim().toLowerCase();
    if (cleaned.length > 0) {
      unique.add(cleaned);
    }
  }
  return Array.from(unique);
}

function normalizeCreatePayload(dto: CreateIngredientDto): CreateIngredientDto {
  const payload: CreateIngredientDto = {
    ...dto,
    name: dto.name.trim(),
  };
  if (dto.allergens !== undefined) {
    payload.allergens = normalizeAllergens(dto.allergens);
  }
  return payload;
}

function normalizeUpdatePayload(dto: UpdateIngredientDto): UpdateIngredientDto {
  const payload: UpdateIngredientDto = { ...dto };
  if (dto.name !== undefined) {
    payload.name = dto.name.trim();
  }
  if (dto.allergens !== undefined) {
    payload.allergens = normalizeAllergens(dto.allergens);
  }
  return payload;
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

function reviveCachedIngredient(item: CachedCatalogIngredient): CatalogIngredient {
  return {
    ...item,
    pricePerKg: Number(item.pricePerKg),
    createdAt: item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt),
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt : new Date(item.updatedAt),
  };
}
