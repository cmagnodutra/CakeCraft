import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/layout/site-header';
import { messages } from '@/content/messages';
import { AuthProvider } from '@/features/auth/auth-provider';

import './globals.css';

// Fontes autohospedadas (licenca OFL, arquivos em ./fonts): nenhuma
// requisicao ao Google Fonts, melhor para a LGPD e para build offline.
const serif = localFont({
  src: [
    { path: './fonts/libre-caslon-text-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/libre-caslon-text-latin-400-italic.woff2', weight: '400', style: 'italic' },
  ],
  variable: '--font-libre-caslon',
  display: 'swap',
  fallback: ['Iowan Old Style', 'Georgia', 'serif'],
});

const sans = localFont({
  src: './fonts/hanken-grotesk-latin-wght-normal.woff2',
  variable: '--font-hanken-grotesk',
  weight: '100 900',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  // Pagina sem titulo proprio mostra so a marca; as demais viram
  // "Criar conta | CakeCraft", o que ajuda quem tem varias abas abertas.
  title: { default: messages.brand.name, template: `%s | ${messages.brand.name}` },
  description: messages.brand.tagline,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <AuthProvider>
          <SiteHeader />
          <main id="conteudo">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
