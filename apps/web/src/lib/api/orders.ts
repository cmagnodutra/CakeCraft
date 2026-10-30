import { getApiBaseUrl } from '@/lib/env';

import { apiRequest } from './client';

export type CakeFormat = 'REDONDO' | 'QUADRADO' | 'RETANGULAR';

export type OrderStatus =
  | 'AGUARDANDO_PAGAMENTO'
  | 'EM_ESPERA'
  | 'EM_PRODUCAO'
  | 'FINALIZACAO'
  | 'PRONTO'
  | 'ENTREGUE'
  | 'CANCELADO';

export type PaymentStatus = 'PENDENTE' | 'PAGO' | 'EXPIRADO' | 'ESTORNADO';

export interface CakeFloorInput {
  floorNumber: number;
  doughIngredientId: string;
  coverageIngredientId: string;
  fillingIngredientIds: string[];
  estimatedWeightKg: number;
}

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

export interface UploadedRicePaper {
  url: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  sizeBytes: number;
}

export interface CreateOrderInput {
  format: CakeFormat;
  colorHex: string;
  floors: CakeFloorInput[];
  dietaryFlags?: string[];
  toppingMessage?: string;
  riceImageUrl?: string;
  deliveryAddress?: string;
}

export interface OrderPayment {
  id: string;
  gatewayProvider: string;
  gatewayReference: string;
  qrCode: string | null;
  copyPasteCode: string | null;
  status: PaymentStatus;
  expiresAt: string;
  paidAt: string | null;
  refundedAt: string | null;
}

export interface OrderItemSnapshot {
  id: string;
  ingredientId: string;
  ingredientNameSnapshot: string;
  pricePerKgSnapshot: number;
  weightKg: number;
  subtotal: number;
}

export interface OrderCakeLayer {
  id: string;
  floorNumber: number;
  doughIngredientId: string;
  coverageIngredientId: string;
  estimatedWeightKg: number;
  fillingIngredientIds: string[];
}

export interface OrderCakeConfiguration {
  id: string;
  format: CakeFormat;
  floorsCount: number;
  colorHex: string;
  dietaryFlags: string[];
  layers: OrderCakeLayer[];
}

export interface CustomerOrder {
  id: string;
  userId: string;
  status: OrderStatus;
  totalPrice: number;
  toppingMessage: string | null;
  riceImageUrl: string | null;
  deliveryAddress: string | null;
  createdAt: string;
  updatedAt: string;
  cakeConfiguration: OrderCakeConfiguration | null;
  items: OrderItemSnapshot[];
  payment: OrderPayment | null;
}

/** RN02: calcula a cotacao volumetrica em tempo real no servidor. */
export async function calculateCakePrice(
  floors: CakeFloorInput[],
): Promise<PriceCalculationResult> {
  return apiRequest<PriceCalculationResult>('/pricing/calculate', {
    method: 'POST',
    body: { floors },
  });
}

/** RF05: envia imagem autentica (PNG/JPEG/WEBP, max 5 MB) para papel de arroz. */
export async function uploadRicePaperImage(file: File): Promise<UploadedRicePaper> {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest<UploadedRicePaper>('/uploads/rice-paper', {
    method: 'POST',
    body: formData,
  });
}

/** UC01: registra o pedido e emite a cobranca PIX Asaas em transacao atomica. */
export async function createOrder(input: CreateOrderInput): Promise<CustomerOrder> {
  return apiRequest<CustomerOrder>('/orders', {
    method: 'POST',
    body: input,
  });
}

/** Lista os pedidos do cliente autenticado em ordem decrescente. */
export async function fetchMyOrders(): Promise<CustomerOrder[]> {
  return apiRequest<CustomerOrder[]>('/orders/my');
}

/** Consulta um pedido especifico (protegido contra IDOR no servidor). */
export async function fetchOrderById(orderId: string): Promise<CustomerOrder> {
  return apiRequest<CustomerOrder>(`/orders/${orderId}`);
}

/** Cancela o pedido (livre enquanto AGUARDANDO_PAGAMENTO; estorno se ADMIN em EM_ESPERA). */
export async function cancelOrder(orderId: string): Promise<CustomerOrder> {
  return apiRequest<CustomerOrder>(`/orders/${orderId}/cancel`, {
    method: 'POST',
  });
}

/** Emite um novo QR Code PIX de 15 minutos quando o anterior expirou. */
export async function regenerateOrderPix(orderId: string): Promise<CustomerOrder> {
  return apiRequest<CustomerOrder>(`/orders/${orderId}/regenerate-pix`, {
    method: 'POST',
  });
}

/**
 * Converte caminhos relativos da API (ex.: `/api/uploads/rice-paper/...`) na
 * URL absoluta da origem da API configurada, preservando `data:` e `http(s):`.
 */
export function resolveApiAssetUrl(assetPath: string): string {
  if (/^(https?:|data:|blob:)/i.test(assetPath)) {
    return assetPath;
  }
  const origin = new URL(getApiBaseUrl()).origin;
  const normalized = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return `${origin}${normalized}`;
}
