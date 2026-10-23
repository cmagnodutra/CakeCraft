import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppEnvironment } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<AppEnvironment, true>);

  configureApp(app, config.get('CORS_ORIGIN', { infer: true }));

  // Permite que o Nest execute onModuleDestroy/onApplicationShutdown ao
  // receber SIGTERM, que e o sinal enviado por "docker stop".
  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
