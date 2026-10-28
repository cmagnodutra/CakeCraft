import { render, screen } from '@testing-library/react';

import { messages } from '@/content/messages';

import ForgotPasswordPage, { metadata } from './page';

describe('ForgotPasswordPage (/esqueci-senha)', () => {
  it('mostra o formulario de recuperacao de senha com um unico h1', () => {
    render(<ForgotPasswordPage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: messages.auth.forgotPassword.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: messages.auth.forgotPassword.submit }),
    ).toBeInTheDocument();
  });

  it('define o titulo da aba como "Recuperar senha"', () => {
    expect(metadata.title).toBe(messages.auth.forgotPassword.title);
  });
});
