import { render, screen } from '@testing-library/react';

import { messages } from '@/content/messages';

import ProfilePage, { metadata } from './page';

describe('ProfilePage (/perfil)', () => {
  it('renderiza a visao da conta com um unico h1', () => {
    render(<ProfilePage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('define o titulo da aba como "Minha conta" e nao indexa area privada', () => {
    expect(metadata.title).toBe(messages.profile.title);
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
