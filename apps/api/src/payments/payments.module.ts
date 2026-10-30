import { Module } from '@nestjs/common';

import { AsaasPixGateway } from './asaas-pix.gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PIX_GATEWAY_PORT } from './pix-gateway.port';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PIX_GATEWAY_PORT,
      useClass: AsaasPixGateway,
    },
  ],
  exports: [PaymentsService, PIX_GATEWAY_PORT],
})
export class PaymentsModule {}
