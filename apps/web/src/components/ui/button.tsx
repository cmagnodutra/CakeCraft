import type { ComponentProps } from 'react';

import { messages } from '@/content/messages';
import { cx } from '@/lib/cx';

import { Spinner } from './spinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'md' | 'lg';

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-control font-sans font-bold ' +
  'tracking-tight whitespace-nowrap select-none transition-colors duration-150';

// Desabilitado de verdade fica esmaecido. Carregando tambem usa o atributo
// disabled, mas NAO pode parecer apagado: o usuario precisa ver que algo esta
// acontecendo, entao la entra o cursor de progresso no lugar destes estilos.
const DISABLED = 'disabled:cursor-not-allowed disabled:opacity-50';
const LOADING = 'cursor-progress';

const VARIANTS: Record<ButtonVariant, string> = {
  // CTA do High-Key: preto solido, texto branco em negrito.
  primary: 'bg-ink text-on-ink hover:bg-ink/85',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-sand-100',
  ghost: 'bg-transparent text-ink hover:bg-sand-100',
};

const SIZES: Record<ButtonSize, string> = {
  // h-11 = 44px, o alvo de toque minimo recomendado (mobile first, RNF02).
  md: 'h-11 px-5 text-[0.9375rem]',
  lg: 'h-13 px-7 text-base',
};

/**
 * Classes do botao, exportadas para estilizar tambem um <Link> do Next como
 * botao (um link navega, um botao age; a semantica certa vem do elemento).
 */
export function buttonStyles({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
}: ButtonStyleOptions = {}): string {
  return cx(
    BASE,
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    loading ? LOADING : DISABLED,
  );
}

type ButtonProps = ComponentProps<'button'> & ButtonStyleOptions;

export function Button({
  variant,
  size,
  fullWidth,
  loading = false, // mostra o spinner, desabilita o botao e o marca como ocupado
  type = 'button',
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonStyles({ variant, size, fullWidth, loading }), className)}
      {...props}
    >
      {loading && <Spinner />}
      {children}
      {loading && <span className="sr-only">{messages.common.loading}</span>}
    </button>
  );
}
