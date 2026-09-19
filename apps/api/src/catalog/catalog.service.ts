import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista o catalogo ativo - consumido pelo Cake Builder e pelo PricingService. */
  findAllActive() {
    return this.prisma.ingredient.findMany({ where: { active: true } });
  }

  /** Visao administrativa completa (inclui itens inativos). */
  findAllForAdmin() {
    return this.prisma.ingredient.findMany({ orderBy: { type: 'asc' } });
  }

  async findById(id: string) {
    const ingredient = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      throw new NotFoundException('Ingrediente nao encontrado.');
    }
    return ingredient;
  }

  create(dto: CreateIngredientDto) {
    return this.prisma.ingredient.create({ data: dto });
  }

  async update(id: string, dto: UpdateIngredientDto) {
    await this.findById(id);
    return this.prisma.ingredient.update({ where: { id }, data: dto });
  }

  /** Inativacao logica (nunca deletar fisicamente - preserva o historico de pedidos). */
  async deactivate(id: string) {
    await this.findById(id);
    return this.prisma.ingredient.update({ where: { id }, data: { active: false } });
  }
}
