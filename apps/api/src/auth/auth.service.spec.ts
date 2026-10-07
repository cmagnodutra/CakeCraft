import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const jwtMock = {
    signAsync: jest.fn(),
  };

  const configMock = {
    get: jest.fn((_key: string, fallback?: unknown) => fallback),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jwtMock.signAsync.mockResolvedValue('fake-token');
    configMock.get.mockImplementation((_key: string, fallback?: unknown) => fallback);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
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

    it('cadastra com a senha hasheada (nunca em texto puro) e devolve o par de tokens', async () => {
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

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.email).toBe('mariana@example.com');
      expect(result.accessToken).toBe('fake-token');
      expect(result.refreshToken).toBe('fake-token');
    });

    it('usa o BCRYPT_SALT_ROUNDS vindo da configuracao, nao um valor fixo no codigo', async () => {
      configMock.get.mockImplementation((key: string, fallback?: unknown) =>
        key === 'BCRYPT_SALT_ROUNDS' ? 4 : fallback,
      );
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'x', role: 'CLIENTE', xp: 0, level: 1, ...data }),
      );

      await service.register({
        name: 'Mariana',
        email: 'mariana@example.com',
        password: 'senha12345',
      });

      // O custo usado fica embutido no proprio texto do hash bcrypt
      // (formato $2b$<custo>$...), entao da pra confirmar que o valor
      // configurado (4, nao o default de 12) foi de fato repassado.
      const hash = prismaMock.user.create.mock.calls[0][0].data.passwordHash as string;
      expect(hash).toMatch(/^\$2[aby]\$04\$/);
    });

    it('normaliza o e-mail para minusculas antes de checar duplicidade e de persistir - evita cadastro duplicado da mesma pessoa por diferenca de caixa', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'x', role: 'CLIENTE', xp: 0, level: 1, ...data }),
      );

      await service.register({
        name: 'Mariana',
        email: 'Mariana@Example.com',
        password: 'senha12345',
      });

      // Postgres compara email com diferenciacao de maiusculas/minusculas
      // por padrao - sem normalizar, "Mariana@Example.com" e
      // "mariana@example.com" seriam tratados como contas diferentes.
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'mariana@example.com' },
      });
      expect(prismaMock.user.create.mock.calls[0][0].data.email).toBe('mariana@example.com');
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

      // Verifica o argumento exato recebido pelo Prisma - nao so o
      // resultado final. Sem a normalizacao, este teste falha porque o
      // Prisma recebe o e-mail com maiusculas/espacos intactos, e
      // "Mariana@Example.COM" !== "mariana@example.com".
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'mariana@example.com' },
      });
      expect(prismaMock.user.create.mock.calls[0][0].data.email).toBe('mariana@example.com');
    });
  });

  describe('login', () => {
    it('rejeita e-mail inexistente com 401 generico (nao revela qual dado estava errado)', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nao-existe@example.com', password: 'qualquer-coisa' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejeita usuario anonimizado (LGPD) mesmo com a senha correta', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        anonymizedAt: new Date(),
        passwordHash: await bcrypt.hash('senha12345', 4),
      });

      await expect(
        service.login({ email: 'anonimizado@example.com', password: 'senha12345' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejeita senha incorreta', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        anonymizedAt: null,
        passwordHash: await bcrypt.hash('senha-correta', 4),
      });

      await expect(
        service.login({ email: 'mariana@example.com', password: 'senha-errada' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('autentica com sucesso e devolve o usuario publico + par de tokens', async () => {
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

      const result = await service.login({ email: 'mariana@example.com', password: 'senha12345' });

      expect(result.user.email).toBe('mariana@example.com');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.accessToken).toBe('fake-token');
      expect(result.refreshToken).toBe('fake-token');
    });

    it('normaliza o e-mail para minusculas antes de buscar o usuario - mesma conta, caixa diferente, deve autenticar', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Mariana',
        email: 'mariana@example.com',
        role: 'CLIENTE',
        xp: 0,
        level: 1,
        anonymizedAt: null,
        passwordHash: await bcrypt.hash('senha12345', 4),
      });

      await service.login({ email: 'MARIANA@EXAMPLE.COM', password: 'senha12345' });

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'mariana@example.com' },
      });
    });

    it('normaliza o e-mail para minusculas e sem espacos antes de buscar o usuario', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'mariana@example.com',
        anonymizedAt: null,
        passwordHash: await bcrypt.hash('senha12345', 4),
      });

      await service.login({ email: '  Mariana@Example.COM  ', password: 'senha12345' });

      // Mesma verificacao do argumento exato feita em register(): sem a
      // normalizacao, o Prisma recebe "Mariana@Example.COM" com espacos,
      // e este teste falha porque a chamada esperada nunca aconteceu.
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'mariana@example.com' },
      });
    });
  });

  // Estes 3 metodos sao TODOs explicitos: nao ha rota nem chamador ainda
  // (refresh depende de RefreshToken.rotacao, forgotPassword/resetPassword
  // dependem de feature/email, que nao existe nesta branch). Os testes
  // abaixo documentam esse estado de proposito - quando cada metodo for
  // implementado de verdade, o teste correspondente aqui deve ser
  // substituido por casos reais (sucesso/erro), nao apenas apagado.
  describe('metodos ainda nao implementados', () => {
    it('refresh() ainda nao tem rotacao de token implementada', async () => {
      await expect(service.refresh('qualquer-refresh-token')).rejects.toThrow(/TODO/);
    });

    it('forgotPassword() ainda depende de feature/email', async () => {
      await expect(service.forgotPassword('mariana@example.com')).rejects.toThrow(/TODO/);
    });

    it('resetPassword() ainda nao tem validacao de token implementada', async () => {
      await expect(service.resetPassword('token-qualquer', 'nova-senha')).rejects.toThrow(/TODO/);
    });
  });
});
