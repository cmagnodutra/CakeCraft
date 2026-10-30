import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';

import { Role } from '../common/enums/role.enum';
import { ORDER_EVENTS_CHANNEL, OrderRealtimeEvent, RedisService } from '../redis/redis.service';
import { ADMIN_KITCHEN_ROOM, KanbanGateway } from './kanban.gateway';

describe('KanbanGateway (WebSocket Socket.io + Redis Pub/Sub)', () => {
  const verifyAsyncMock = jest.fn();
  const jwtMock = { verifyAsync: verifyAsyncMock } as unknown as JwtService;

  const configMock = {
    getOrThrow: jest.fn(() => 'jwt-secret-test'),
  } as unknown as ConfigService;

  let subscribedHandler: ((event: OrderRealtimeEvent) => void) | undefined;
  const subscribeJsonMock = jest.fn(
    (_channel: string, handler: (event: OrderRealtimeEvent) => void) => {
      subscribedHandler = handler;
      return Promise.resolve();
    },
  );
  const redisMock = { subscribeJson: subscribeJsonMock } as unknown as RedisService;

  let gateway: KanbanGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    subscribedHandler = undefined;
    gateway = new KanbanGateway(jwtMock, configMock, redisMock);
  });

  it('desconecta sockets sem cookie access_token valido', async () => {
    const disconnectMock = jest.fn();
    const joinMock = jest.fn();
    const unauthSocket = {
      handshake: { headers: {} },
      disconnect: disconnectMock,
      join: joinMock,
    } as unknown as Socket;

    await gateway.handleConnection(unauthSocket);
    expect(disconnectMock).toHaveBeenCalledWith(true);
    expect(joinMock).not.toHaveBeenCalled();

    // Cookie com JWT expirado/invalido
    verifyAsyncMock.mockRejectedValueOnce(new Error('invalid signature'));
    const badTokenSocket = {
      handshake: { headers: { cookie: 'other=1; access_token=forjado' } },
      disconnect: disconnectMock,
      join: joinMock,
    } as unknown as Socket;

    await gateway.handleConnection(badTokenSocket);
    expect(disconnectMock).toHaveBeenCalledTimes(2);
  });

  it('isola CLIENTE na sala user:<id> e adiciona ADMIN tambem na sala kitchen:admins', async () => {
    const disconnectMock = jest.fn();
    const joinCustomerMock = jest.fn().mockResolvedValue(undefined);
    verifyAsyncMock.mockResolvedValueOnce({
      sub: 'cust-1',
      email: 'mariana@example.com',
      role: Role.CLIENTE,
    });

    const customerSocket = {
      handshake: { headers: { cookie: 'access_token=jwt-cliente' } },
      disconnect: disconnectMock,
      join: joinCustomerMock,
    } as unknown as Socket;

    await gateway.handleConnection(customerSocket);
    expect(joinCustomerMock).toHaveBeenCalledTimes(1);
    expect(joinCustomerMock).toHaveBeenCalledWith('user:cust-1');
    expect(disconnectMock).not.toHaveBeenCalled();

    const joinAdminMock = jest.fn().mockResolvedValue(undefined);
    verifyAsyncMock.mockResolvedValueOnce({
      sub: 'adm-1',
      email: 'admin@cakecraft.com.br',
      role: Role.ADMIN,
    });

    const adminSocket = {
      handshake: { headers: { cookie: 'foo=bar; access_token=jwt-admin' } },
      disconnect: disconnectMock,
      join: joinAdminMock,
    } as unknown as Socket;

    await gateway.handleConnection(adminSocket);
    expect(joinAdminMock).toHaveBeenCalledWith('user:adm-1');
    expect(joinAdminMock).toHaveBeenCalledWith(ADMIN_KITCHEN_ROOM);
  });

  it('assina o canal Redis Pub/Sub no startup e propaga order.updated para cozinha e dono do pedido', async () => {
    const emitMock = jest.fn();
    const secondToMock = jest.fn(() => ({ emit: emitMock }));
    const firstToMock = jest.fn(() => ({ to: secondToMock }));
    gateway.server = { to: firstToMock } as unknown as Server;

    await gateway.onModuleInit();
    expect(subscribeJsonMock).toHaveBeenCalledWith(ORDER_EVENTS_CHANNEL, expect.any(Function));

    const event: OrderRealtimeEvent = {
      type: 'ORDER_STATUS_UPDATED',
      orderId: 'ord-99',
      userId: 'cust-1',
      status: 'PRONTO',
      updatedAt: '2026-10-29T21:00:00.000Z',
    };
    subscribedHandler?.(event);

    expect(firstToMock).toHaveBeenCalledWith(ADMIN_KITCHEN_ROOM);
    expect(secondToMock).toHaveBeenCalledWith('user:cust-1');
    expect(emitMock).toHaveBeenCalledWith('order.updated', event);
  });
});
