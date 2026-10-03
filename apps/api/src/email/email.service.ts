import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppEnvironment } from '../config/env.validation';
import { EMAIL_SENDER_PORT, EmailSenderPort } from './email-sender.port';

/**
 * Servico de alto nivel: monta o conteudo de cada tipo de e-mail
 * transacional e delega o envio para EmailSenderPort. Nao conhece
 * nodemailer, SMTP, nem qual provedor esta por tras - essa decisao fica
 * inteiramente na implementacao concreta da porta (ver smtp-email-sender.ts).
 */
@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_SENDER_PORT) private readonly sender: EmailSenderPort,
    private readonly config: ConfigService<AppEnvironment, true>,
  ) {}

  /**
   * UC03 (fluxo de recuperacao de senha) - RF01.
   *
   * CORS_ORIGIN ja representa a origem do frontend (reaproveitado aqui em
   * vez de criar uma variavel de ambiente nova so para isso - a mesma URL
   * serve para os dois propositos).
   */
  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const frontendUrl = this.config.get('CORS_ORIGIN', { infer: true });
    const resetUrl = `${frontendUrl}/resetar-senha?token=${encodeURIComponent(resetToken)}`;

    await this.sender.send({
      to,
      subject: 'Recuperacao de senha - CakeCraft',
      html: this.buildPasswordResetHtml(resetUrl),
    });
  }

  private buildPasswordResetHtml(resetUrl: string): string {
    return [
      '<p>Voce pediu para redefinir sua senha no CakeCraft.</p>',
      `<p><a href="${resetUrl}">Clique aqui para escolher uma nova senha</a>.</p>`,
      '<p>Se voce nao pediu isso, pode ignorar este e-mail com seguranca.</p>',
    ].join('\n');
  }
}
