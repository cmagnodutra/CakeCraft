import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  ValidationPipe,
} from '@nestjs/common';

import { AsaasWebhookDto } from './dto/asaas-webhook.dto';
import { PaymentsService, WebhookProcessingResult } from './payments.service';

/**
 * O Asaas envia dezenas de metadados extras no corpo do webhook (`id`,
 * `dateCreated`, `account`, `payment.value`, `payment.billingType`, etc.).
 * Este ValidationPipe dedicado valida estritamente `event` e `payment.id` e
 * descarta campos desconhecidos (`whitelist: true`) sem rejeitar o payload
 * externo (`forbidNonWhitelisted: false`).
 */
const asaasWebhookValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: false,
  transform: true,
  expectedType: AsaasWebhookDto,
});

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Webhook receptor de notificacoes do Asaas (RF07 / RN03).
   * Autenticado pelo cabecalho oficial `asaas-access-token`.
   */
  @Post('webhooks/asaas')
  @HttpCode(HttpStatus.OK)
  handleAsaasWebhook(
    @Headers('asaas-access-token') webhookToken: string | undefined,
    @Body(asaasWebhookValidationPipe) dto: unknown,
  ): Promise<WebhookProcessingResult> {
    return this.paymentsService.processAsaasWebhook(webhookToken, dto as AsaasWebhookDto);
  }
}
