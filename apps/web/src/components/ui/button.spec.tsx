import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button, buttonStyles } from './button';

describe('Button', () => {
  it('renderiza um <button> com o texto e type="button" por padrao (nao envia formulario sem querer)', () => {
    render(<Button>Entrar</Button>);

    const button = screen.getByRole('button', { name: 'Entrar' });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('permite type="submit" para formularios', () => {
    render(<Button type="submit">Criar conta</Button>);

    expect(screen.getByRole('button', { name: 'Criar conta' })).toHaveAttribute('type', 'submit');
  });

  it('dispara onClick', async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Montar bolo</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Montar bolo' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('nao dispara onClick quando desabilitado', async () => {
    const onClick = jest.fn();
    render(
      <Button disabled onClick={onClick}>
        Pagar
      </Button>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Pagar' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  describe('estado de carregamento (feedback ao usuario)', () => {
    it('fica ocupado, desabilitado e anuncia "Carregando" para leitor de tela', () => {
      render(<Button loading>Entrar</Button>);

      const button = screen.getByRole('button', { name: /Entrar/ });
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toBeDisabled();
      expect(screen.getByText('Carregando')).toBeInTheDocument();
    });

    it('ignora cliques enquanto carrega (evita enviar o formulario duas vezes)', async () => {
      const onClick = jest.fn();
      render(
        <Button loading onClick={onClick}>
          Entrar
        </Button>,
      );

      await userEvent.click(screen.getByRole('button', { name: /Entrar/ }));

      expect(onClick).not.toHaveBeenCalled();
    });

    it('carregando NAO parece desabilitado: sem esmaecer e com cursor de progresso', () => {
      render(<Button loading>Entrar</Button>);

      const button = screen.getByRole('button', { name: /Entrar/ });
      expect(button.className).not.toContain('disabled:opacity-50');
      expect(button).toHaveClass('cursor-progress');
    });

    it('desabilitado de verdade fica esmaecido e com cursor de bloqueio', () => {
      render(<Button disabled>Pagar</Button>);

      const button = screen.getByRole('button', { name: 'Pagar' });
      expect(button).toHaveClass('disabled:opacity-50');
      expect(button).toHaveClass('disabled:cursor-not-allowed');
    });

    it('sem loading nao ha aria-busy nem texto de carregamento', () => {
      render(<Button>Entrar</Button>);

      expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
      expect(screen.queryByText('Carregando')).not.toBeInTheDocument();
    });
  });

  it('repassa atributos extras ao elemento (ex.: aria-label)', () => {
    render(<Button aria-label="Fechar painel">x</Button>);

    expect(screen.getByRole('button', { name: 'Fechar painel' })).toBeInTheDocument();
  });
});

describe('buttonStyles', () => {
  it('o primario e o CTA High-Key: preto solido, texto branco em negrito', () => {
    const classes = buttonStyles({ variant: 'primary' });

    expect(classes).toContain('bg-ink');
    expect(classes).toContain('text-on-ink');
    expect(classes).toContain('font-bold');
  });

  it('o secundario tem borda de campo (contraste de componente) e fundo claro', () => {
    const classes = buttonStyles({ variant: 'secondary' });

    expect(classes).toContain('border-line-strong');
    expect(classes).toContain('bg-surface');
  });

  it('o fantasma nao tem fundo nem borda', () => {
    const classes = buttonStyles({ variant: 'ghost' });

    expect(classes).toContain('bg-transparent');
    expect(classes).not.toContain('border');
  });

  it('o tamanho padrao respeita o alvo de toque minimo de 44px (h-11) para mobile first', () => {
    expect(buttonStyles({})).toContain('h-11');
  });

  it('fullWidth ocupa a largura toda', () => {
    expect(buttonStyles({ fullWidth: true })).toContain('w-full');
    expect(buttonStyles({})).not.toContain('w-full');
  });

  it('serve tambem para estilizar links como botao', () => {
    expect(typeof buttonStyles({ variant: 'primary', size: 'lg' })).toBe('string');
  });
});
