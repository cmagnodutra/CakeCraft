import type { ReactNode } from 'react';

import { cx } from '@/lib/cx';

type AlertVariant = 'error' | 'success' | 'info';

interface AlertProps {
  variant: AlertVariant;
  title?: string;
  /**
   * Mensagens vindas da API. O contrato de erro devolve string (regra de
   * negocio) ou array de strings (validacao, uma por campo): varias viram
   * lista, uma so vira paragrafo.
   */
  messages?: string[];
  children?: ReactNode;
  className?: string;
}

const STYLES: Record<AlertVariant, string> = {
  error: 'border-danger-line bg-danger-soft text-danger',
  success: 'border-success-line bg-success-soft text-success',
  info: 'border-line bg-sand-100 text-ink',
};

export function Alert({ variant, title, messages = [], children, className }: AlertProps) {
  if (!title && !children && messages.length === 0) {
    return null;
  }

  return (
    <div
      // Erro interrompe o leitor de tela (alert); sucesso e informacao nao (status).
      role={variant === 'error' ? 'alert' : 'status'}
      className={cx('rounded-control border px-4 py-3 text-sm', STYLES[variant], className)}
    >
      {title && <p className="font-bold">{title}</p>}
      {messages.length === 1 && <p>{messages[0]}</p>}
      {messages.length > 1 && (
        <ul className="list-disc space-y-1 pl-5">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}
