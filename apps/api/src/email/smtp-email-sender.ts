import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

import { AppEnvironment } from '../config/env.validation';
import { EmailSenderPort, SendEmailInput } from './email-sender.port';

/**
 * Implementacao concreta de EmailSenderPort via relay SMTP (Brevo em
 * producao - 300 e-mails/dia gratis, sem cartao de credito; qualquer
 * outro relay SMTP padrao funciona igual, e so trocar as variaveis de
 * ambiente). Esta e a UNICA classe do modulo que conhece nodemailer -
 * EmailService e quem consome EmailService nunca importam este arquivo
 * diretamente, so a porta (ver email.module.ts).
 */
@Injectable()
export class SmtpEmailSender implements EmailSenderPort {
  private readonly transporter: Transporter;

  private readonly fromAddress: string;

  constructor(config: ConfigService<AppEnvironment, true>) {
    const port = config.get('SMTP_PORT', { infer: true });

    this.transporter = createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port,
      // Porta 465 usa TLS implicito (secure:true); 587/outras usam STARTTLS
      // (secure:false, o upgrade pra TLS acontece depois do handshake).
      secure: port === 465,
      auth: {
        user: config.get('SMTP_USER', { infer: true }),
        pass: config.get('SMTP_PASSWORD', { infer: true }),
      },
    });

    this.fromAddress = config.get('SMTP_FROM', { infer: true });
  }

  async send(input: SendEmailInput): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
  }
}
