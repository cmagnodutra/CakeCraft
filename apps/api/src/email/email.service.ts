import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppEnvironment } from '../config/env.validation';
import { EMAIL_SENDER_PORT, EmailSenderPort } from './email-sender.port';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

  /** UC04: notifica o cliente quando o bolo e marcado como PRONTO no Kanban. */
  async sendOrderReadyEmail(to: string, customerName: string, orderId: string): Promise<void> {
    const frontendUrl = this.config.get('CORS_ORIGIN', { infer: true });
    const shortId = orderId.slice(0, 8);
    const ordersUrl = `${frontendUrl}/meus-pedidos`;

    await this.sender.send({
      to,
      subject: `Seu bolo esta pronto! Pedido #${shortId} - CakeCraft`,
      html: [
        `<p>Ola, ${escapeHtml(customerName)}!</p>`,
        `<p>Seu pedido <strong>#${escapeHtml(shortId)}</strong> acabou de ficar pronto na confeitaria.</p>`,
        `<p><a href="${ordersUrl}">Acompanhe os detalhes da retirada ou entrega na sua conta</a>.</p>`,
      ].join('\n'),
    });
  }

  /** UC02 / RN04: dispara selo e recompensa de fidelidade ao cruzar multiplos de 1000 XP. */
  async sendLevelUpRewardEmail(
    to: string,
    customerName: string,
    newLevel: number,
    totalXp: number,
  ): Promise<void> {
    const frontendUrl = this.config.get('CORS_ORIGIN', { infer: true });
    const profileUrl = `${frontendUrl}/perfil`;

    await this.sender.send({
      to,
      subject: `Parabens! Voce alcancou o Nivel ${newLevel} no Clube CakeCraft`,
      html: [
        `<p>Parabens, ${escapeHtml(customerName)}!</p>`,
        `<p>Voce acumulou <strong>${totalXp} XP</strong> e subiu para o <strong>Nivel ${newLevel}</strong> do Clube CakeCraft.</p>`,
        `<p>Seu novo selo de fidelidade e beneficio de nivel ja estao disponiveis em <a href="${profileUrl}">Minha conta</a>.</p>`,
      ].join('\n'),
    });
  }

  /** Secao 3.2: avisa o cliente quando a confeitaria cancela pedido com estorno automatico. */
  async sendOrderCancelledByBakeryEmail(
    to: string,
    customerName: string,
    orderId: string,
  ): Promise<void> {
    const shortId = orderId.slice(0, 8);

    await this.sender.send({
      to,
      subject: `Pedido #${shortId} cancelado pela confeitaria - CakeCraft`,
      html: [
        `<p>Ola, ${escapeHtml(customerName)}.</p>`,
        `<p>Infelizmente precisamos cancelar o pedido <strong>#${escapeHtml(shortId)}</strong> antes do inicio do preparo.</p>`,
        '<p>Caso o pagamento via PIX ja tenha sido efetuado, o estorno integral foi acionado automaticamente junto ao gateway.</p>',
      ].join('\n'),
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
