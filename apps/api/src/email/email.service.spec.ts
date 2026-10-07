import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { EMAIL_SENDER_PORT } from './email-sender.port';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;

  const senderMock = {
    send: jest.fn(),
  };

  const configMock = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    senderMock.send.mockResolvedValue(undefined);
    configMock.get.mockReturnValue('http://localhost:3000');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: EMAIL_SENDER_PORT, useValue: senderMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  describe('sendPasswordResetEmail', () => {
    it('delega para a porta com o destinatario e um assunto claro', async () => {
      await service.sendPasswordResetEmail('mariana@example.com', 'token-abc');

      expect(senderMock.send).toHaveBeenCalledTimes(1);
      const chamada = senderMock.send.mock.calls[0][0];
      expect(chamada.to).toBe('mariana@example.com');
      expect(chamada.subject).toMatch(/recupera.{0,3}o de senha/i);
    });

    it('monta o link de reset com a origem do frontend (CORS_ORIGIN) e o token', async () => {
      configMock.get.mockReturnValue('https://cakecraft.example.com');

      await service.sendPasswordResetEmail('mariana@example.com', 'token-abc');

      const chamada = senderMock.send.mock.calls[0][0];
      expect(chamada.html).toContain('https://cakecraft.example.com/resetar-senha?token=token-abc');
    });

    it('escapa o token na URL (encodeURIComponent) para nao quebrar a querystring', async () => {
      await service.sendPasswordResetEmail(
        'mariana@example.com',
        'token com espaco&caracteres=especiais',
      );

      const chamada = senderMock.send.mock.calls[0][0];
      expect(chamada.html).toContain(encodeURIComponent('token com espaco&caracteres=especiais'));
      expect(chamada.html).not.toContain('token com espaco&caracteres=especiais"');
    });

    it('nunca envia e-mail de verdade - a porta e sempre um fake/mock neste arquivo', async () => {
      await service.sendPasswordResetEmail('mariana@example.com', 'token-abc');

      // Confirma que quem "enviou" foi o mock, nao uma implementacao real
      // de SMTP - a garantia de que a suite Jest nunca dispara e-mail de
      // verdade vem de nunca instanciar SmtpEmailSender aqui.
      expect(senderMock.send).toHaveBeenCalled();
    });
  });
});
