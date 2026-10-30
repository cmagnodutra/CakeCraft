import { Injectable, Logger } from '@nestjs/common';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

export const XP_COMPLETION_REASON = 'PEDIDO_CONCLUIDO';
export const XP_PER_LEVEL = 1000;

export interface AwardXpResult {
  awarded: boolean;
  earnedXp: number;
  totalXp: number;
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
}

/**
 * RN04: 10 XP para cada R$ 10,00 (1000 centavos) gastos.
 * Calculado em centavos inteiros para evitar imprecisao IEEE-754.
 */
export function calculateEarnedXpFromCents(totalCents: number): number {
  if (totalCents < 1000) {
    return 0;
  }
  return Math.floor(totalCents / 1000) * 10;
}

/** RN04: os niveis de fidelidade escalam a cada 1000 XP acumulados (Nivel 1 = 0..999 XP). */
export function calculateLevelFromXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * UC02 (RF09, RN04): acionado quando o confeiteiro conclui o pedido (PRONTO)
   * no Kanban. Idempotente por `(orderId, reason)` em transacao ACID.
   */
  async awardXpForCompletedOrder(orderId: string): Promise<AwardXpResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      return {
        awarded: false,
        earnedXp: 0,
        totalXp: 0,
        previousLevel: 1,
        newLevel: 1,
        leveledUp: false,
      };
    }

    const totalCents = Math.round(Number(order.totalPrice) * 100);
    const earnedXp = calculateEarnedXpFromCents(totalCents);

    const outcome = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.xpTransaction.findFirst({
        where: { orderId: order.id, reason: XP_COMPLETION_REASON },
      });

      if (existing) {
        return {
          awarded: false,
          earnedXp: 0,
          totalXp: order.user.xp,
          previousLevel: order.user.level,
          newLevel: order.user.level,
          leveledUp: false,
        };
      }

      const previousLevel = order.user.level;
      const totalXp = order.user.xp + earnedXp;
      const newLevel = Math.max(previousLevel, calculateLevelFromXp(totalXp));

      await tx.xpTransaction.create({
        data: {
          userId: order.userId,
          orderId: order.id,
          amount: earnedXp,
          reason: XP_COMPLETION_REASON,
        },
      });

      await tx.user.update({
        where: { id: order.userId },
        data: { xp: totalXp, level: newLevel },
      });

      return {
        awarded: true,
        earnedXp,
        totalXp,
        previousLevel,
        newLevel,
        leveledUp: newLevel > previousLevel,
      };
    });

    if (outcome.awarded && outcome.leveledUp && !order.user.anonymizedAt) {
      try {
        await this.emailService.sendLevelUpRewardEmail(
          order.user.email,
          order.user.name,
          outcome.newLevel,
          outcome.totalXp,
        );
      } catch (error) {
        this.logger.warn(
          `Falha ao enviar e-mail de level-up para usuario ${order.userId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return outcome;
  }
}
