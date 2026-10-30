export const PIX_GATEWAY_PORT = Symbol('PIX_GATEWAY_PORT');

export interface CreatePixChargeInput {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  description: string;
  expiresAt: Date;
}

export interface PixChargeOutput {
  gatewayProvider: 'ASAAS';
  gatewayReference: string;
  qrCode: string;
  copyPasteCode: string;
}

export interface PixGatewayPort {
  createPixCharge(input: CreatePixChargeInput): Promise<PixChargeOutput>;
  refundCharge(gatewayReference: string): Promise<void>;
}
