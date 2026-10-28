import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fetchCurrentUser, logoutUser } from '@/lib/api/auth';
import type { AuthUser } from '@/lib/api/auth';
import { NetworkError } from '@/lib/api/errors';

import { AuthProvider, useAuth } from './auth-provider';

jest.mock('@/lib/api/auth');

const fetchCurrentUserMock = jest.mocked(fetchCurrentUser);
const logoutUserMock = jest.mocked(logoutUser);

const mariana: AuthUser = {
  id: 'u1',
  name: 'Mariana Silva',
  email: 'mariana@example.com',
  role: 'CLIENTE',
  xp: 350,
  level: 1,
};

function SessionProbe() {
  const { user, isLoading, setUser, refreshUser, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user ? user.email : 'anon'}</span>
      <button type="button" onClick={() => setUser(mariana)}>
        set-user
      </button>
      <button
        type="button"
        onClick={() => {
          void refreshUser();
        }}
      >
        refresh
      </button>
      <button
        type="button"
        onClick={() => {
          void logout();
        }}
      >
        logout
      </button>
    </div>
  );
}

beforeEach(() => {
  fetchCurrentUserMock.mockReset();
  logoutUserMock.mockReset();
});

describe('AuthProvider e useAuth', () => {
  it('hidrata o usuario em memoria chamando GET /auth/me ao montar e nunca grava em localStorage', async () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    fetchCurrentUserMock.mockResolvedValue(mariana);

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('mariana@example.com');
    expect(fetchCurrentUserMock).toHaveBeenCalledTimes(1);
    expect(setItemSpy).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
  });

  it('quando nao ha sessao (401 -> null) ou a API esta fora do ar, encerra o carregamento como visitante', async () => {
    fetchCurrentUserMock.mockRejectedValueOnce(new NetworkError());

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('anon');
  });

  it('evita condicao de corrida: um login manual (setUser) nao e sobrescrito por um /auth/me antigo que termina depois', async () => {
    let resolveInitialMe!: (value: AuthUser | null) => void;
    fetchCurrentUserMock.mockReturnValueOnce(
      new Promise<AuthUser | null>((resolve) => {
        resolveInitialMe = resolve;
      }),
    );
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'set-user' }));
    expect(screen.getByTestId('user')).toHaveTextContent('mariana@example.com');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');

    act(() => {
      resolveInitialMe(null);
    });

    expect(screen.getByTestId('user')).toHaveTextContent('mariana@example.com');
  });

  it('refreshUser atualiza os dados em memoria (ex.: XP/nivel apos pedido)', async () => {
    fetchCurrentUserMock
      .mockResolvedValueOnce(mariana)
      .mockResolvedValueOnce({ ...mariana, email: 'nova@example.com' });
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('mariana@example.com'));
    await user.click(screen.getByRole('button', { name: 'refresh' }));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('nova@example.com'));
  });

  it('logout limpa o usuario em memoria mesmo se a chamada de rede ao servidor falhar', async () => {
    fetchCurrentUserMock.mockResolvedValue(mariana);
    logoutUserMock.mockRejectedValue(new NetworkError());
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('mariana@example.com'));
    await user.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('anon'));
    expect(logoutUserMock).toHaveBeenCalledTimes(1);
  });

  it('useAuth fora de AuthProvider devolve estado seguro de visitante sem quebrar testes isolados', () => {
    render(<SessionProbe />);

    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('anon');
  });
});
