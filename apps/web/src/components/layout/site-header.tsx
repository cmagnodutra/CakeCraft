import Link from 'next/link';

import { Wordmark } from '@/components/brand/wordmark';
import { messages } from '@/content/messages';

/**
 * Cabecalho global. Por enquanto so tem a marca: os links de navegacao
 * (Montar bolo, Entrar) entram junto com as rotas que eles abrem, para
 * nunca existir um link que leva a lugar nenhum.
 */
export function SiteHeader() {
  return (
    <>
      {/* Primeiro elemento focavel: quem navega por teclado pula o cabecalho. */}
      <a
        href="#conteudo"
        className="focus:bg-ink focus:text-on-ink sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:px-4 focus:py-2 focus:text-sm focus:font-bold"
      >
        {messages.a11y.skipToContent}
      </a>
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-5 sm:px-8">
          {/*
            aria-label explicito: a marca e feita de dois <span> e, sem ele,
            alguns leitores de tela leem "Cake craft" (duas palavras).
          */}
          <Link href="/" aria-label={messages.brand.name} className="rounded-control">
            <Wordmark />
          </Link>
        </div>
      </header>
    </>
  );
}
