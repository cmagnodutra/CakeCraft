export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Porta de envio de e-mail - quem consome (EmailService) depende so desta
 * interface, nunca de nodemailer ou de um provedor especifico diretamente.
 * Troca de provedor (Brevo, Resend, SES etc.) vira so uma nova
 * implementacao desta porta, sem tocar em EmailService nem em quem o usa.
 */
export interface EmailSenderPort {
  send(input: SendEmailInput): Promise<void>;
}

/**
 * Token de injecao: interfaces do TypeScript nao existem em runtime, entao
 * o NestJS precisa de um token concreto (Symbol, aqui) para resolver a
 * injecao de dependencia de EmailSenderPort.
 */
export const EMAIL_SENDER_PORT = Symbol('EMAIL_SENDER_PORT');
