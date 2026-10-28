import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { messages } from '@/content/messages';
import { resetPassword } from '@/lib/api/auth';
import { ApiError, NetworkError } from '@/lib/api/errors';

import { ResetPasswordForm } from './reset-password-form';

let currentToken: string | null = 'jwt-reset-valido';

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'token' ? currentToken : null),
  }),
}));

jest.mock('@/lib/api/auth');

const resetPasswordMock = jest.mocked(resetPassword);
const texts = messages.auth.resetPassword;

beforeEach(() => {
  currentToken = 'jwt-reset-valido';
  resetPasswordMock.mockReset();
});

describe('ResetPasswordForm', () => {
  it('quando a URL nao traz ?token, avisa que o link e invalido e aponta para /esqueci-senha', () => {
    currentToken = null;
    render(<ResetPasswordForm />);

    expect(
      screen.getByRole('heading', { level: 1, name: texts.missingTokenTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText(texts.missingTokenBody)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: texts.requestNewLink })).toHaveAttribute(
      'href',
      '/esqueci-senha',
    );
    expect(screen.queryByLabelText(texts.fields.newPassword)).not.toBeInTheDocument();
  });

  it('valida tamanho minimo, teto de 72 bytes UTF-8 e confirmacao identica antes de chamar a API', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText(texts.fields.newPassword), 'curta');
    await user.type(screen.getByLabelText(texts.fields.confirmPassword), 'diferente');
    await user.click(screen.getByRole('button', { name: texts.submit }));

    expect(screen.getByText(texts.validation.newPassword)).toBeInTheDocument();
    expect(screen.getByText(texts.validation.confirmPassword)).toBeInTheDocument();
    expect(resetPasswordMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(texts.fields.newPassword), {
      target: { value: 'a'.repeat(73) },
    });
    fireEvent.change(screen.getByLabelText(texts.fields.confirmPassword), {
      target: { value: 'a'.repeat(73) },
    });
    await user.click(screen.getByRole('button', { name: texts.submit }));

    expect(screen.getByText(texts.validation.newPasswordMax)).toBeInTheDocument();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it('envia token e newPassword, exibe confirmacao com foco no h1 e link para /entrar', async () => {
    const user = userEvent.setup();
    resetPasswordMock.mockResolvedValue(undefined);
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText(texts.fields.newPassword), 'NovaSenhaForte123!');
    await user.type(screen.getByLabelText(texts.fields.confirmPassword), 'NovaSenhaForte123!');
    await user.click(screen.getByRole('button', { name: texts.submit }));

    const heading = await screen.findByRole('heading', { level: 1, name: texts.success.title });
    expect(resetPasswordMock).toHaveBeenCalledWith({
      token: 'jwt-reset-valido',
      newPassword: 'NovaSenhaForte123!',
    });
    expect(screen.getByRole('status')).toHaveTextContent(texts.success.message);
    expect(screen.getByRole('link', { name: texts.success.goToLogin })).toHaveAttribute(
      'href',
      '/entrar',
    );
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it.each([
    [new ApiError(400, ['Token expirado']), texts.errors.invalidOrExpiredToken],
    [new ApiError(429, ['Too Many Requests']), texts.errors.tooManyRequests],
    [new ApiError(500, ['Internal Server Error']), texts.errors.server],
    [new NetworkError(), texts.errors.network],
    [new Error('boom'), texts.errors.unexpected],
  ])('traduz erro de redefinicao para mensagem em pt-BR (%#)', async (err, expected) => {
    const user = userEvent.setup();
    resetPasswordMock.mockRejectedValueOnce(err);
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText(texts.fields.newPassword), 'NovaSenhaForte123!');
    await user.type(screen.getByLabelText(texts.fields.confirmPassword), 'NovaSenhaForte123!');
    await user.click(screen.getByRole('button', { name: texts.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
  });
});
