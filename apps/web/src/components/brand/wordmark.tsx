import { cx } from '@/lib/cx';

/**
 * Marca tipografica: "Cake" em serifa reta e "craft" em italico na cor de
 * acento. Sem ilustracao; o bolo e quem aparece nas telas, nao o logotipo.
 * As duas partes sao <span> sem espaco entre elas, entao leitores de tela
 * leem o nome inteiro, "Cakecraft".
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('font-serif text-3xl leading-none tracking-tight', className)}>
      <span>Cake</span>
      <span className="text-accent italic">craft</span>
    </span>
  );
}
