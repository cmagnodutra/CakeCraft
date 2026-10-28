import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { HealthService, LivenessStatus } from './health.service';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Verificacao de vida do processo: responde 200 enquanto a aplicacao
   * estiver de pe e capaz de atender requisicoes HTTP.
   */
  @Get()
  getLiveness(): LivenessStatus {
    return this.healthService.getLiveness();
  }
}
