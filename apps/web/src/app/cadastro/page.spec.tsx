import { render, screen } from '@testing-library/react';

import { messages } from '@/content/messages';

import RegisterPage, { metadata } from './page';

describe('RegisterPage (/cadastro)', () => {
  it('mostra o formulario de cadastro com um unico h1', () => {
    render(<RegisterPage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: messages.auth.register.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.auth.register.submit })).toBeInTheDocument();
  });

  it('o titulo da aba e "Criar conta" (o sufixo da marca vem do layout)', () => {
    expect(metadata.title).toBe(messages.auth.register.title);
  });
});
