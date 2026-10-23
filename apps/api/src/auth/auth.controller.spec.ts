import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';

import { AuthController } from './auth.controller';
import { AuthService, PublicUser } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    register: jest.fn(),
    login: jest.fn(),
    me: jest.fn(),
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

  /**
   * Devolve o objeto Response falso e, separado, o jest.fn() de cookie: assim
   * as assercoes usam o mock direto, sem acessar o metodo pelo Response.
   */
  const makeResMock = () => {
    const cookie = jest.fn();
    const clearCookie = jest.fn();
    return { res: { cookie, clearCookie } as unknown as Response, cookie, clearCookie };
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
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
    it.each([
      ['development', false],
      ['production', true],
    ])('em %s limpa os dois cookies de autenticacao', (nodeEnv, secure) => {
      configMock.get.mockReturnValue(nodeEnv);
      const { res, clearCookie } = makeResMock();

      controller.logout(res);

      expect(clearCookie).toHaveBeenCalledTimes(2);
      expect(clearCookie).toHaveBeenCalledWith('access_token', {
        httpOnly: true,
        sameSite: 'lax',
        secure,
      });
      expect(clearCookie).toHaveBeenCalledWith('refresh_token', {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/api/auth/refresh',
      });
    });

    it.each(['development', 'production'])(
      'em %s usa EXATAMENTE os mesmos atributos do login: o navegador so apaga o cookie se path e flags baterem',
      async (nodeEnv) => {
        configMock.get.mockReturnValue(nodeEnv);
        authServiceMock.login.mockResolvedValue({
          user: publicUser,
          accessToken: 'a',
          refreshToken: 'r',
        });
        const { res, cookie, clearCookie } = makeResMock();

        await controller.login({ email: 'mariana@example.com', password: 'senha12345' }, res);
        controller.logout(res);

        for (const name of ['access_token', 'refresh_token']) {
          const setOptions = cookie.mock.calls.find((call) => call[0] === name)?.[2];
          const clearOptions = clearCookie.mock.calls.find((call) => call[0] === name)?.[1];
          expect(clearOptions).toEqual(setOptions);
        }
      },
    );
  });
});
