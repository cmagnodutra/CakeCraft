import { Prisma } from '@prisma/client';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateEarnedXpFromCents,
  calculateLevelFromXp,
  GamificationService,
} from './gamification.service';

describe('GamificationService (UC02, RF09, RN04 - meta >= 95% cobertura)', () => {
  const orderFindUnique = jest.fn();
  const xpFindFirst = jest.fn();
  const xpCreate = jest.fn();
  const userUpdate = jest.fn();

  const prismaMock = {
    order: { findUnique: orderFindUnique },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        xpTransaction: { findFirst: xpFindFirst, create: xpCreate },
        user: { update: userUpdate },
      }),
    ),
  } as unknown as PrismaService;

  const sendLevelUpRewardEmailMock = jest.fn();
  const emailMock = {
    sendLevelUpRewardEmail: sendLevelUpRewardEmailMock,
  } as unknown as EmailService;

  let service: GamificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    sendLevelUpRewardEmailMock.mockResolvedValue(undefined);
    service = new GamificationService(prismaMock, emailMock);
  });

  it('calcula XP por blocos inteiros de R$ 10,00 (10 XP a cada R$ 10) e nivel a cada 1000 XP', () => {
    expect(calculateEarnedXpFromCents(0)).toBe(0);
    expect(calculateEarnedXpFromCents(999)).toBe(0);
    expect(calculateEarnedXpFromCents(1000)).toBe(10);
    expect(calculateEarnedXpFromCents(23950)).toBe(230);
    expect(calculateEarnedXpFromCents(105000)).toBe(1050);

    expect(calculateLevelFromXp(-10)).toBe(1);
    expect(calculateLevelFromXp(0)).toBe(1);
    expect(calculateLevelFromXp(999)).toBe(1);
    expect(calculateLevelFromXp(1000)).toBe(2);
    expect(calculateLevelFromXp(2450)).toBe(3);
  });

  it('retorna awarded=false quando o pedido nao existe', async () => {
    orderFindUnique.mockResolvedValueOnce(null);

    const res = await service.awardXpForCompletedOrder('inexistente');

    expect(res).toEqual({
      awarded: false,
      earnedXp: 0,
      totalXp: 0,
      previousLevel: 1,
      newLevel: 1,
      leveledUp: false,
    });
    expect(xpCreate).not.toHaveBeenCalled();
  });

  it('e idempotente: nao concede XP em duplicidade se XpTransaction ja existir para o pedido', async () => {
    orderFindUnique.mockResolvedValueOnce({
      id: 'order-1',
      userId: 'user-1',
      totalPrice: new Prisma.Decimal('250.00'),
      user: {
        id: 'user-1',
        name: 'Mariana',
        email: 'mariana@example.com',
        xp: 250,
        level: 1,
        anonymizedAt: null,
      },
    });
    xpFindFirst.mockResolvedValueOnce({ id: 'xp-existing', amount: 250 });

    const res = await service.awardXpForCompletedOrder('order-1');

    expect(res.awarded).toBe(false);
    expect(res.totalXp).toBe(250);
    expect(xpCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
    expect(sendLevelUpRewardEmailMock).not.toHaveBeenCalled();
  });

  it('concede XP sem disparar e-mail de level-up quando o cliente permanece no mesmo nivel', async () => {
    orderFindUnique.mockResolvedValueOnce({
      id: 'order-2',
      userId: 'user-1',
      totalPrice: new Prisma.Decimal('239.50'),
      user: {
        id: 'user-1',
        name: 'Mariana',
        email: 'mariana@example.com',
        xp: 400,
        level: 1,
        anonymizedAt: null,
      },
    });
    xpFindFirst.mockResolvedValueOnce(null);
    xpCreate.mockResolvedValueOnce({ id: 'xp-2' });
    userUpdate.mockResolvedValueOnce({});

    const res = await service.awardXpForCompletedOrder('order-2');

    expect(res).toEqual({
      awarded: true,
      earnedXp: 230,
      totalXp: 630,
      previousLevel: 1,
      newLevel: 1,
      leveledUp: false,
    });
    expect(xpCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        orderId: 'order-2',
        amount: 230,
        reason: 'PEDIDO_CONCLUIDO',
      },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { xp: 630, level: 1 },
    });
    expect(sendLevelUpRewardEmailMock).not.toHaveBeenCalled();
  });

  it('sobe de nivel ao cruzar 1000 XP, dispara e-mail de recompensa UC02 e tolera falha SMTP sem reverter XP', async () => {
    orderFindUnique.mockResolvedValue({
      id: 'order-lvl',
      userId: 'user-1',
      totalPrice: new Prisma.Decimal('250.00'),
      user: {
        id: 'user-1',
        name: 'Mariana',
        email: 'mariana@example.com',
        xp: 850,
        level: 1,
        anonymizedAt: null,
      },
    });
    xpFindFirst.mockResolvedValue(null);
    xpCreate.mockResolvedValue({ id: 'xp-lvl' });
    userUpdate.mockResolvedValue({});

    const res = await service.awardXpForCompletedOrder('order-lvl');

    expect(res).toEqual({
      awarded: true,
      earnedXp: 250,
      totalXp: 1100,
      previousLevel: 1,
      newLevel: 2,
      leveledUp: true,
    });
    expect(sendLevelUpRewardEmailMock).toHaveBeenCalledWith(
      'mariana@example.com',
      'Mariana',
      2,
      1100,
    );

    // Se o servidor SMTP falhar, o XP ja gravado nao e perdido
    sendLevelUpRewardEmailMock.mockRejectedValueOnce(new Error('SMTP timeout'));
    await expect(service.awardXpForCompletedOrder('order-lvl')).resolves.toMatchObject({
      awarded: true,
      newLevel: 2,
    });
  });

  it('nao envia e-mail de level-up se a conta ja tiver sido anonimizada pela LGPD', async () => {
    orderFindUnique.mockResolvedValueOnce({
      id: 'order-anon',
      userId: 'user-anon',
      totalPrice: new Prisma.Decimal('300.00'),
      user: {
        id: 'user-anon',
        name: 'Usuario Anonimizado',
        email: 'anon@cakecraft.local',
        xp: 800,
        level: 1,
        anonymizedAt: new Date(),
      },
    });
    xpFindFirst.mockResolvedValueOnce(null);
    xpCreate.mockResolvedValueOnce({ id: 'xp-anon' });
    userUpdate.mockResolvedValueOnce({});

    const res = await service.awardXpForCompletedOrder('order-anon');

    expect(res.leveledUp).toBe(true);
    expect(sendLevelUpRewardEmailMock).not.toHaveBeenCalled();
  });
});
