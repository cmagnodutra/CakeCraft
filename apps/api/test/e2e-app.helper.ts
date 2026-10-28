import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { EMAIL_SENDER_PORT, EmailSenderPort, SendEmailInput } from '../src/email/email-sender.port';
import { PrismaService } from '../src/prisma/prisma.service';

export class RecordingEmailSender implements EmailSenderPort {
  readonly sent: SendEmailInput[] = [];

  send(input: SendEmailInput): Promise<void> {
    this.sent.push(input);
    return Promise.resolve();
  }

  clear(): void {
    this.sent.length = 0;
  }
}

export interface E2eContext {
  app: INestApplication;
  prisma: PrismaService;
  emails: RecordingEmailSender;
}

/**
 * Sobe a aplicacao NestJS completa conectada ao PostgreSQL 16 real (sem mocks
 * de PrismaService) e substitui apenas a porta externa SMTP por um gravador
 * em memoria para inspecionar e-mails transacionais sem sair para a internet.
 */
export async function createE2eApp(): Promise<E2eContext> {
  const emails = new RecordingEmailSender();

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(EMAIL_SENDER_PORT)
    .useValue(emails)
    .compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app, 'http://localhost:3000');
  await app.init();

  const prisma = app.get(PrismaService);
  return { app, prisma, emails };
}

/**
 * Limpa todas as tabelas do schema `e2e_test` em ordem de chave estrangeira,
 * zera o ThrottlerStorage e limpa a caixa de e-mails capturados.
 */
export async function resetE2eState(
  app: INestApplication,
  prisma: PrismaService,
  emails?: RecordingEmailSender,
): Promise<void> {
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
  emails?.clear();
}
