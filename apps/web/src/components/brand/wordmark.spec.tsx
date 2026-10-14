import { render, screen } from '@testing-library/react';

import { messages } from '@/content/messages';

import { Wordmark } from './wordmark';

describe('Wordmark', () => {
  it('le como o nome da marca, sem espaco entre as duas partes tipograficas', () => {
    render(<Wordmark />);

    expect(screen.getByText('Cake').parentElement).toHaveTextContent(/^CakeCraft$/);
  });

  it('e sempre o mesmo nome definido em messages.brand.name (nunca divergem)', () => {
    render(<Wordmark />);

    expect(screen.getByText('Cake').parentElement).toHaveTextContent(messages.brand.name);
  });

  it('destaca "Craft" em italico com a cor de acento (personalidade de atelie)', () => {
    render(<Wordmark />);

    const craft = screen.getByText('Craft');
    expect(craft).toHaveClass('italic');
    expect(craft).toHaveClass('text-accent');
  });

  it('usa a serifa dos titulos', () => {
    render(<Wordmark />);

    expect(screen.getByText('Cake').parentElement).toHaveClass('font-serif');
  });
});
