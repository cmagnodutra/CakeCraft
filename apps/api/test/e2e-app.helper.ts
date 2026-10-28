import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

export interface E2eContext {
  app: INestApplication;
  prisma: PrismaService;
}

/**
 * Sobe a aplicacao NestJS completa conectada ao PostgreSQL 16 real (sem mocks
 * de PrismaService) e aplica `configureApp` para garantir paridade exata com
 * `main.ts` (prefixo `/api`, `cookieParser`, `ValidationPipe` com
 * `forbidNonWhitelisted`, `AllExceptionsFilter`, `ThrottlerGuard` e CORS).
 */
export async function createE2eApp(): Promise<E2eContext> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app, 'http://localhost:3000');
  await app.init();

  const prisma = app.get(PrismaService);
  return { app, prisma };
}

/**
 * Limpa todas as tabelas do schema `e2e_test` em ordem de chave estrangeira e
 * zera os contadores em memoria do ThrottlerStorage para isolamento total
 * entre casos de teste.
 */
export async function resetE2eState(app: INestApplication, prisma: PrismaService): Promise<void> {
  await prisma.$transaction([
    prisma.xpTransaction.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.cakeLayerFilling.deleteMany(),
    prisma.cakeLayer.deleteMany(),
    prisma.cakeConfiguration.deleteMany(),
    prisma.order.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.ingredient.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const throttlerStorage = app.get<ThrottlerStorageService>(ThrottlerStorage);
  throttlerStorage.storage.clear();
}
