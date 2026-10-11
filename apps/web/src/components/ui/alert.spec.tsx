import { render, screen, within } from '@testing-library/react';

import { Alert } from './alert';

describe('Alert', () => {
  it('erro e anunciado de imediato (role alert)', () => {
    render(<Alert variant="error">Não foi possível entrar.</Alert>);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível entrar.');
  });

  it.each(['success', 'info'] as const)(
    '%s e anunciado sem interromper (role status)',
    (variant) => {
      render(<Alert variant={variant}>Conta criada.</Alert>);

      expect(screen.getByRole('status')).toHaveTextContent('Conta criada.');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it('mostra o titulo quando informado', () => {
    render(
      <Alert variant="error" title="Erro ao entrar">
        Confira seus dados.
      </Alert>,
    );

    expect(screen.getByText('Erro ao entrar')).toBeInTheDocument();
  });

  describe('messages (formato do erro da API: string ou array de strings)', () => {
    it('uma unica mensagem vira um paragrafo, sem lista', () => {
      render(<Alert variant="error" messages={['Ja existe uma conta com este e-mail.']} />);

      const alert = screen.getByRole('alert');
      expect(within(alert).getByText('Ja existe uma conta com este e-mail.')).toBeInTheDocument();
      expect(within(alert).queryByRole('list')).not.toBeInTheDocument();
    });

    it('varias mensagens (erros de validacao) viram uma lista, uma por campo invalido', () => {
      render(
        <Alert
          variant="error"
          messages={['email must be an email', 'password must be longer than or equal to 8']}
        />,
      );

      const items = within(screen.getByRole('list')).getAllByRole('listitem');
      expect(items).toHaveLength(2);
    });

    it('sem mensagens e sem filhos nao renderiza nada', () => {
      const { container } = render(<Alert variant="error" messages={[]} />);

      expect(container).toBeEmptyDOMElement();
    });
  });
});
