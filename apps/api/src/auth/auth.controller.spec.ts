import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';

import { AuthCookiesService } from './auth-cookies.service';
import { AuthController } from './auth.controller';
import { AuthService, PublicUser } from './auth.service';
import { UsersController } from './users.controller';

describe('AuthController & UsersController', () => {
  let controller: AuthController;
  let usersController: UsersController;

  const authServiceMock = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    me: jest.fn(),
    revokeSessionsFromAccessToken: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    anonymizeAccount: jest.fn(),
  };

  const configMock = {
    get: jest.fn(),
  };

  const publicUser: PublicUser = {
    id: 'user-1',
    name: 'Mariana',
    email: 'mariana@example.com',
    role: 'CLIENTE',
    xp: 0,
    level: 1,
  };

  const makeResMock = () => {
    const cookie = jest.fn();
    const clearCookie = jest.fn();
    return { res: { cookie, clearCookie } as unknown as Response, cookie, clearCookie };
  };

  const makeReqMock = (cookies: Record<string, unknown> = {}) =>
    ({ cookies }) as unknown as Request;

  beforeEach(async () => {
    jest.clearAllMocks();
    authServiceMock.revokeSessionsFromAccessToken.mockResolvedValue(undefined);
    authServiceMock.forgotPassword.mockResolvedValue(undefined);
    authServiceMock.resetPassword.mockResolvedValue(undefined);
    authServiceMock.anonymizeAccount.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, UsersController],
      providers: [
        AuthCookiesService,
        { provide: AuthService, useValue: authServiceMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    usersController = module.get<UsersController>(UsersController);
  });

  describe('register', () => {
    it('devolve so o usuario no corpo da resposta - nunca os tokens', async () => {
      authServiceMock.register.mockResolvedValue({
        user: publicUser,
        accessToken: 'access-fake',
        refreshToken: 'refresh-fake',
      });
      configMock.get.mockReturnValue('development');

      const result = await controller.register(
        { name: 'Mariana', email: 'mariana@example.com', password: 'senha12345' },
        makeResMock().res,
      );

      expect(result).toEqual({ user: publicUser });
      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');
    });

    it('seta os dois cookies como httpOnly, com o refresh restrito ao path de refresh', async () => {
      authServiceMock.register.mockResolvedValue({
        user: publicUser,
        accessToken: 'access-fake',
        refreshToken: 'refresh-fake',
      });
      configMock.get.mockReturnValue('development');
      const { res, cookie } = makeResMock();

      await controller.register(
        { name: 'Mariana', email: 'mariana@example.com', password: 'senha12345' },
        res,
      );

      expect(cookie).toHaveBeenCalledWith(
        'access_token',
        'access-fake',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax', secure: false }),
      );
      expect(cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-fake',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
          path: '/api/auth/refresh',
        }),
      );
    });

    it('marca os cookies como secure quando NODE_ENV e production', async () => {
      authServiceMock.register.mockResolvedValue({
        user: publicUser,
        accessToken: 'access-fake',
        refreshToken: 'refresh-fake',
      });
      configMock.get.mockReturnValue('production');
      const { res, cookie } = makeResMock();

      await controller.register(
        { name: 'Mariana', email: 'mariana@example.com', password: 'senha12345' },
        res,
      );

      expect(cookie).toHaveBeenCalledWith(
        'access_token',
        'access-fake',
        expect.objectContaining({ secure: true }),
      );
    });
  });

  describe('login', () => {
    it('devolve so o usuario no corpo e seta os dois cookies', async () => {
      authServiceMock.login.mockResolvedValue({
        user: publicUser,
        accessToken: 'access-fake',
        refreshToken: 'refresh-fake',
      });
      configMock.get.mockReturnValue('development');
      const { res, cookie } = makeResMock();

      const result = await controller.login(
        { email: 'mariana@example.com', password: 'senha12345' },
        res,
      );

      expect(result).toEqual({ user: publicUser });
      expect(cookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('refresh', () => {
    it('le refresh_token do cookie, rotaciona no servico e regrava os dois cookies', async () => {
      authServiceMock.refresh.mockResolvedValue({
        user: publicUser,
        accessToken: 'novo-access',
        refreshToken: 'novo-refresh',
      });
      configMock.get.mockReturnValue('development');
      const { res, cookie } = makeResMock();

      const result = await controller.refresh(makeReqMock({ refresh_token: 'antigo-refresh' }), res);

      expect(authServiceMock.refresh).toHaveBeenCalledWith('antigo-refresh');
      expect(cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ user: publicUser });
    });
  });

  describe('me', () => {
    it('devolve o usuario da sessao, buscado pelo id que a JwtStrategy colocou no request', async () => {
      authServiceMock.me.mockResolvedValue(publicUser);

      const result = await controller.me({
        id: 'user-1',
        email: 'mariana@example.com',
        role: 'CLIENTE',
      });

      expect(authServiceMock.me).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ user: publicUser });
    });
  });

  describe('logout', () => {
    it.each(['development', 'production'])(
      'em %s revoga sessoes no servidor e usa EXATAMENTE os mesmos atributos do login ao limpar os cookies',
      async (nodeEnv) => {
        configMock.get.mockReturnValue(nodeEnv);
        authServiceMock.login.mockResolvedValue({
          user: publicUser,
          accessToken: 'a',
          refreshToken: 'r',
        });
        const { res, cookie, clearCookie } = makeResMock();

        await controller.login({ email: 'mariana@example.com', password: 'senha12345' }, res);
        await controller.logout(makeReqMock({ access_token: 'a' }), res);

        expect(authServiceMock.revokeSessionsFromAccessToken).toHaveBeenCalledWith('a');
        for (const name of ['access_token', 'refresh_token']) {
          const setOptions = cookie.mock.calls.find((call) => call[0] === name)?.[2];
          const clearOptions = clearCookie.mock.calls.find((call) => call[0] === name)?.[1];
          expect(clearOptions).toEqual(setOptions);
        }
      },
    );
  });

  describe('forgotPassword e resetPassword', () => {
    it('forgotPassword delega ao AuthService e responde com mensagem neutra anti-enumeracao', async () => {
      const response = await controller.forgotPassword({ email: 'mariana@example.com' });

      expect(authServiceMock.forgotPassword).toHaveBeenCalledWith('mariana@example.com');
      expect(response.message).toMatch(/instrucoes de recuperacao/i);
    });

    it('resetPassword delega token e nova senha ao AuthService', async () => {
      await controller.resetPassword({ token: 'token-de-reset-valido', newPassword: 'novaSenha123' });

      expect(authServiceMock.resetPassword).toHaveBeenCalledWith(
        'token-de-reset-valido',
        'novaSenha123',
      );
    });
  });

  describe('UsersController.anonymizeMe (LGPD)', () => {
    it('anonimiza a conta autenticada e limpa ambos os cookies de sessao', async () => {
      configMock.get.mockReturnValue('development');
      const { res, clearCookie } = makeResMock();

      await usersController.anonymizeMe(
        { id: 'user-1', email: 'mariana@example.com', role: 'CLIENTE' },
        res,
      );

      expect(authServiceMock.anonymizeAccount).toHaveBeenCalledWith('user-1');
      expect(clearCookie).toHaveBeenCalledTimes(2);
    });
  });
});
