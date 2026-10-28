import {
  anonymizeMyAccount,
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from './auth';
import { apiRequest } from './client';
import { ApiError, NetworkError } from './errors';

jest.mock('./client');

const apiRequestMock = jest.mocked(apiRequest);

const user = {
  id: 'u1',
  name: 'Mariana Silva',
  email: 'mariana@example.com',
  role: 'CLIENTE' as const,
  xp: 250,
  level: 1,
};

beforeEach(() => apiRequestMock.mockReset());

describe('registerUser', () => {
  it('faz POST em /auth/register com os dados e devolve o usuario (sem os tokens, que vao no cookie)', async () => {
    apiRequestMock.mockResolvedValue({ user });

    const result = await registerUser({
      name: 'Mariana Silva',
      email: 'mariana@example.com',
      password: 'senha12345',
    });

    expect(apiRequestMock).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: { name: 'Mariana Silva', email: 'mariana@example.com', password: 'senha12345' },
    });
    expect(result).toEqual(user);
  });

  it('repassa o telefone quando informado', async () => {
    apiRequestMock.mockResolvedValue({ user });

    await registerUser({
      name: 'Mariana',
      email: 'm@e.com',
      password: 'senha12345',
      phone: '47999999999',
    });

    expect(apiRequestMock.mock.calls[0][1]).toMatchObject({ body: { phone: '47999999999' } });
  });

  it('deixa o erro da API subir intacto para a tela decidir o texto', async () => {
    const conflict = new ApiError(409, ['Ja existe uma conta com este e-mail.']);
    apiRequestMock.mockRejectedValue(conflict);

    await expect(
      registerUser({ name: 'Mariana', email: 'm@e.com', password: 'senha12345' }),
    ).rejects.toBe(conflict);
  });
});

describe('loginUser', () => {
  it('faz POST em /auth/login com email e password e devolve o usuario', async () => {
    apiRequestMock.mockResolvedValue({ user });

    const result = await loginUser({
      email: 'mariana@example.com',
      password: 'senha12345',
    });

    expect(apiRequestMock).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { email: 'mariana@example.com', password: 'senha12345' },
    });
    expect(result).toEqual(user);
  });
});

describe('fetchCurrentUser', () => {
  it('devolve o usuario autenticado quando GET /auth/me responde 200', async () => {
    apiRequestMock.mockResolvedValue({ user });

    await expect(fetchCurrentUser()).resolves.toEqual(user);
    expect(apiRequestMock).toHaveBeenCalledWith('/auth/me');
  });

  it('devolve null quando GET /auth/me responde 401 (visitante sem sessao)', async () => {
    apiRequestMock.mockRejectedValue(new ApiError(401, ['Unauthorized']));

    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  it('propaga falhas de rede ou erro 5xx para quem chamou decidir', async () => {
    const networkError = new NetworkError();
    apiRequestMock.mockRejectedValue(networkError);

    await expect(fetchCurrentUser()).rejects.toBe(networkError);
  });
});

describe('logoutUser', () => {
  it('faz POST em /auth/logout sem corpo', async () => {
    apiRequestMock.mockResolvedValue(undefined);

    await expect(logoutUser()).resolves.toBeUndefined();
    expect(apiRequestMock).toHaveBeenCalledWith('/auth/logout', { method: 'POST' });
  });
});

describe('requestPasswordReset', () => {
  it('faz POST em /auth/forgot-password com o e-mail', async () => {
    apiRequestMock.mockResolvedValue({ message: 'ok' });

    await expect(requestPasswordReset('mariana@example.com')).resolves.toBeUndefined();
    expect(apiRequestMock).toHaveBeenCalledWith('/auth/forgot-password', {
      method: 'POST',
      body: { email: 'mariana@example.com' },
    });
  });
});

describe('resetPassword', () => {
  it('faz POST em /auth/reset-password com token e newPassword', async () => {
    apiRequestMock.mockResolvedValue(undefined);

    await expect(
      resetPassword({ token: 'jwt-token', newPassword: 'NovaSenha123!' }),
    ).resolves.toBeUndefined();
    expect(apiRequestMock).toHaveBeenCalledWith('/auth/reset-password', {
      method: 'POST',
      body: { token: 'jwt-token', newPassword: 'NovaSenha123!' },
    });
  });
});

describe('anonymizeMyAccount', () => {
  it('faz DELETE em /usuarios/me/anonymize conforme Secao 6.1 do RFC (LGPD)', async () => {
    apiRequestMock.mockResolvedValue(undefined);

    await expect(anonymizeMyAccount()).resolves.toBeUndefined();
    expect(apiRequestMock).toHaveBeenCalledWith('/usuarios/me/anonymize', {
      method: 'DELETE',
    });
  });
});
