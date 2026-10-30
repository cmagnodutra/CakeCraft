import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { AsaasWebhookDto } from './dto/asaas-webhook.dto';
import { PaymentsService, WebhookProcessingResult } from './payments.service';

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
    @Body() dto: AsaasWebhookDto,
  ): Promise<WebhookProcessingResult> {
    return this.paymentsService.processAsaasWebhook(webhookToken, dto);
  }
}
