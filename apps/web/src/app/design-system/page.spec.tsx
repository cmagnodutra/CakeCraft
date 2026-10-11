import { render, screen } from '@testing-library/react';

import DesignSystemPage, { metadata } from './page';

describe('DesignSystemPage', () => {
  it('apresenta cada familia de componentes, cada uma com seu titulo', () => {
    render(<DesignSystemPage />);

    for (const titulo of ['Cores', 'Tipografia', 'Botões', 'Campos', 'Alertas']) {
      expect(screen.getByRole('heading', { level: 2, name: titulo })).toBeInTheDocument();
    }
  });

  it('tem um unico h1 (hierarquia de titulos correta)', () => {
    render(<DesignSystemPage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('mostra o estado de erro do campo e o alerta de erro como o usuario os recebe', () => {
    render(<DesignSystemPage />);

    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(2);
  });

  it('nao e indexada por buscadores (documentacao interna)', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
