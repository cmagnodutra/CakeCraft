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
    return { res: { cookie } as unknown as Response, cookie };
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
});
