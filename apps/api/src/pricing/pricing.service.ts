import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { IngredientType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CakeLayerInputDto, CalculatePriceDto } from './dto/calculate-price.dto';

/**
 * Taxa Base de Montagem (RN02), expressa em centavos para o calculo inteiro
 * e reexposta em reais para os consumidores do modulo.
 */
const ASSEMBLY_BASE_FEE_CENTS = 2500;
export const ASSEMBLY_BASE_FEE = ASSEMBLY_BASE_FEE_CENTS / 100;

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

interface CatalogPricingItem {
  id: string;
  type: IngredientType;
  priceCentsPerKg: number;
  isAerated: boolean;
}

/**
 * Motor de precificacao em tempo real do Cake Builder.
 *
 * RN02 - Calculo Volumetrico de Preco:
 *   preco final = Soma, por andar, de (Soma do preco/kg de cada insumo do
 *   andar x peso estimado do andar) + Taxa Base de Montagem.
 *   Executado inteiramente em inteiros (centavos x gramas) para eliminar
 *   desvios de arredondamento IEEE-754 (ex.: R$ 17,00/kg x 1,005 kg = R$ 17,09).
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
    this.assertFloorSequenceAndUniqueFillings(dto.floors);

    const ingredientIds = this.collectIngredientIds(dto.floors);

    const ingredients = await this.prisma.ingredient.findMany({
      where: { id: { in: ingredientIds }, active: true },
    });

    const catalogById = new Map<string, CatalogPricingItem>(
      ingredients.map((ingredient) => [
        ingredient.id,
        {
          id: ingredient.id,
          type: ingredient.type,
          priceCentsPerKg: toScaledInt(ingredient.pricePerKg, 2),
          isAerated: ingredient.isAerated,
        },
      ]),
    );

    const aeratedIngredientIds = new Set(
      ingredients.filter((ingredient) => ingredient.isAerated).map((ingredient) => ingredient.id),
    );

    this.assertAllIngredientsExist(ingredientIds, catalogById);
    this.assertSlotIngredientTypes(dto.floors, catalogById);
    this.assertStructuralIntegrity(dto.floors, aeratedIngredientIds);

    const computedLayers = dto.floors.map((floor) => this.computeLayerSubtotal(floor, catalogById));

    const totalPriceCents =
      computedLayers.reduce((sum, layer) => sum + layer.subtotalCents, 0) + ASSEMBLY_BASE_FEE_CENTS;

    return {
      layers: computedLayers.map(({ subtotalCents: _subtotalCents, ...publicLayer }) => publicLayer),
      assemblyBaseFee: ASSEMBLY_BASE_FEE,
      totalPrice: centsToReais(totalPriceCents),
    };
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
    if (floors.length <= 2) {
      return;
    }

    const usesAeratedDough = floors.some((floor) =>
      aeratedIngredientIds.has(floor.doughIngredientId),
    );
    if (usesAeratedDough) {
      throw new UnprocessableEntityException(
        'Massas aeradas nao sao permitidas em bolos com mais de 2 andares (risco estrutural de desabamento).',
      );
    }
  }

  private assertFloorSequenceAndUniqueFillings(floors: CakeLayerInputDto[]): void {
    const seenFloors = new Set<number>();

    for (const floor of floors) {
      if (floor.floorNumber < 1 || floor.floorNumber > floors.length || seenFloors.has(floor.floorNumber)) {
        throw new UnprocessableEntityException(
          `A numeracao dos andares deve cobrir sequencialmente de 1 ate ${floors.length} sem repeticoes.`,
        );
      }
      seenFloors.add(floor.floorNumber);

      if (new Set(floor.fillingIngredientIds).size !== floor.fillingIngredientIds.length) {
        throw new UnprocessableEntityException(
          `O andar ${floor.floorNumber} contem recheios duplicados; selecione insumos distintos.`,
        );
      }
    }
  }

  private assertSlotIngredientTypes(
    floors: CakeLayerInputDto[],
    catalogById: Map<string, CatalogPricingItem>,
  ): void {
    for (const floor of floors) {
      const dough = catalogById.get(floor.doughIngredientId);
      if (dough?.type !== IngredientType.MASSA) {
        throw new UnprocessableEntityException(
          `O insumo ${floor.doughIngredientId} no andar ${floor.floorNumber} deve ser do tipo MASSA.`,
        );
      }

      const coverage = catalogById.get(floor.coverageIngredientId);
      if (coverage?.type !== IngredientType.COBERTURA) {
        throw new UnprocessableEntityException(
          `O insumo ${floor.coverageIngredientId} no andar ${floor.floorNumber} deve ser do tipo COBERTURA.`,
        );
      }

      for (const fillingId of floor.fillingIngredientIds) {
        const filling = catalogById.get(fillingId);
        if (filling?.type !== IngredientType.RECHEIO) {
          throw new UnprocessableEntityException(
            `O insumo ${fillingId} no andar ${floor.floorNumber} deve ser do tipo RECHEIO.`,
          );
        }
      }
    }
  }

  private computeLayerSubtotal(
    floor: CakeLayerInputDto,
    catalogById: Map<string, CatalogPricingItem>,
  ): LayerPriceBreakdown & { subtotalCents: number } {
    const ingredientIdsInLayer = [
      floor.doughIngredientId,
      floor.coverageIngredientId,
      ...floor.fillingIngredientIds,
    ];

    const pricePerKgCombinedCents = ingredientIdsInLayer.reduce(
      (sum, ingredientId) => sum + (catalogById.get(ingredientId)?.priceCentsPerKg ?? 0),
      0,
    );

    const weightGrams = toScaledInt(floor.estimatedWeightKg, 3);
    // (centavos/kg * gramas) / 1000g, com arredondamento half-up em inteiros.
    const subtotalCents = Math.floor((pricePerKgCombinedCents * weightGrams + 500) / 1000);

    return {
      floorNumber: floor.floorNumber,
      weightKg: floor.estimatedWeightKg,
      pricePerKgCombined: centsToReais(pricePerKgCombinedCents),
      subtotal: centsToReais(subtotalCents),
      subtotalCents,
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
    catalogById: Map<string, CatalogPricingItem>,
  ): void {
    const missing = requestedIds.filter((id) => !catalogById.has(id));
    if (missing.length > 0) {
      throw new UnprocessableEntityException(
        `Um ou mais ingredientes selecionados nao existem ou estao inativos: ${missing.join(', ')}`,
      );
    }
  }
}

/**
 * Converte Decimal do Prisma, string decimal ou numero positivo para inteiro
 * escalado (scale=2 -> centavos; scale=3 -> gramas) por parsing textual, sem
 * multiplicacao em ponto flutuante IEEE-754.
 */
function toScaledInt(raw: { toString(): string } | number | string, scale: number): number {
  const [wholePart, fractionRaw = ''] = raw.toString().trim().split('.');
  const paddedFraction = fractionRaw.padEnd(scale, '0').slice(0, scale);
  const nextDigit = fractionRaw[scale];
  const carry = nextDigit !== undefined && nextDigit >= '5' ? 1 : 0;

  return Number(wholePart) * 10 ** scale + Number(paddedFraction) + carry;
}

function centsToReais(cents: number): number {
  return cents / 100;
}
