import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Falha no boot se o ambiente estiver incompleto, em vez de acumular
      // undefined espalhado pelo codigo.
      validationSchema: envValidationSchema,
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
