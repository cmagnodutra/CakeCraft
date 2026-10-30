import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppEnvironment } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<AppEnvironment, true>);

  // Em producao a API fica atras do Caddy (um unico salto de proxy). Sem isso,
  // req.ip seria sempre o IP do proxy e o ThrottlerGuard (RNF05) aplicaria o
  // limite de 10 logins/min ao site inteiro, e nao a cada cliente.
  if (config.get('NODE_ENV', { infer: true }) === 'production') {
    app.set('trust proxy', 1);
  }

  configureApp(app, config.get('CORS_ORIGIN', { infer: true }));

  // Permite que o Nest execute onModuleDestroy/onApplicationShutdown ao
  // receber SIGTERM, que e o sinal enviado por "docker stop".
  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
