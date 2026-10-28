import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { messages } from '@/content/messages';
import { requestPasswordReset } from '@/lib/api/auth';
import { ApiError, NetworkError } from '@/lib/api/errors';

import { ForgotPasswordForm } from './forgot-password-form';

jest.mock('@/lib/api/auth');

const requestPasswordResetMock = jest.mocked(requestPasswordReset);
const texts = messages.auth.forgotPassword;

beforeEach(() => requestPasswordResetMock.mockReset());

describe('ForgotPasswordForm', () => {
  it('renderiza titulo h1, campo de e-mail e link para voltar ao login', () => {
    render(<ForgotPasswordForm />);

    expect(screen.getByRole('heading', { level: 1, name: texts.title })).toBeInTheDocument();
    expect(screen.getByLabelText(texts.fields.email)).toHaveAttribute('type', 'email');
    expect(screen.getByRole('link', { name: texts.backToLogin })).toHaveAttribute(
      'href',
      '/entrar',
    );
  });

  it('valida o formato do e-mail antes de chamar a API', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(texts.fields.email), 'invalido');
    await user.click(screen.getByRole('button', { name: texts.submit }));

    expect(screen.getByText(texts.validation.email)).toBeInTheDocument();
    expect(screen.getByLabelText(texts.fields.email)).toHaveFocus();
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it('envia o e-mail aparado, exibe confirmacao neutra anti-enumeracao e transfere foco para o h1', async () => {
    const user = userEvent.setup();
    requestPasswordResetMock.mockResolvedValue(undefined);
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(texts.fields.email), '  mariana@example.com ');
    await user.click(screen.getByRole('button', { name: texts.submit }));

    const heading = await screen.findByRole('heading', { level: 1, name: texts.success.title });
    expect(requestPasswordResetMock).toHaveBeenCalledWith('mariana@example.com');
    expect(screen.getByRole('status')).toHaveTextContent(
      texts.success.message('mariana@example.com'),
    );
    expect(screen.getByRole('link', { name: texts.success.backToLogin })).toHaveAttribute(
      'href',
      '/entrar',
    );
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it.each([
    [new ApiError(400, ['Bad Request']), texts.errors.invalidData],
    [new ApiError(429, ['Too Many Requests']), texts.errors.tooManyRequests],
    [new ApiError(503, ['Unavailable']), texts.errors.server],
    [new NetworkError(), texts.errors.network],
    [new Error('boom'), texts.errors.unexpected],
  ])('exibe alerta em pt-BR quando o pedido de recuperacao falha (%#)', async (err, expected) => {
    const user = userEvent.setup();
    requestPasswordResetMock.mockRejectedValueOnce(err);
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(texts.fields.email), 'mariana@example.com');
    await user.click(screen.getByRole('button', { name: texts.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
  });
});
