'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { Button, buttonStyles } from '@/components/ui/button';
import { messages } from '@/content/messages';
import { useAuth } from '@/features/auth/auth-provider';

/**
 * Cabecalho global com navegacao sincronizada a sessao em memoria.
 * Regra de ouro do projeto: apenas links para rotas que JA existem e
 * funcionam ponta a ponta (/entrar, /cadastro e /perfil).
 */
export function SiteHeader() {
  const { user, isLoading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

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
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          {/*
            aria-label explicito: a marca e feita de dois <span> e, sem ele,
            alguns leitores de tela leem "Cake craft" (duas palavras).
          */}
          <Link href="/" aria-label={messages.brand.name} className="rounded-control">
            <Wordmark />
          </Link>

          <nav aria-label={messages.nav.ariaLabel} className="flex items-center gap-2 sm:gap-3">
            {!isLoading && user ? (
              <>
                <Link href="/perfil" className={buttonStyles({ variant: 'ghost', size: 'md' })}>
                  {messages.nav.profile}
                </Link>
                <Button
                  variant="secondary"
                  size="md"
                  loading={loggingOut}
                  onClick={() => {
                    void handleLogout();
                  }}
                >
                  {messages.nav.logout}
                </Button>
              </>
            ) : !isLoading ? (
              <>
                <Link href="/entrar" className={buttonStyles({ variant: 'ghost', size: 'md' })}>
                  {messages.nav.login}
                </Link>
                <Link href="/cadastro" className={buttonStyles({ variant: 'primary', size: 'md' })}>
                  {messages.nav.register}
                </Link>
              </>
            ) : null}
          </nav>
        </div>
      </header>
    </>
  );
}
