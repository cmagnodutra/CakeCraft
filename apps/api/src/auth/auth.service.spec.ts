import { createHash, createHmac } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const ACCESS_SECRET = 'segredo-acesso-unitario-com-16-chars';
const REFRESH_SECRET = 'segredo-refresh-unitario-com-16-chars';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('AuthService', () => {
  let service: AuthService;
  let realJwt: JwtService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    order: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const emailServiceMock = {
    sendPasswordResetEmail: jest.fn(),
  };

  const configValues: Record<string, unknown> = {
    JWT_ACCESS_SECRET: ACCESS_SECRET,
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_SECRET: REFRESH_SECRET,
    JWT_REFRESH_EXPIRES_IN: '7d',
    BCRYPT_SALT_ROUNDS: 4,
  };

  const configMock = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key in configValues ? configValues[key] : fallback,
    ),
    getOrThrow: jest.fn((key: string) => {
      if (!(key in configValues)) {
        throw new Error(`Missing config ${key}`);
      }
      return configValues[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    realJwt = new JwtService();
    prismaMock.refreshToken.create.mockResolvedValue({ id: 'rt-created' });
    prismaMock.refreshToken.update.mockResolvedValue({ id: 'rt-updated' });
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.$transaction.mockImplementation((ops: Array<Promise<unknown>>) => Promise.all(ops));
    emailServiceMock.sendPasswordResetEmail.mockResolvedValue(undefined);

    configMock.get.mockImplementation((key: string, fallback?: unknown) =>
      key in configValues ? configValues[key] : fallback,
    );
    configMock.getOrThrow.mockImplementation((key: string) => configValues[key]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: realJwt },
        { provide: ConfigService, useValue: configMock },
        { provide: EmailService, useValue: emailServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('rejeita cadastro com e-mail ja existente', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });

      await expect(
        service.register({ name: 'Mariana', email: 'mariana@example.com', password: 'senha12345' }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('cadastra com senha hasheada, persiste o hash SHA-256 do refresh token e devolve o par de tokens', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'novo-usuario',
          name: data.name,
          email: data.email,
          role: 'CLIENTE',
          xp: 0,
          level: 1,
          passwordHash: data.passwordHash,
        }),
      );

      const result = await service.register({
        name: 'Mariana',
        email: 'mariana@example.com',
        password: 'senha12345',
      });

      const dadosCriados = prismaMock.user.create.mock.calls[0][0].data;
      expect(dadosCriados.passwordHash).not.toBe('senha12345');
      expect(await bcrypt.compare('senha12345', dadosCriados.passwordHash)).toBe(true);

      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'novo-usuario',
          tokenHash: sha256(result.refreshToken),
          expiresAt: expect.any(Date),
        },
      });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.email).toBe('mariana@example.com');
    });

    it('normaliza o e-mail para minusculas e sem espacos antes de checar duplicidade e persistir', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'x', role: 'CLIENTE', xp: 0, level: 1, ...data }),
      );

      await service.register({
        name: 'Mariana',
        email: '  Mariana@Example.COM  ',
        password: 'senha12345',
      });

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'mariana@example.com' },
      });
      expect(prismaMock.user.create.mock.calls[0][0].data.email).toBe('mariana@example.com');
    });
  });

  describe('login', () => {
    it('rejeita e-mail inexistente ou usuario anonimizado com 401 generico', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'nao-existe@example.com', password: 'qualquer-coisa' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        anonymizedAt: new Date(),
        passwordHash: await bcrypt.hash('senha12345', 4),
      });

      await expect(
        service.login({ email: 'anonimizado@example.com', password: 'senha12345' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejeita senha incorreta com 401', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        anonymizedAt: null,
        passwordHash: await bcrypt.hash('senha-correta', 4),
      });

      await expect(
        service.login({ email: 'mariana@example.com', password: 'senha-errada' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('autentica com sucesso, persiste refresh token e devolve usuario publico + tokens', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Mariana',
        email: 'mariana@example.com',
        role: 'CLIENTE',
        xp: 100,
        level: 1,
        anonymizedAt: null,
        passwordHash: await bcrypt.hash('senha12345', 4),
      });

      const result = await service.login({
        email: '  MARIANA@EXAMPLE.COM ',
        password: 'senha12345',
      });

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'mariana@example.com' },
      });
      expect(result.user.email).toBe('mariana@example.com');
      expect(prismaMock.refreshToken.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh (rotacao e deteccao de reuso)', () => {
    const activeUser = {
      id: 'user-1',
      name: 'Mariana',
      email: 'mariana@example.com',
      role: 'CLIENTE',
      xp: 50,
      level: 1,
      anonymizedAt: null,
    };

    it('rotaciona um refresh token valido: revoga o atual e emite novo par persistido', async () => {
      const incomingRefresh = await realJwt.signAsync(
        { sub: 'user-1', email: 'mariana@example.com', role: 'CLIENTE', jti: 'jti-1' },
        { secret: REFRESH_SECRET, expiresIn: '7d' },
      );

      prismaMock.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: sha256(incomingRefresh),
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: null,
      });
      prismaMock.user.findUnique.mockResolvedValue(activeUser);

      const rotated = await service.refresh(incomingRefresh);

      expect(prismaMock.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prismaMock.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(rotated.refreshToken).not.toBe(incomingRefresh);
      expect(rotated.user).toEqual({
        id: 'user-1',
        name: 'Mariana',
        email: 'mariana@example.com',
        role: 'CLIENTE',
        xp: 50,
        level: 1,
      });
    });

    it('detecta reuso de refresh token ja revogado, revoga todas as sessoes ativas do usuario e lanca 401', async () => {
      const replayedRefresh = await realJwt.signAsync(
        { sub: 'user-1', email: 'mariana@example.com', role: 'CLIENTE', jti: 'jti-usado' },
        { secret: REFRESH_SECRET, expiresIn: '7d' },
      );

      prismaMock.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-antigo',
        userId: 'user-1',
        tokenHash: sha256(replayedRefresh),
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: new Date(Date.now() - 10_000),
      });

      await expect(service.refresh(replayedRefresh)).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejeita token ausente, adulterado ou de usuario anonimizado com 401', async () => {
      await expect(service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.refresh('token-invalido')).rejects.toBeInstanceOf(UnauthorizedException);

      const validJwt = await realJwt.signAsync(
        { sub: 'user-1', email: 'mariana@example.com', role: 'CLIENTE', jti: 'jti-2' },
        { secret: REFRESH_SECRET, expiresIn: '7d' },
      );
      prismaMock.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-2',
        userId: 'user-1',
        tokenHash: sha256(validJwt),
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: null,
      });
      prismaMock.user.findUnique.mockResolvedValue({ ...activeUser, anonymizedAt: new Date() });

      await expect(service.refresh(validJwt)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('forgotPassword e resetPassword (RF01 / UC03)', () => {
    it('forgotPassword dispara EmailService para conta ativa e ignora silenciosamente e-mail inexistente ou anonimizado', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'mariana@example.com',
        passwordHash: 'hash-atual',
        anonymizedAt: null,
      });

      await service.forgotPassword('  Mariana@Example.com ');

      expect(emailServiceMock.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      expect(emailServiceMock.sendPasswordResetEmail).toHaveBeenCalledWith(
        'mariana@example.com',
        expect.any(String),
      );

      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      await service.forgotPassword('fantasma@example.com');
      expect(emailServiceMock.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('resetPassword troca o hash da senha, revoga refresh tokens e invalida o proprio token contra reuso', async () => {
      const oldHash = await bcrypt.hash('senha-antiga', 4);
      const resetSecret = createHmac('sha256', ACCESS_SECRET)
        .update(`user-1:${oldHash}`)
        .digest('hex');

      const resetToken = await realJwt.signAsync(
        { sub: 'user-1', purpose: 'password-reset' },
        { secret: resetSecret, expiresIn: '30m' },
      );

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'mariana@example.com',
        passwordHash: oldHash,
        anonymizedAt: null,
      });
      prismaMock.user.update.mockResolvedValue({ id: 'user-1' });

      await service.resetPassword(resetToken, 'novaSenhaSegura123');

      expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
      const updatedHash = prismaMock.user.update.mock.calls[0][0].data.passwordHash as string;
      expect(await bcrypt.compare('novaSenhaSegura123', updatedHash)).toBe(true);
      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });

      // Segunda tentativa com o MESMO token falha porque o passwordHash mudou!
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'mariana@example.com',
        passwordHash: updatedHash,
        anonymizedAt: null,
      });

      await expect(service.resetPassword(resetToken, 'outraSenha123')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('resetPassword rejeita token malformado ou com purpose incorreto com 400', async () => {
      await expect(service.resetPassword('nao-e-jwt', 'novaSenha123')).rejects.toBeInstanceOf(
        BadRequestException,
      );

      const accessInsteadOfReset = await realJwt.signAsync(
        { sub: 'user-1', email: 'a@b.com', role: 'CLIENTE' },
        { secret: ACCESS_SECRET, expiresIn: '15m' },
      );

      await expect(
        service.resetPassword(accessInsteadOfReset, 'novaSenha123'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('anonymizeAccount (LGPD - Secao 6.1 do RFC)', () => {
    it('anonimiza dados pessoais, limpa enderecos de entrega e revoga refresh tokens em transacao', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Mariana Silva',
        email: 'mariana@example.com',
        anonymizedAt: null,
      });
      prismaMock.user.update.mockResolvedValue({ id: 'user-1' });

      await service.anonymizeAccount('user-1');

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      const updateCall = prismaMock.user.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: 'user-1' });
      expect(updateCall.data).toMatchObject({
        name: 'Usuario Anonimizado',
        email: 'anonimizado-user-1@anon.cakecraft.local',
        phone: null,
        dietaryRestrictions: [],
        dietaryConsentAt: null,
        anonymizedAt: expect.any(Date),
      });
      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { deliveryAddress: null },
      });
    });
  });

  describe('me', () => {
    const stored = {
      id: 'user-1',
      name: 'Mariana Silva',
      email: 'mariana@example.com',
      phone: '47999999999',
      passwordHash: 'hash-secreto',
      role: 'CLIENTE',
      xp: 120,
      level: 2,
      anonymizedAt: null,
    };

    it('devolve so o usuario publico e rejeita (401) usuario apagado ou anonimizado', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(stored);
      const user = await service.me('user-1');
      expect(user).toEqual({
        id: 'user-1',
        name: 'Mariana Silva',
        email: 'mariana@example.com',
        role: 'CLIENTE',
        xp: 120,
        level: 2,
      });

      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.me('fantasma')).rejects.toBeInstanceOf(UnauthorizedException);

      prismaMock.user.findUnique.mockResolvedValueOnce({ ...stored, anonymizedAt: new Date() });
      await expect(service.me('user-1')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
