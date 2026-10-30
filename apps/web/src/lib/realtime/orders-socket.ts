import { io } from 'socket.io-client';

import type { OrderStatus } from '@/lib/api/orders';
import { getApiBaseUrl } from '@/lib/env';

export interface OrderRealtimeEvent {
  type: 'ORDER_PAID' | 'ORDER_STATUS_UPDATED' | 'ORDER_CANCELLED';
  orderId: string;
  userId: string;
  status: OrderStatus;
  updatedAt: string;
}

/**
 * Conecta ao KanbanGateway (`/ws/orders`) enviando automaticamente o cookie
 * httpOnly `access_token` (`withCredentials: true`). Devolve funcao de limpeza.
 */
export function subscribeToOrderUpdates(
  onEvent: (event: OrderRealtimeEvent) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const origin = new URL(getApiBaseUrl()).origin;
  const socket = io(`${origin}/ws/orders`, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  socket.on('order.updated', onEvent);

  return () => {
    socket.off('order.updated', onEvent);
    socket.disconnect();
  };
}
