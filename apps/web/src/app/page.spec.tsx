import { render, screen } from '@testing-library/react';

import HomePage from './page';

describe('HomePage', () => {
  it('mostra a marca CakeCraft como titulo principal', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Cakecraft' })).toBeInTheDocument();
  });
});
