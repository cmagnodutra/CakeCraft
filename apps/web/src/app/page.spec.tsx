import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

  it('apenas aponta para rotas existentes e funcionais (/cadastro e /builder)', () => {
    render(<HomePage />);

    const destinos = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(destinos).toEqual(['/cadastro', '/builder']);
  });

  it('a pagina nao repete o titulo da marca como h1 (o cabecalho ja traz a marca)', () => {
    render(<HomePage />);

    expect(screen.queryByRole('heading', { level: 1, name: messages.brand.name })).toBeNull();
  });

  it('exibe a vitrine interativa de bolo a direita e permite alternar entre combinacoes', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    expect(
      screen.getByRole('img', {
        name: texts.showcase.figureAriaLabel(
          texts.showcase.presets.rose.label,
          texts.showcase.presets.rose.floors,
        ),
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(texts.showcase.presets.rose.price)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: texts.showcase.presets.pistachio.label }));
    expect(screen.getByText(texts.showcase.presets.pistachio.plaque)).toBeInTheDocument();
    expect(screen.getByText(texts.showcase.presets.pistachio.price)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: texts.showcase.presets.cocoa.label }));
    expect(screen.getByText(texts.showcase.presets.cocoa.plaque)).toBeInTheDocument();
    expect(screen.getByText(texts.showcase.presets.cocoa.price)).toBeInTheDocument();
  });

  it('apresenta as secoes de como funciona em 3 etapas e os diferenciais da confeitaria', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', { level: 2, name: texts.stepsSection.title }),
    ).toBeInTheDocument();
    for (const step of texts.stepsSection.steps) {
      expect(screen.getByRole('heading', { level: 3, name: step.title })).toBeInTheDocument();
    }

    expect(
      screen.getByRole('heading', { level: 2, name: texts.craftSection.title }),
    ).toBeInTheDocument();
    for (const pillar of texts.craftSection.pillars) {
      expect(screen.getByRole('heading', { level: 3, name: pillar.title })).toBeInTheDocument();
    }
  });
});
