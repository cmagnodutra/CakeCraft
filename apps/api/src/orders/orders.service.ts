import { randomUUID } from 'node:crypto';

import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CakeFormat, Ingredient, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-request';
import { PIX_GATEWAY_PORT, PixGatewayPort } from '../payments/pix-gateway.port';
import { CakeLayerInputDto } from '../pricing/dto/calculate-price.dto';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

export const PIX_EXPIRATION_MINUTES = 15;

const ADMIN_ROLES: readonly string[] = [Role.ADMIN];

function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role);
}

/** Equivalencias entre restricao alimentar declarada (RF06) e tags de alergenicos. */
const DIETARY_EQUIVALENTS: Record<string, string[]> = {
  lactose: ['lactose', 'leite'],
  leite: ['leite', 'lactose'],
  sem_lactose: ['lactose', 'leite'],
  gluten: ['gluten', 'trigo'],
  sem_gluten: ['gluten', 'trigo'],
  ovos: ['ovos', 'ovo'],
  castanhas: ['castanhas', 'nozes', 'amendoas'],
  amendoim: ['amendoim'],
  soja: ['soja'],
};

export interface SerializedOrderPayment {
  id: string;
  gatewayProvider: string;
  gatewayReference: string;
  qrCode: string | null;
  copyPasteCode: string | null;
  status: PaymentStatus;
  expiresAt: Date;
  paidAt: Date | null;
  refundedAt: Date | null;
}

export interface SerializedOrderItem {
  id: string;
  ingredientId: string;
  ingredientNameSnapshot: string;
  pricePerKgSnapshot: number;
  weightKg: number;
  subtotal: number;
}

export interface SerializedCakeLayer {
  id: string;
  floorNumber: number;
  doughIngredientId: string;
  coverageIngredientId: string;
  estimatedWeightKg: number;
  fillingIngredientIds: string[];
}

export interface SerializedCakeConfiguration {
  id: string;
  format: CakeFormat;
  floorsCount: number;
  colorHex: string;
  dietaryFlags: string[];
  layers: SerializedCakeLayer[];
}

export interface SerializedOrder {
  id: string;
  userId: string;
  status: OrderStatus;
  totalPrice: number;
  toppingMessage: string | null;
  riceImageUrl: string | null;
  deliveryAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
  cakeConfiguration: SerializedCakeConfiguration | null;
  items: SerializedOrderItem[];
  payment: SerializedOrderPayment | null;
}

const ORDER_INCLUDE = {
  cakeConfiguration: {
    include: {
      layers: {
        orderBy: { floorNumber: 'asc' as const },
        include: { fillings: true },
      },
    },
  },
  items: true,
  payment: true,
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    @Inject(PIX_GATEWAY_PORT) private readonly pixGateway: PixGatewayPort,
  ) {}

  /**
   * UC01 (RF02-RF07, RN01-RN03, RNF06):
   * 1. Recalcula o preco integralmente no servidor via PricingService;
   * 2. Bloqueia conflito entre restricoes alimentares (RF06) e alergenicos;
   * 3. Emite cobranca PIX no Asaas (15 min de validade);
   * 4. Persiste Order + CakeConfiguration + CakeLayers + Snapshots OrderItem +
   *    Payment em uma unica operacao atomica no PostgreSQL.
   */
  async createOrder(userId: string, dto: CreateOrderDto): Promise<SerializedOrder> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.anonymizedAt) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    const pricing = await this.pricingService.calculate({ floors: dto.floors });
    const ingredientIds = collectUniqueIngredientIds(dto.floors);
    const ingredients = await this.prisma.ingredient.findMany({
      where: { id: { in: ingredientIds }, active: true },
    });
    const ingredientsById = new Map(ingredients.map((item) => [item.id, item]));

    const normalizedFlags = normalizeFlags(dto.dietaryFlags ?? []);
    this.assertNoDietaryConflict(normalizedFlags, ingredients);

    const itemSnapshots = buildOrderItemSnapshots(dto.floors, ingredientsById);

    const orderId = randomUUID();
    const expiresAt = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60_000);

    const pixCharge = await this.pixGateway.createPixCharge({
      orderId,
      amount: pricing.totalPrice,
      customerName: user.name,
      customerEmail: user.email,
      description: `Pedido CakeCraft #${orderId.slice(0, 8)}`,
      expiresAt,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          id: orderId,
          userId,
          status: OrderStatus.AGUARDANDO_PAGAMENTO,
          totalPrice: pricing.totalPrice,
          toppingMessage: cleanOptionalText(dto.toppingMessage),
          riceImageUrl: dto.riceImageUrl ?? null,
          deliveryAddress: cleanOptionalText(dto.deliveryAddress),
          cakeConfiguration: {
            create: {
              format: dto.format,
              floorsCount: dto.floors.length,
              colorHex: dto.colorHex.toUpperCase(),
              dietaryFlags: normalizedFlags,
              layers: {
                create: dto.floors.map((floor) => ({
                  floorNumber: floor.floorNumber,
                  doughIngredientId: floor.doughIngredientId,
                  coverageIngredientId: floor.coverageIngredientId,
                  estimatedWeightKg: floor.estimatedWeightKg,
                  fillings: {
                    create: floor.fillingIngredientIds.map((fillingId) => ({
                      ingredientId: fillingId,
                    })),
                  },
                })),
              },
            },
          },
          items: {
            create: itemSnapshots,
          },
          payment: {
            create: {
              gatewayProvider: pixCharge.gatewayProvider,
              gatewayReference: pixCharge.gatewayReference,
              qrCode: pixCharge.qrCode,
              copyPasteCode: pixCharge.copyPasteCode,
              status: PaymentStatus.PENDENTE,
              expiresAt,
            },
          },
        },
        include: ORDER_INCLUDE,
      });
    });

    return serializeOrder(created);
  }

  async findMyOrders(userId: string): Promise<SerializedOrder[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });

    return Promise.all(orders.map((order) => this.syncExpirationAndSerialize(order)));
  }

  async findOrderById(orderId: string, actor: Pick<AuthenticatedUser, 'id' | 'role'>): Promise<SerializedOrder> {
    const order = await this.loadAuthorizedOrder(orderId, actor);
    return this.syncExpirationAndSerialize(order);
  }

  /**
   * Secao 3.2 do RFC:
   * - Cliente pode cancelar livremente enquanto AGUARDANDO_PAGAMENTO;
   * - Administrador pode cancelar enquanto AGUARDANDO_PAGAMENTO ou EM_ESPERA
   *   (antes do inicio do preparo), disparando estorno automatico se ja pago.
   */
  async cancelOrder(
    orderId: string,
    actor: Pick<AuthenticatedUser, 'id' | 'role'>,
  ): Promise<SerializedOrder> {
    const order = await this.loadAuthorizedOrder(orderId, actor);

    const isAdmin = isAdminRole(actor.role);
    const canCancel = isAdmin
      ? order.status === OrderStatus.AGUARDANDO_PAGAMENTO || order.status === OrderStatus.EM_ESPERA
      : order.status === OrderStatus.AGUARDANDO_PAGAMENTO;

    if (!canCancel) {
      throw new UnprocessableEntityException(
        'Este pedido nao pode mais ser cancelado no estagio atual.',
      );
    }

    const wasPaid = order.payment?.status === PaymentStatus.PAGO;
    if (wasPaid && order.payment) {
      await this.pixGateway.refundCharge(order.payment.gatewayReference);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: wasPaid
            ? { status: PaymentStatus.ESTORNADO, refundedAt: new Date() }
            : { status: PaymentStatus.EXPIRADO },
        });
      }

      return tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELADO },
        include: ORDER_INCLUDE,
      });
    });

    return serializeOrder(updated);
  }

  /**
   * Secao 3.2 do RFC: se o QR Code PIX expirar (15 min) enquanto o pedido ainda
   * aguarda pagamento, o cliente pode emitir uma nova cobranca PIX atualizada.
   */
  async regeneratePixCharge(
    orderId: string,
    actor: Pick<AuthenticatedUser, 'id' | 'role'>,
  ): Promise<SerializedOrder> {
    const order = await this.loadAuthorizedOrder(orderId, actor);

    if (order.status !== OrderStatus.AGUARDANDO_PAGAMENTO) {
      throw new UnprocessableEntityException(
        'So e possivel gerar um novo codigo PIX para pedidos aguardando pagamento.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: order.userId } });
    if (!user || user.anonymizedAt) {
      throw new NotFoundException('Usuario do pedido nao encontrado.');
    }

    const expiresAt = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60_000);
    const totalPriceNumber = Number(order.totalPrice);

    const pixCharge = await this.pixGateway.createPixCharge({
      orderId: order.id,
      amount: totalPriceNumber,
      customerName: user.name,
      customerEmail: user.email,
      description: `Pedido CakeCraft #${order.id.slice(0, 8)}`,
      expiresAt,
    });

    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      update: {
        gatewayProvider: pixCharge.gatewayProvider,
        gatewayReference: pixCharge.gatewayReference,
        qrCode: pixCharge.qrCode,
        copyPasteCode: pixCharge.copyPasteCode,
        status: PaymentStatus.PENDENTE,
        expiresAt,
      },
      create: {
        orderId: order.id,
        gatewayProvider: pixCharge.gatewayProvider,
        gatewayReference: pixCharge.gatewayReference,
        qrCode: pixCharge.qrCode,
        copyPasteCode: pixCharge.copyPasteCode,
        status: PaymentStatus.PENDENTE,
        expiresAt,
      },
    });

    const refreshed = await this.loadAuthorizedOrder(orderId, actor);
    return serializeOrder(refreshed);
  }

  private async loadAuthorizedOrder(
    orderId: string,
    actor: Pick<AuthenticatedUser, 'id' | 'role'>,
  ): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException('Pedido nao encontrado.');
    }

    if (!isAdminRole(actor.role) && order.userId !== actor.id) {
      throw new ForbiddenException('Voce nao tem permissao para acessar este pedido.');
    }

    return order;
  }

  private async syncExpirationAndSerialize(order: OrderWithRelations): Promise<SerializedOrder> {
    if (
      order.payment &&
      order.payment.status === PaymentStatus.PENDENTE &&
      order.payment.expiresAt.getTime() < Date.now()
    ) {
      const expiredPayment = await this.prisma.payment.update({
        where: { id: order.payment.id },
        data: { status: PaymentStatus.EXPIRADO },
      });
      return serializeOrder({ ...order, payment: expiredPayment });
    }

    return serializeOrder(order);
  }

  private assertNoDietaryConflict(dietaryFlags: string[], ingredients: Ingredient[]): void {
    if (dietaryFlags.length === 0) {
      return;
    }

    const forbiddenAllergens = new Set<string>();
    for (const flag of dietaryFlags) {
      const mapped = DIETARY_EQUIVALENTS[flag] ?? [flag];
      for (const allergen of mapped) {
        forbiddenAllergens.add(allergen);
      }
    }

    for (const ingredient of ingredients) {
      const conflict = ingredient.allergens
        .map((a) => a.trim().toLowerCase())
        .find((allergen) => forbiddenAllergens.has(allergen));

      if (conflict) {
        throw new UnprocessableEntityException(
          `Conflito de restricao alimentar: o insumo "${ingredient.name}" contem "${conflict}".`,
        );
      }
    }
  }
}

function collectUniqueIngredientIds(floors: CakeLayerInputDto[]): string[] {
  const ids = floors.flatMap((floor) => [
    floor.doughIngredientId,
    floor.coverageIngredientId,
    ...floor.fillingIngredientIds,
  ]);
  return Array.from(new Set(ids));
}

function normalizeFlags(flags: string[]): string[] {
  const unique = new Set<string>();
  for (const flag of flags) {
    const cleaned = flag.trim().toLowerCase();
    if (cleaned.length > 0) {
      unique.add(cleaned);
    }
  }
  return Array.from(unique);
}

function cleanOptionalText(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildOrderItemSnapshots(
  floors: CakeLayerInputDto[],
  ingredientsById: Map<string, Ingredient>,
): Array<{
  ingredientId: string;
  ingredientNameSnapshot: string;
  pricePerKgSnapshot: number;
  weightKg: number;
  subtotal: number;
}> {
  const snapshots: Array<{
    ingredientId: string;
    ingredientNameSnapshot: string;
    pricePerKgSnapshot: number;
    weightKg: number;
    subtotal: number;
  }> = [];

  for (const floor of floors) {
    const weightGrams = Math.round(floor.estimatedWeightKg * 1000);
    const layerIds = [
      floor.doughIngredientId,
      floor.coverageIngredientId,
      ...floor.fillingIngredientIds,
    ];

    for (const ingredientId of layerIds) {
      const ingredient = ingredientsById.get(ingredientId);
      if (!ingredient) {
        continue;
      }
      const pricePerKgNumber = Number(ingredient.pricePerKg);
      const priceCentsPerKg = Math.round(pricePerKgNumber * 100);
      const subtotalCents = Math.floor((priceCentsPerKg * weightGrams + 500) / 1000);

      snapshots.push({
        ingredientId: ingredient.id,
        ingredientNameSnapshot: ingredient.name,
        pricePerKgSnapshot: pricePerKgNumber,
        weightKg: floor.estimatedWeightKg,
        subtotal: subtotalCents / 100,
      });
    }
  }

  return snapshots;
}

function serializeOrder(order: OrderWithRelations): SerializedOrder {
  return {
    id: order.id,
    userId: order.userId,
    status: order.status,
    totalPrice: Number(order.totalPrice),
    toppingMessage: order.toppingMessage,
    riceImageUrl: order.riceImageUrl,
    deliveryAddress: order.deliveryAddress,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    cakeConfiguration: order.cakeConfiguration
      ? {
          id: order.cakeConfiguration.id,
          format: order.cakeConfiguration.format,
          floorsCount: order.cakeConfiguration.floorsCount,
          colorHex: order.cakeConfiguration.colorHex,
          dietaryFlags: order.cakeConfiguration.dietaryFlags,
          layers: (order.cakeConfiguration.layers ?? []).map((layer) => ({
            id: layer.id,
            floorNumber: layer.floorNumber,
            doughIngredientId: layer.doughIngredientId,
            coverageIngredientId: layer.coverageIngredientId,
            estimatedWeightKg: Number(layer.estimatedWeightKg),
            fillingIngredientIds: (layer.fillings ?? []).map((f) => f.ingredientId),
          })),
        }
      : null,
    items: (order.items ?? []).map((item) => ({
      id: item.id,
      ingredientId: item.ingredientId,
      ingredientNameSnapshot: item.ingredientNameSnapshot,
      pricePerKgSnapshot: Number(item.pricePerKgSnapshot),
      weightKg: Number(item.weightKg),
      subtotal: Number(item.subtotal),
    })),
    payment: order.payment
      ? {
          id: order.payment.id,
          gatewayProvider: order.payment.gatewayProvider,
          gatewayReference: order.payment.gatewayReference,
          qrCode: order.payment.qrCode,
          copyPasteCode: order.payment.copyPasteCode,
          status: order.payment.status,
          expiresAt: order.payment.expiresAt,
          paidAt: order.payment.paidAt,
          refundedAt: order.payment.refundedAt,
        }
      : null,
  };
}
