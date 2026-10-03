import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { envValidationSchema } from './config/env.validation';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Falha no boot se o ambiente estiver incompleto, em vez de acumular
      // undefined espalhado pelo codigo.
      validationSchema: envValidationSchema,
    }),
    HealthModule,
    EmailModule,
  ],
})
export class AppModule {}
