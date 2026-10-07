import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { createTransport } from 'nodemailer';

import { SmtpEmailSender } from './smtp-email-sender';

jest.mock('nodemailer');

describe('SmtpEmailSender', () => {
  const sendMailMock = jest.fn();
  const createTransportMock = createTransport as jest.Mock;

  const baseConfigValues: Record<string, unknown> = {
    SMTP_HOST: 'smtp-relay.brevo.com',
    SMTP_PORT: 587,
    SMTP_USER: 'usuario-smtp',
    SMTP_PASSWORD: 'chave-smtp',
    SMTP_FROM: 'CakeCraft <no-reply@cakecraft.dev>',
  };

  async function createSender(
    configOverrides: Record<string, unknown> = {},
  ): Promise<SmtpEmailSender> {
    const values = { ...baseConfigValues, ...configOverrides };
    const configMock = { get: jest.fn((key: string) => values[key]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SmtpEmailSender, { provide: ConfigService, useValue: configMock }],
    }).compile();

    return module.get<SmtpEmailSender>(SmtpEmailSender);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    sendMailMock.mockResolvedValue({ messageId: 'fake-id' });
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
  });

  it('configura o transporte com host/porta/credenciais vindos do ConfigService', async () => {
    await createSender();

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp-relay.brevo.com',
        port: 587,
        auth: { user: 'usuario-smtp', pass: 'chave-smtp' },
      }),
    );
  });

  it('usa secure:false para porta 587 (STARTTLS)', async () => {
    await createSender({ SMTP_PORT: 587 });

    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({ secure: false }));
  });

  it('usa secure:true para porta 465 (TLS implicito)', async () => {
    await createSender({ SMTP_PORT: 465 });

    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({ secure: true }));
  });

  it('send() repassa from/to/subject/html para o transporte, sem abrir conexao SMTP real', async () => {
    const sender = await createSender();

    await sender.send({ to: 'mariana@example.com', subject: 'Assunto', html: '<p>Oi</p>' });

    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'CakeCraft <no-reply@cakecraft.dev>',
      to: 'mariana@example.com',
      subject: 'Assunto',
      html: '<p>Oi</p>',
    });
  });
});
