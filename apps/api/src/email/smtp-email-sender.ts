import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

import { AppEnvironment } from '../config/env.validation';
import { EmailSenderPort, SendEmailInput } from './email-sender.port';

const DEV_PLACEHOLDER_SMTP_USER = 'seu-usuario-smtp-brevo';

/**
 * Implementacao concreta de EmailSenderPort via relay SMTP (Brevo em
 * producao - 300 e-mails/dia gratis, sem cartao de credito; qualquer
 * outro relay SMTP padrao funciona igual, e so trocar as variaveis de
 * ambiente). Esta e a UNICA classe do modulo que conhece nodemailer.
 */
@Injectable()
export class SmtpEmailSender implements EmailSenderPort {
  private readonly logger = new Logger(SmtpEmailSender.name);

  private readonly transporter: Transporter;

  private readonly fromAddress: string;

  private readonly simulateInDev: boolean;

  constructor(config: ConfigService<AppEnvironment, true>) {
    const port = config.get('SMTP_PORT', { infer: true });
    const smtpUser = config.get('SMTP_USER', { infer: true });
    const nodeEnv = config.get('NODE_ENV', { infer: true });

    this.simulateInDev = nodeEnv !== 'production' && smtpUser === DEV_PLACEHOLDER_SMTP_USER;

    this.transporter = createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port,
      // Porta 465 usa TLS implicito (secure:true); 587/outras usam STARTTLS.
      secure: port === 465,
      auth: {
        user: smtpUser,
        pass: config.get('SMTP_PASSWORD', { infer: true }),
      },
    });

    this.fromAddress = config.get('SMTP_FROM', { infer: true });
  }

  async send(input: SendEmailInput): Promise<void> {
    if (this.simulateInDev) {
      this.logger.log(
        `[DEV SMTP SIMULADO] Para: ${input.to} | Assunto: ${input.subject} | Conteudo: ${input.html}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
  }
}
