import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { messages } from '@/content/messages';
import { AuthProvider } from '@/features/auth/auth-provider';
import { fetchCurrentUser, logoutUser } from '@/lib/api/auth';

import { SiteHeader } from './site-header';

jest.mock('@/lib/api/auth');

const fetchCurrentUserMock = jest.mocked(fetchCurrentUser);
const logoutUserMock = jest.mocked(logoutUser);

beforeEach(() => {
  fetchCurrentUserMock.mockReset();
  logoutUserMock.mockReset();
});

describe('SiteHeader', () => {
  it('a marca e um link para a pagina inicial', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'CakeCraft' })).toHaveAttribute('href', '/');
  });

  it('tem um link para pular direto ao conteudo (teclado e leitor de tela, WCAG 2.4.1)', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute(
      'href',
      '#conteudo',
    );
  });

  it('o link de pular e o primeiro elemento focavel da pagina', () => {
    render(<SiteHeader />);

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAccessibleName('Pular para o conteúdo');
  });

  it('visitante deslogado ve apenas links para rotas existentes (/entrar e /cadastro)', () => {
    render(<SiteHeader />);

    const destinos = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(destinos).toEqual(['#conteudo', '/', '/entrar', '/cadastro']);
  });

  it('usuario autenticado ve link para /perfil e botao Sair que encerra a sessao', async () => {
    fetchCurrentUserMock.mockResolvedValue({
      id: 'u1',
      name: 'Mariana Silva',
      email: 'mariana@example.com',
      role: 'CLIENTE',
      xp: 0,
      level: 1,
    });
    logoutUserMock.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <SiteHeader />
      </AuthProvider>,
    );

    const profileLink = await screen.findByRole('link', { name: messages.nav.profile });
    expect(profileLink).toHaveAttribute('href', '/perfil');
    expect(screen.queryByRole('link', { name: messages.nav.login })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: messages.nav.adminCatalog }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.nav.logout }));

    await waitFor(() =>
      expect(screen.getByRole('link', { name: messages.nav.login })).toBeInTheDocument(),
    );
    expect(logoutUserMock).toHaveBeenCalledTimes(1);
  });

  it('administrador autenticado ve tambem o atalho para /admin/catalogo (UC05)', async () => {
    fetchCurrentUserMock.mockResolvedValue({
      id: 'admin-1',
      name: 'Juliana Admin',
      email: 'admin@cakecraft.com.br',
      role: 'ADMIN',
      xp: 0,
      level: 1,
    });

    render(
      <AuthProvider>
        <SiteHeader />
      </AuthProvider>,
    );

    const adminLink = await screen.findByRole('link', { name: messages.nav.adminCatalog });
    expect(adminLink).toHaveAttribute('href', '/admin/catalogo');
  });
});
