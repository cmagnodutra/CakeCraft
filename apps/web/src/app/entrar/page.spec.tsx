import { render, screen } from '@testing-library/react';

import { messages } from '@/content/messages';

import LoginPage, { metadata } from './page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('LoginPage (/entrar)', () => {
  it('mostra o formulario de login com um unico h1', () => {
    render(<LoginPage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: messages.auth.login.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.auth.login.submit })).toBeInTheDocument();
  });

  it('define o titulo da aba como "Entrar"', () => {
    expect(metadata.title).toBe(messages.auth.login.title);
  });
});
