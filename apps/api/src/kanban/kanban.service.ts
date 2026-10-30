import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CakeFormat, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

import { EmailService } from '../email/email.service';
import { GamificationService } from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { ORDER_EVENTS_CHANNEL, RedisService } from '../redis/redis.service';

export interface KanbanCakeLayer {
  id: string;
  floorNumber: number;
  estimatedWeightKg: number;
  doughName: string;
  coverageName: string;
  fillingNames: string[];
}

export interface KanbanCakeConfiguration {
  id: string;
  format: CakeFormat;
  floorsCount: number;
  colorHex: string;
  dietaryFlags: string[];
  layers: KanbanCakeLayer[];
}

export interface KanbanOrderItem {
  id: string;
  ingredientId: string;
  ingredientNameSnapshot: string;
  pricePerKgSnapshot: number;
  weightKg: number;
  subtotal: number;
}

export interface KanbanOrderCard {
  id: string;
  userId: string;
  customerName: string;
  status: OrderStatus;
  totalPrice: number;
  toppingMessage: string | null;
  riceImageUrl: string | null;
  deliveryAddress: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  cakeConfiguration: KanbanCakeConfiguration | null;
  items: KanbanOrderItem[];
}

const KANBAN_VISIBLE_STATUSES: OrderStatus[] = [
  OrderStatus.EM_ESPERA,
  OrderStatus.EM_PRODUCAO,
  OrderStatus.FINALIZACAO,
  OrderStatus.PRONTO,
];

const ALLOWED_KANBAN_TRANSITIONS: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.EM_ESPERA]: [OrderStatus.EM_PRODUCAO],
  [OrderStatus.EM_PRODUCAO]: [OrderStatus.EM_ESPERA, OrderStatus.FINALIZACAO],
  [OrderStatus.FINALIZACAO]: [OrderStatus.EM_PRODUCAO, OrderStatus.PRONTO],
  [OrderStatus.PRONTO]: [OrderStatus.ENTREGUE],
};

const KANBAN_ORDER_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      anonymizedAt: true,
    },
  },
  cakeConfiguration: {
    include: {
      layers: {
        orderBy: { floorNumber: 'asc' as const },
        include: {
          doughIngredient: { select: { name: true } },
          coverageIngredient: { select: { name: true } },
          fillings: {
            include: {
              ingredient: { select: { name: true } },
            },
          },
        },
      },
    },
  },
  items: true,
  payment: {
    select: {
      status: true,
      paidAt: true,
    },
  },
} satisfies Prisma.OrderInclude;

type KanbanOrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof KANBAN_ORDER_INCLUDE;
}>;

@Injectable()
export class KanbanService {
  private readonly logger = new Logger(KanbanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gamificationService: GamificationService,
    private readonly emailService: EmailService,
    private readonly redis: RedisService,
  ) {}

  /**
   * UC04 / RF08 / RN03: retorna somente pedidos pagos que ingressaram na fila
   * de producao da cozinha (nunca expoe AGUARDANDO_PAGAMENTO).
   */
  async listProductionQueue(): Promise<KanbanOrderCard[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: KANBAN_VISIBLE_STATUSES },
      },
      orderBy: { createdAt: 'asc' },
      include: KANBAN_ORDER_INCLUDE,
    });

    return orders.map(serializeKanbanOrder);
  }

  /**
   * UC04 + UC02: move o pedido entre as colunas do Kanban, publica atualizacao
   * no Redis Pub/Sub (consumida pelo KanbanGateway Socket.io) e, ao atingir
   * PRONTO, concede XP de fidelidade (RN04) e notifica o cliente por e-mail.
   */
  async transitionOrderStatus(
    orderId: string,
    targetStatus: OrderStatus,
  ): Promise<KanbanOrderCard> {
    const existing = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: KANBAN_ORDER_INCLUDE,
    });

    if (!existing) {
      throw new NotFoundException('Pedido nao encontrado.');
    }

    const allowedTargets = ALLOWED_KANBAN_TRANSITIONS[existing.status];
    if (!allowedTargets || !allowedTargets.includes(targetStatus)) {
      throw new UnprocessableEntityException(
        `Transicao invalida de ${existing.status} para ${targetStatus} no Kanban da cozinha.`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: targetStatus },
      include: KANBAN_ORDER_INCLUDE,
    });

    if (targetStatus === OrderStatus.PRONTO) {
      await this.gamificationService.awardXpForCompletedOrder(updated.id);

      if (!updated.user.anonymizedAt) {
        try {
          await this.emailService.sendOrderReadyEmail(
            updated.user.email,
            updated.user.name,
            updated.id,
          );
        } catch (error) {
          this.logger.warn(
            `Falha ao enviar e-mail de pedido pronto (${updated.id}): ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    await this.redis.publishJson(ORDER_EVENTS_CHANNEL, {
      type: 'ORDER_STATUS_UPDATED',
      orderId: updated.id,
      userId: updated.userId,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });

    return serializeKanbanOrder(updated);
  }
}

function serializeKanbanOrder(order: KanbanOrderWithRelations): KanbanOrderCard {
  return {
    id: order.id,
    userId: order.userId,
    customerName: order.user.name,
    status: order.status,
    totalPrice: Number(order.totalPrice),
    toppingMessage: order.toppingMessage,
    riceImageUrl: order.riceImageUrl,
    deliveryAddress: order.deliveryAddress,
    paidAt: order.payment?.status === PaymentStatus.PAGO ? order.payment.paidAt : null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    cakeConfiguration: order.cakeConfiguration
      ? {
          id: order.cakeConfiguration.id,
          format: order.cakeConfiguration.format,
          floorsCount: order.cakeConfiguration.floorsCount,
          colorHex: order.cakeConfiguration.colorHex,
          dietaryFlags: order.cakeConfiguration.dietaryFlags,
          layers: order.cakeConfiguration.layers.map((layer) => ({
            id: layer.id,
            floorNumber: layer.floorNumber,
            estimatedWeightKg: Number(layer.estimatedWeightKg),
            doughName: layer.doughIngredient.name,
            coverageName: layer.coverageIngredient.name,
            fillingNames: layer.fillings.map((f) => f.ingredient.name),
          })),
        }
      : null,
    items: order.items.map((item) => ({
      id: item.id,
      ingredientId: item.ingredientId,
      ingredientNameSnapshot: item.ingredientNameSnapshot,
      pricePerKgSnapshot: Number(item.pricePerKgSnapshot),
      weightKg: Number(item.weightKg),
      subtotal: Number(item.subtotal),
    })),
  };
}
