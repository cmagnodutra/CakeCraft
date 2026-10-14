import { cx } from '@/lib/cx';

/**
 * Marca tipografica: "Cake" em serifa reta e "Craft" em italico na cor de
 * acento. Sem ilustracao; o bolo e quem aparece nas telas, nao o logotipo.
 * O nome tem de ser sempre igual a messages.brand.name (ha um teste para
 * isso). As duas partes sao <span> sem espaco entre elas; quem precisa de
 * um nome acessivel confiavel (o link do cabecalho) usa aria-label.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('font-serif text-3xl leading-none tracking-tight', className)}>
      <span>Cake</span>
      <span className="text-accent italic">Craft</span>
    </span>
  );
}
