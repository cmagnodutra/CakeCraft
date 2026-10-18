import { registerUser } from './auth';
import { apiRequest } from './client';
import { ApiError } from './errors';

jest.mock('./client');

const apiRequestMock = jest.mocked(apiRequest);

const user = {
  id: 'u1',
  name: 'Mariana Silva',
  email: 'mariana@example.com',
  role: 'CLIENTE' as const,
  xp: 0,
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
