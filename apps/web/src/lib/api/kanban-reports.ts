import { getApiBaseUrl } from '@/lib/env';

import { apiRequest } from './client';
import { ApiError, NetworkError } from './errors';
import type { CakeFormat, OrderItemSnapshot, OrderStatus } from './orders';

export type KanbanTargetStatus =
  | 'EM_ESPERA'
  | 'EM_PRODUCAO'
  | 'FINALIZACAO'
  | 'PRONTO'
  | 'ENTREGUE';

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

export interface KanbanOrderCard {
  id: string;
  userId: string;
  customerName: string;
  status: OrderStatus;
  totalPrice: number;
  toppingMessage: string | null;
  riceImageUrl: string | null;
  deliveryAddress: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  cakeConfiguration: KanbanCakeConfiguration | null;
  items: OrderItemSnapshot[];
}

export interface FinancialOrderRow {
  id: string;
  customerName: string;
  status: OrderStatus;
  format: CakeFormat | null;
  floorsCount: number | null;
  totalPrice: number;
  paidAt: string;
  gatewayProvider: string;
  gatewayReference: string;
}

export interface FinancialReport {
  from: string;
  to: string;
  paidOrdersCount: number;
  totalRevenue: number;
  averageTicket: number;
  orders: FinancialOrderRow[];
}

export interface ReportPeriodFilter {
  from?: string;
  to?: string;
}

function buildPeriodQuery(filter?: ReportPeriodFilter): string {
  const params = new URLSearchParams();
  if (filter?.from) params.set('from', filter.from);
  if (filter?.to) params.set('to', filter.to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** UC04 / RF08: lista pedidos pagos na fila do Kanban da cozinha (ADMIN). */
export async function fetchKanbanOrders(): Promise<KanbanOrderCard[]> {
  return apiRequest<KanbanOrderCard[]>('/kanban/orders');
}

/** UC04: move um pedido entre colunas do Kanban (dispara XP/email em PRONTO). */
export async function updateKanbanOrderStatus(
  orderId: string,
  status: KanbanTargetStatus,
): Promise<KanbanOrderCard> {
  return apiRequest<KanbanOrderCard>(`/kanban/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

/** UC06 / RF10: agrega receita confirmada, pedidos pagos e ticket medio. */
export async function fetchFinancialReport(
  filter?: ReportPeriodFilter,
): Promise<FinancialReport> {
  return apiRequest<FinancialReport>(`/reports/financial${buildPeriodQuery(filter)}`);
}

/** UC06 / RF10: baixa o conteudo CSV autenticado por cookie httpOnly. */
export async function downloadFinancialCsvText(
  filter?: ReportPeriodFilter,
): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/reports/financial/csv${buildPeriodQuery(filter)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'text/csv' },
    });
  } catch {
    throw new NetworkError();
  }

  if (!response.ok) {
    throw new ApiError(response.status, []);
  }

  return response.text();
}
