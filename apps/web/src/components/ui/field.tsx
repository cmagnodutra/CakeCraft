'use client';

import { useId } from 'react';
import type { ComponentProps } from 'react';

import { cx } from '@/lib/cx';

type FieldProps = Omit<ComponentProps<'input'>, 'id'> & {
  label: string;
  /** Orientacao exibida abaixo do campo (ex.: "Minimo de 8 caracteres"). */
  hint?: string;
  /** Mensagem de erro; quando presente, o campo e marcado como invalido. */
  error?: string;
};

/**
 * Campo de formulario acessivel: rotulo associado, dica e erro ligados ao
 * input por aria-describedby, e erro anunciado por leitor de tela.
 */
export function Field({ label, hint, error, className, ...inputProps }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          // text-base (16px) evita o zoom automatico do iOS ao focar o campo.
          'h-11 w-full rounded-control border bg-surface px-3.5 text-base text-ink',
          'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-danger' : 'border-line-strong',
          className,
        )}
        {...inputProps}
      />
      {hint && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
