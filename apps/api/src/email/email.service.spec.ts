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

  describe('notificacoes de producao, gamificacao e cancelamento (UC02, UC04, Secao 3.2)', () => {
    it('sendOrderReadyEmail notifica o cliente com o codigo curto do pedido e link para /meus-pedidos', async () => {
      await service.sendOrderReadyEmail(
        'mariana@example.com',
        'Mariana <script>',
        '12345678-aaaa-4bbb-8ccc-111111111111',
      );

      expect(senderMock.send).toHaveBeenCalledTimes(1);
      const chamada = senderMock.send.mock.calls[0][0];
      expect(chamada.to).toBe('mariana@example.com');
      expect(chamada.subject).toContain('#12345678');
      expect(chamada.html).toContain('Mariana &lt;script&gt;');
      expect(chamada.html).toContain('http://localhost:3000/meus-pedidos');
    });

    it('sendLevelUpRewardEmail envia selo e recompensa de novo nivel do Clube CakeCraft (UC02)', async () => {
      await service.sendLevelUpRewardEmail('mariana@example.com', 'Mariana', 2, 1150);

      expect(senderMock.send).toHaveBeenCalledTimes(1);
      const chamada = senderMock.send.mock.calls[0][0];
      expect(chamada.to).toBe('mariana@example.com');
      expect(chamada.subject).toContain('Nivel 2');
      expect(chamada.html).toContain('1150 XP');
    });

    it('sendOrderCancelledByBakeryEmail informa cancelamento administrativo e estorno PIX', async () => {
      await service.sendOrderCancelledByBakeryEmail(
        'mariana@example.com',
        'Mariana',
        'abcdef12-0000-4000-8000-000000000000',
      );

      expect(senderMock.send).toHaveBeenCalledTimes(1);
      const chamada = senderMock.send.mock.calls[0][0];
      expect(chamada.to).toBe('mariana@example.com');
      expect(chamada.subject).toContain('#abcdef12');
      expect(chamada.html).toContain('estorno');
    });
  });
});
