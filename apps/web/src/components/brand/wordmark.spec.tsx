import { render, screen } from '@testing-library/react';

import { Wordmark } from './wordmark';

describe('Wordmark', () => {
  it('le como o nome da marca, sem espaco entre as duas partes tipograficas', () => {
    render(<Wordmark />);

    expect(screen.getByText('Cake').parentElement).toHaveTextContent(/^Cakecraft$/);
  });

  it('destaca "craft" em italico com a cor de acento (personalidade de atelie)', () => {
    render(<Wordmark />);

    const craft = screen.getByText('craft');
    expect(craft).toHaveClass('italic');
    expect(craft).toHaveClass('text-accent');
  });

  it('usa a serifa dos titulos', () => {
    render(<Wordmark />);

    expect(screen.getByText('Cake').parentElement).toHaveClass('font-serif');
  });
});
