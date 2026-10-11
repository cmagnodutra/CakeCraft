import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Field } from './field';

describe('Field', () => {
  it('associa o rotulo ao campo (clicar no rotulo foca o campo)', async () => {
    render(<Field label="E-mail" type="email" />);

    const input = screen.getByLabelText('E-mail');
    expect(input).toHaveAttribute('type', 'email');

    await userEvent.click(screen.getByText('E-mail'));
    expect(input).toHaveFocus();
  });

  it('liga a dica ao campo por aria-describedby', () => {
    render(<Field label="Senha" hint="Mínimo de 8 caracteres" type="password" />);

    const input = screen.getByLabelText('Senha');
    const hint = screen.getByText('Mínimo de 8 caracteres');
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
  });

  describe('com erro', () => {
    it('marca o campo como invalido e liga a mensagem a ele', () => {
      render(<Field label="E-mail" error="Informe um e-mail válido." />);

      const input = screen.getByLabelText('E-mail');
      const message = screen.getByText('Informe um e-mail válido.');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input.getAttribute('aria-describedby')).toContain(message.id);
    });

    it('anuncia o erro para leitor de tela (role alert)', () => {
      render(<Field label="E-mail" error="Informe um e-mail válido." />);

      expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido.');
    });

    it('com dica e erro juntos, o campo aponta para os dois', () => {
      render(<Field label="Senha" hint="Mínimo de 8 caracteres" error="Senha muito curta." />);

      const described = screen.getByLabelText('Senha').getAttribute('aria-describedby') ?? '';
      expect(described.split(' ')).toHaveLength(2);
    });
  });

  it('sem erro nao marca aria-invalid nem cria alerta', () => {
    render(<Field label="Nome" />);

    expect(screen.getByLabelText('Nome')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('dois campos na mesma tela nunca compartilham ids', () => {
    render(
      <>
        <Field label="Nome" />
        <Field label="E-mail" />
      </>,
    );

    expect(screen.getByLabelText('Nome').id).not.toBe(screen.getByLabelText('E-mail').id);
  });

  it('repassa atributos nativos (value, onChange, autoComplete, required)', async () => {
    const onChange = jest.fn();
    render(<Field label="Nome" autoComplete="name" required onChange={onChange} />);

    const input = screen.getByLabelText(/Nome/);
    expect(input).toHaveAttribute('autocomplete', 'name');
    expect(input).toBeRequired();

    await userEvent.type(input, 'Ana');
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});
