import { randomUUID } from 'node:crypto';

import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppEnvironment } from '../config/env.validation';
import { CreatePixChargeInput, PixChargeOutput, PixGatewayPort } from './pix-gateway.port';

interface AsaasCustomerListResponse {
  data?: Array<{ id: string }>;
}

interface AsaasIdResponse {
  id?: string;
}

interface AsaasPixQrCodeResponse {
  encodedImage?: string;
  payload?: string;
}

/**
 * Adaptador HTTP da API v3 do Asaas para emissao e estorno de cobrancas PIX
 * (RF07 / RN03). Em desenvolvimento local sem chave configurada
 * (`ASAAS_API_KEY = sandbox-asaas-local-dev`), gera um QR Code Sandbox
 * deterministico para permitir testar o checkout completo offline.
 */
@Injectable()
export class AsaasPixGateway implements PixGatewayPort {
  private readonly logger = new Logger(AsaasPixGateway.name);

  constructor(private readonly config: ConfigService<AppEnvironment, true>) {}

  async createPixCharge(input: CreatePixChargeInput): Promise<PixChargeOutput> {
    if (this.isLocalSimulation()) {
      return Promise.resolve(this.buildSimulatedPixCharge(input));
    }

    const customerId = await this.resolveOrCreateCustomer(
      input.customerName,
      input.customerEmail,
    );
    const dueDate = input.expiresAt.toISOString().slice(0, 10);

    const payment = await this.asaasRequest<AsaasIdResponse>('/payments', {
      method: 'POST',
      body: {
        customer: customerId,
        billingType: 'PIX',
        value: input.amount,
        dueDate,
        externalReference: input.orderId,
        description: input.description,
      },
    });

    if (!payment.id) {
      throw new BadGatewayException('O gateway PIX nao retornou o identificador da cobranca.');
    }

    const pixQr = await this.asaasRequest<AsaasPixQrCodeResponse>(
      `/payments/${payment.id}/pixQrCode`,
      { method: 'GET' },
    );

    if (!pixQr.encodedImage || !pixQr.payload) {
      throw new BadGatewayException('O gateway PIX nao retornou o QR Code da cobranca.');
    }

    return {
      gatewayProvider: 'ASAAS',
      gatewayReference: payment.id,
      qrCode: `data:image/png;base64,${pixQr.encodedImage}`,
      copyPasteCode: pixQr.payload,
    };
  }

  async refundCharge(gatewayReference: string): Promise<void> {
    if (this.isLocalSimulation() || gatewayReference.startsWith('pay_local_')) {
      this.logger.log(`[DEV PIX] Simulando estorno da cobranca ${gatewayReference}`);
      return;
    }

    await this.asaasRequest(`/payments/${gatewayReference}/refund`, {
      method: 'POST',
      body: {},
    });
  }

  private async resolveOrCreateCustomer(name: string, email: string): Promise<string> {
    const query = encodeURIComponent(email);
    const existing = await this.asaasRequest<AsaasCustomerListResponse>(
      `/customers?email=${query}`,
      { method: 'GET' },
    );

    const foundId = existing.data?.[0]?.id;
    if (foundId) {
      return foundId;
    }

    const cpfCnpj = this.config.get('ASAAS_DEFAULT_CPF_CNPJ', { infer: true });
    const created = await this.asaasRequest<AsaasIdResponse>('/customers', {
      method: 'POST',
      body: { name, email, cpfCnpj },
    });

    if (!created.id) {
      throw new BadGatewayException('Nao foi possivel registrar o cliente no gateway PIX.');
    }

    return created.id;
  }

  private async asaasRequest<T>(
    path: string,
    options: { method: 'GET' | 'POST'; body?: unknown },
  ): Promise<T> {
    const baseUrl = this.config.get('ASAAS_API_URL', { infer: true }).replace(/\/+$/, '');
    const apiKey = this.config.get('ASAAS_API_KEY', { infer: true });

    const headers: Record<string, string> = {
      Accept: 'application/json',
      access_token: apiKey,
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: options.method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      this.logger.error(`Falha de conexao ao comunicar com Asaas em ${options.method} ${path}`);
      throw new BadGatewayException(
        'Servico de pagamento PIX temporariamente indisponivel. Tente novamente em instantes.',
      );
    }

    if (!response.ok) {
      this.logger.warn(`Asaas respondeu HTTP ${response.status} em ${options.method} ${path}`);
      throw new BadGatewayException(
        'Nao foi possivel gerar a cobranca PIX no momento. Tente novamente em instantes.',
      );
    }

    return (await response.json()) as T;
  }

  private isLocalSimulation(): boolean {
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });
    const apiKey = this.config.get('ASAAS_API_KEY', { infer: true });
    return nodeEnv !== 'production' && apiKey === 'sandbox-asaas-local-dev';
  }

  private buildSimulatedPixCharge(input: CreatePixChargeInput): PixChargeOutput {
    const reference = `pay_local_${randomUUID()}`;
    const copyPasteCode =
      `00020126580014br.gov.bcb.pix0136${input.orderId}` +
      `520400005303986540${input.amount.toFixed(2)}5802BR5909CAKECRAFT6009JOINVILLE6304ABCD`;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
      '<rect width="120" height="120" fill="#ffffff"/>' +
      '<rect x="12" y="12" width="32" height="32" fill="#1b1814"/>' +
      '<rect x="18" y="18" width="20" height="20" fill="#ffffff"/>' +
      '<rect x="22" y="22" width="12" height="12" fill="#1b1814"/>' +
      '<rect x="76" y="12" width="32" height="32" fill="#1b1814"/>' +
      '<rect x="82" y="18" width="20" height="20" fill="#ffffff"/>' +
      '<rect x="86" y="22" width="12" height="12" fill="#1b1814"/>' +
      '<rect x="12" y="76" width="32" height="32" fill="#1b1814"/>' +
      '<rect x="18" y="82" width="20" height="20" fill="#ffffff"/>' +
      '<rect x="22" y="86" width="12" height="12" fill="#1b1814"/>' +
      '<rect x="52" y="52" width="16" height="16" fill="#8a5a2b"/>' +
      '</svg>';

    this.logger.log(
      `[DEV PIX] Cobranca Sandbox local emitida ref=${reference} pedido=${input.orderId} valor=R$${input.amount.toFixed(2)}`,
    );

    return {
      gatewayProvider: 'ASAAS',
      gatewayReference: reference,
      qrCode: `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`,
      copyPasteCode,
    };
  }
}
