import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * @Global() porque praticamente todo modulo de dominio (pricing, catalog,
 * orders, ...) precisa de acesso ao banco - reimportar PrismaModule em cada
 * um deles seria repeticao sem beneficio real.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
