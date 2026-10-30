import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { ACCESS_TOKEN_COOKIE } from '../auth/auth-cookies.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Role } from '../common/enums/role.enum';
import { ORDER_EVENTS_CHANNEL, OrderRealtimeEvent, RedisService } from '../redis/redis.service';

export const ADMIN_KITCHEN_ROOM = 'kitchen:admins';

const ADMIN_ROLES: readonly string[] = [Role.ADMIN];

function extractCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    if (key === name) {
      const rawValue = trimmed.slice(eqIndex + 1).trim();
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }
  return null;
}

/**
 * Secao 5.3 / 5.4 do RFC (KanbanGateway):
 * - Autentica o handshake Socket.io pelo mesmo cookie httpOnly `access_token`;
 * - Isola clientes na sala `user:<id>` e administradores tambem em
 *   `kitchen:admins` (RBAC sobre WebSockets);
 * - Escuta eventos do Redis Pub/Sub e transmite `order.updated` em tempo real.
 */
@WebSocketGateway({
  namespace: '/ws/orders',
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class KanbanGateway implements OnGatewayConnection, OnModuleInit {
  @WebSocketServer()
  server?: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.redis.subscribeJson<OrderRealtimeEvent>(ORDER_EVENTS_CHANNEL, (event) => {
      if (!this.server) return;
      this.server
        .to(ADMIN_KITCHEN_ROOM)
        .to(`user:${event.userId}`)
        .emit('order.updated', event);
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = extractCookieValue(client.handshake.headers.cookie, ACCESS_TOKEN_COOKIE);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      await client.join(`user:${payload.sub}`);
      if (ADMIN_ROLES.includes(payload.role)) {
        await client.join(ADMIN_KITCHEN_ROOM);
      }
    } catch {
      client.disconnect(true);
    }
  }
}
