import { render, screen } from '@testing-library/react';

import { messages } from '@/content/messages';

import HomePage from './page';

const texts = messages.landing;

describe('HomePage (landing)', () => {
  it('tem um unico h1 com a promessa do produto', () => {
    render(<HomePage />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(`${texts.titleStart} ${texts.titleAccent}`);
  });

  it('destaca a segunda parte do titulo em italico (assinatura tipografica do design)', () => {
    render(<HomePage />);

    expect(screen.getByText(texts.titleAccent)).toHaveClass('italic');
  });

  it('as duas partes do titulo ficam em linhas proprias, nunca misturadas (a oracao e o fecho em italico)', () => {
    render(<HomePage />);

    expect(screen.getByText(texts.titleStart)).toHaveClass('block');
    expect(screen.getByText(texts.titleAccent)).toHaveClass('block');
  });

  it('explica o valor do produto em uma frase', () => {
    render(<HomePage />);

    expect(screen.getByText(texts.body)).toBeInTheDocument();
  });

  it('o botao principal leva ao cadastro, e tem a aparencia do CTA (preto solido, negrito)', () => {
    render(<HomePage />);

    const cta = screen.getByRole('link', { name: texts.cta });
    expect(cta).toHaveAttribute('href', '/cadastro');
    expect(cta).toHaveClass('bg-ink', 'text-on-ink', 'font-bold');
  });

  it('nao tem nenhum link alem do botao de cadastro (nada leva a rota que nao existe)', () => {
    render(<HomePage />);

    const destinos = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(destinos).toEqual(['/cadastro']);
  });

  it('a pagina nao repete o titulo da marca como h1 (o cabecalho ja traz a marca)', () => {
    render(<HomePage />);

    expect(screen.queryByRole('heading', { level: 1, name: messages.brand.name })).toBeNull();
  });
});
