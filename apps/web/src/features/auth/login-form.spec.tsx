import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { messages } from '@/content/messages';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { fetchCurrentUser, loginUser } from '@/lib/api/auth';
import { ApiError, NetworkError } from '@/lib/api/errors';

import { LoginForm } from './login-form';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@/lib/api/auth');

const loginUserMock = jest.mocked(loginUser);
const fetchCurrentUserMock = jest.mocked(fetchCurrentUser);
const texts = messages.auth.login;

const loggedInUser = {
  id: 'u1',
  name: 'Mariana Silva',
  email: 'mariana@example.com',
  role: 'CLIENTE' as const,
  xp: 120,
  level: 1,
};

function SessionEmailProbe() {
  const { user } = useAuth();
  return <span data-testid="session-email">{user ? user.email : 'none'}</span>;
}

beforeEach(() => {
  pushMock.mockReset();
  loginUserMock.mockReset();
  fetchCurrentUserMock.mockReset();
  fetchCurrentUserMock.mockResolvedValue(null);
});

describe('LoginForm', () => {
  it('renderiza titulo h1, campos rotulados de e-mail e senha e links para /esqueci-senha e /cadastro', () => {
    render(<LoginForm />);

    expect(screen.getByRole('heading', { level: 1, name: texts.title })).toBeInTheDocument();
    expect(screen.getByLabelText(texts.fields.email)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(texts.fields.password)).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText(texts.fields.password)).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    expect(screen.getByRole('link', { name: texts.forgotPasswordLink })).toHaveAttribute(
      'href',
      '/esqueci-senha',
    );
    expect(screen.getByRole('link', { name: texts.registerLink })).toHaveAttribute(
      'href',
      '/cadastro',
    );
  });

  it('valida e-mail e senha (minimo 8 chars e teto 72 bytes UTF-8) antes de chamar a API e foca o primeiro invalido', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: texts.submit }));

    expect(screen.getByText(texts.validation.email)).toBeInTheDocument();
    expect(screen.getByText(texts.validation.password)).toBeInTheDocument();
    expect(screen.getByLabelText(texts.fields.email)).toHaveFocus();
    expect(loginUserMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(texts.fields.email), 'mariana@example.com');
    fireEvent.change(screen.getByLabelText(texts.fields.password), {
      target: { value: 'a'.repeat(73) },
    });
    await user.click(screen.getByRole('button', { name: texts.submit }));

    expect(screen.getByText(texts.validation.passwordMax)).toBeInTheDocument();
    expect(loginUserMock).not.toHaveBeenCalled();
  });

  it('autentica com e-mail aparado e senha intacta, sincroniza o AuthProvider e navega para /perfil', async () => {
    const user = userEvent.setup();
    loginUserMock.mockResolvedValue(loggedInUser);

    render(
      <AuthProvider>
        <SessionEmailProbe />
        <LoginForm />
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText(texts.fields.email), '  mariana@example.com  ');
    await user.type(screen.getByLabelText(texts.fields.password), 'senha12345');
    await user.click(screen.getByRole('button', { name: texts.submit }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/perfil'));
    expect(loginUserMock).toHaveBeenCalledWith({
      email: 'mariana@example.com',
      password: 'senha12345',
    });
    expect(screen.getByTestId('session-email')).toHaveTextContent('mariana@example.com');
  });

  it('impede envio duplo quando dois submits ocorrem no mesmo instante', async () => {
    let resolveLogin!: (value: typeof loggedInUser) => void;
    loginUserMock.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    const user = userEvent.setup();
    const { container } = render(<LoginForm />);

    await user.type(screen.getByLabelText(texts.fields.email), 'mariana@example.com');
    await user.type(screen.getByLabelText(texts.fields.password), 'senha12345');

    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(loginUserMock).toHaveBeenCalledTimes(1);
    resolveLogin(loggedInUser);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/perfil'));
  });

  it.each([
    [new ApiError(401, ['Unauthorized']), texts.errors.invalidCredentials],
    [new ApiError(400, ['Bad Request']), texts.errors.invalidData],
    [new ApiError(429, ['Too Many Requests']), texts.errors.tooManyRequests],
    [new ApiError(500, ['Internal Server Error']), texts.errors.server],
    [new NetworkError(), texts.errors.network],
    [new Error('boom'), texts.errors.unexpected],
  ])('traduz erro da API/rede para mensagem amigavel em pt-BR (%#)', async (err, expected) => {
    const user = userEvent.setup();
    loginUserMock.mockRejectedValueOnce(err);
    render(<LoginForm />);

    await user.type(screen.getByLabelText(texts.fields.email), 'mariana@example.com');
    await user.type(screen.getByLabelText(texts.fields.password), 'senha12345');
    await user.click(screen.getByRole('button', { name: texts.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
  });
});
