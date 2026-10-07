import { Injectable, UnprocessableEntityException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CakeLayerInputDto, CalculatePriceDto } from './dto/calculate-price.dto';

/**
 * Taxa Base de Montagem (RN02). Fixa por ora como constante - candidata a
 * virar uma linha configuravel em uma tabela `system_settings` se o negocio
 * precisar ajusta-la sem deploy (nao resolvido agora, so registrado).
 */
export const ASSEMBLY_BASE_FEE = 25.0;

export interface LayerPriceBreakdown {
  floorNumber: number;
  weightKg: number;
  pricePerKgCombined: number;
  subtotal: number;
}

export interface PriceCalculationResult {
  layers: LayerPriceBreakdown[];
  assemblyBaseFee: number;
  totalPrice: number;
}

/**
 * Motor de precificacao em tempo real do Cake Builder.
 *
 * RN02 - Calculo Volumetrico de Preco:
 *   preco final = Soma, por andar, de (Soma do preco/kg de cada insumo do
 *   andar x peso estimado do andar) + Taxa Base de Montagem.
 *
 * RN01 - Integridade Estrutural:
 *   bloqueia massas aeradas (Ingredient.isAerated = true) em bolos com mais
 *   de 2 andares, retornando 422 - mesmo que a validacao de frontend tenha
 *   sido contornada (Secao 3.2 do RFC).
 *
 * RNF01 - a resposta deste servico deve ficar abaixo de 500ms; por isso a
 * consulta ao catalogo busca so os ingredientes referenciados na
 * requisicao (findMany com `in`), nunca o catalogo inteiro.
 */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(dto: CalculatePriceDto): Promise<PriceCalculationResult> {
    const ingredientIds = this.collectIngredientIds(dto.floors);

    const ingredients = await this.prisma.ingredient.findMany({
      where: { id: { in: ingredientIds }, active: true },
    });

    const priceByIngredientId = new Map(
      ingredients.map((ingredient) => [ingredient.id, Number(ingredient.pricePerKg)]),
    );

    const aeratedIngredientIds = new Set(
      ingredients.filter((ingredient) => ingredient.isAerated).map((ingredient) => ingredient.id),
    );

    this.assertAllIngredientsExist(ingredientIds, priceByIngredientId);
    this.assertStructuralIntegrity(dto.floors, aeratedIngredientIds);

    const layers = dto.floors.map((floor) => this.computeLayerSubtotal(floor, priceByIngredientId));

    const totalPrice = round2(layers.reduce((sum, layer) => sum + layer.subtotal, 0) + ASSEMBLY_BASE_FEE);

    return { layers, assemblyBaseFee: ASSEMBLY_BASE_FEE, totalPrice };
  }

  /**
   * RN01 - bloqueia massa aerada em bolos de mais de 2 andares.
   *
   * Exposto como metodo publico e puro (sem I/O) de proposito: e a regra de
   * maior risco de negocio do sistema (um bolo que desaba na entrega e uma
   * falha grave), entao precisa ser testavel isoladamente, sem precisar
   * subir um banco para cada caso de teste.
   */
  assertStructuralIntegrity(floors: CakeLayerInputDto[], aeratedIngredientIds: Set<string>): void {
    const hasMoreThanTwoFloors = floors.length > 2;
    if (!hasMoreThanTwoFloors) {
      return;
    }

    const usesAeratedDough = floors.some((floor) => aeratedIngredientIds.has(floor.doughIngredientId));
    if (usesAeratedDough) {
      throw new UnprocessableEntityException(
        'Massas aeradas nao sao permitidas em bolos com mais de 2 andares (risco estrutural de desabamento).',
      );
    }
  }

  private computeLayerSubtotal(
    floor: CakeLayerInputDto,
    priceByIngredientId: Map<string, number>,
  ): LayerPriceBreakdown {
    const ingredientIdsInLayer = [
      floor.doughIngredientId,
      floor.coverageIngredientId,
      ...floor.fillingIngredientIds,
    ];

    const pricePerKgCombined = ingredientIdsInLayer.reduce(
      (sum, ingredientId) => sum + (priceByIngredientId.get(ingredientId) ?? 0),
      0,
    );

    const subtotal = round2(pricePerKgCombined * floor.estimatedWeightKg);

    return {
      floorNumber: floor.floorNumber,
      weightKg: floor.estimatedWeightKg,
      pricePerKgCombined: round2(pricePerKgCombined),
      subtotal,
    };
  }

  private collectIngredientIds(floors: CakeLayerInputDto[]): string[] {
    const ids = floors.flatMap((floor) => [
      floor.doughIngredientId,
      floor.coverageIngredientId,
      ...floor.fillingIngredientIds,
    ]);
    return Array.from(new Set(ids));
  }

  private assertAllIngredientsExist(
    requestedIds: string[],
    priceByIngredientId: Map<string, number>,
  ): void {
    const missing = requestedIds.filter((id) => !priceByIngredientId.has(id));
    if (missing.length > 0) {
      throw new UnprocessableEntityException(
        `Um ou mais ingredientes selecionados nao existem ou estao inativos: ${missing.join(', ')}`,
      );
    }
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
