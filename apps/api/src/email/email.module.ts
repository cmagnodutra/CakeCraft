import { Module } from '@nestjs/common';

import { EMAIL_SENDER_PORT } from './email-sender.port';
import { EmailService } from './email.service';
import { SmtpEmailSender } from './smtp-email-sender';

/**
 * Troca de provedor de e-mail (Brevo -> outro relay SMTP, ou um provedor
 * via API em vez de SMTP) e so trocar o `useClass` abaixo - nenhum
 * modulo que importa EmailModule precisa saber ou mudar.
 */
@Module({
  providers: [{ provide: EMAIL_SENDER_PORT, useClass: SmtpEmailSender }, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
