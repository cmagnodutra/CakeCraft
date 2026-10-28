import { render, screen } from '@testing-library/react';

import { messages } from '@/content/messages';

import ResetPasswordPage, { metadata } from './page';

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'token' ? 'token-de-teste' : null),
  }),
}));

describe('ResetPasswordPage (/resetar-senha)', () => {
  it('renderiza ResetPasswordForm dentro de Suspense com um unico h1', () => {
    render(<ResetPasswordPage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: messages.auth.resetPassword.title }),
    ).toBeInTheDocument();
  });

  it('define titulo da aba e bloqueia indexacao por motores de busca (link sensivel)', () => {
    expect(metadata.title).toBe(messages.auth.resetPassword.title);
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
