import { render, screen } from '@testing-library/react';

import { SiteHeader } from './site-header';

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

  it('nao tem links para rotas que ainda nao existem (nada de botao que nao funciona)', () => {
    render(<SiteHeader />);

    const destinos = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(destinos).toEqual(['#conteudo', '/']);
  });
});
