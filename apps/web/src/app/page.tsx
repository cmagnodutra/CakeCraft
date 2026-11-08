import Link from 'next/link';

import { buttonStyles } from '@/components/ui/button';
import { messages } from '@/content/messages';
import { LandingCakeShowcase } from '@/features/landing/landing-cake-showcase';

const texts = messages.landing;

/**
 * Pagina inicial (High-Key): hero em duas colunas com vitrine interativa de
 * bolo artesanal a direita, fluxo em 3 passos ("Como funciona") e pilares das
 * regras reais da confeitaria abaixo.
 */
export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-20">
      {/* Hero em duas colunas: proposta de valor a esquerda + bolo interativo a direita */}
      <section className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-6">
          <p className="inline-flex items-center rounded-control border border-line bg-sand-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent">
            {texts.eyebrow}
          </p>

          <h1 className="mt-5 font-serif text-[2.5rem] leading-[1.08] tracking-[-0.015em] sm:text-6xl">
            {/* Cada parte em sua linha: no celular o balanceamento automatico partia
                a frase em italico ("com o / preco na hora") e a oracao em romano. */}
            <span className="block">{texts.titleStart}</span>{' '}
            <span className="block text-accent italic">{texts.titleAccent}</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-ink-muted">{texts.body}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/cadastro" className={buttonStyles({ size: 'lg' })}>
              {texts.cta}
            </Link>
            <Link href="/builder" className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
              {texts.builderCta}
            </Link>
          </div>

          <dl className="mt-10 grid grid-cols-1 gap-4 border-t border-line pt-6 sm:grid-cols-3">
            {texts.highlights.map((item) => (
              <div key={item.value}>
                <dt className="font-serif text-xl font-bold text-ink">{item.value}</dt>
                <dd className="mt-0.5 text-xs text-ink-muted">{item.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lg:col-span-6">
          <LandingCakeShowcase />
        </div>
      </section>

      {/* Como funciona em 3 etapas claras */}
      <section className="mt-20 border-t border-line pt-16 sm:mt-24 sm:pt-20">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">
            {texts.stepsSection.eyebrow}
          </p>
          <h2 className="mt-2 font-serif text-3xl leading-tight tracking-[-0.015em] sm:text-4xl">
            {texts.stepsSection.title}
          </h2>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {texts.stepsSection.steps.map((step) => (
            <article
              key={step.number}
              className="rounded-control border border-line bg-surface p-6"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-line bg-sand-100 font-serif text-sm font-bold text-accent">
                {step.number}
              </span>
              <h3 className="mt-4 font-serif text-2xl text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Diferenciais artesanais e regras da confeitaria */}
      <section className="mt-16 rounded-control border border-line bg-sand-100 p-6 sm:mt-20 sm:p-10">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">
            {texts.craftSection.eyebrow}
          </p>
          <h2 className="mt-2 font-serif text-3xl leading-tight tracking-[-0.015em] sm:text-4xl">
            {texts.craftSection.title}
          </h2>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {texts.craftSection.pillars.map((pillar) => (
            <div key={pillar.title} className="rounded-control border border-line bg-surface p-5">
              <h3 className="font-serif text-xl text-ink">{pillar.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{pillar.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
