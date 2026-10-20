import Link from 'next/link';

import { buttonStyles } from '@/components/ui/button';
import { messages } from '@/content/messages';

const texts = messages.landing;

/**
 * Landing: titulo, frase de valor e um unico botao, para o cadastro. Sem
 * outros links de proposito: cada link novo entra junto da rota que ele abre,
 * para nunca existir botao que leva a lugar nenhum.
 */
export default function HomePage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-28">
      <h1 className="max-w-3xl font-serif text-[2.5rem] leading-[1.08] tracking-[-0.015em] sm:text-6xl lg:text-7xl">
        {/* Cada parte em sua linha: no celular o balanceamento automatico partia
            a frase em italico ("com o / preco na hora") e a oracao em romano. */}
        <span className="block">{texts.titleStart}</span>{' '}
        <span className="block text-accent italic">{texts.titleAccent}</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-ink-muted">{texts.body}</p>
      <div className="mt-10">
        <Link href="/cadastro" className={buttonStyles({ size: 'lg' })}>
          {texts.cta}
        </Link>
      </div>
    </section>
  );
}
