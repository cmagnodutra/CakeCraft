import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button, buttonStyles } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

export const metadata: Metadata = {
  title: 'Design system',
  // Documentacao interna dos componentes: nao deve aparecer em buscadores.
  robots: { index: false, follow: false },
};

const SWATCHES: Array<{ token: string; swatch: string; uso: string }> = [
  { token: 'paper', swatch: 'bg-paper', uso: 'Fundo da página' },
  { token: 'surface', swatch: 'bg-surface', uso: 'Cartões e campos' },
  { token: 'sand-100', swatch: 'bg-sand-100', uso: 'Áreas de apoio' },
  { token: 'sand-200', swatch: 'bg-sand-200', uso: 'Seleção e realces' },
  { token: 'line', swatch: 'bg-line', uso: 'Divisórias finas' },
  { token: 'line-strong', swatch: 'bg-line-strong', uso: 'Bordas de campo' },
  { token: 'ink', swatch: 'bg-ink', uso: 'Texto e botão principal' },
  { token: 'ink-muted', swatch: 'bg-ink-muted', uso: 'Texto secundário' },
  { token: 'accent', swatch: 'bg-accent', uso: 'Destaque da marca' },
  { token: 'danger', swatch: 'bg-danger', uso: 'Erro' },
  { token: 'success', swatch: 'bg-success', uso: 'Sucesso' },
];

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-12">
      <div className="mb-8 max-w-2xl">
        <h2 className="font-serif text-3xl tracking-tight">{title}</h2>
        <p className="mt-2 text-ink-muted">{note}</p>
      </div>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
      <p className="text-sm font-bold tracking-widest text-accent uppercase">Design system</p>
      <h1 className="mt-3 max-w-3xl font-serif text-5xl leading-[1.05] tracking-tight sm:text-7xl">
        High-Key, <span className="italic">em tons quentes</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-ink-muted">
        Papel off-white e areia, botões em preto sólido e uma serifa de ateliê. A interface fica em
        segundo plano: o bolo é sempre o protagonista.
      </p>

      <div className="mt-14">
        <Section
          title="Cores"
          note="Todos os pares de texto e fundo são validados contra a WCAG 2.1 por teste automatizado."
        >
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {SWATCHES.map(({ token, swatch, uso }) => (
              <li key={token}>
                <div className={`${swatch} h-20 rounded-control border border-line`} />
                <p className="mt-2 text-sm font-bold">{token}</p>
                <p className="text-sm text-ink-muted">{uso}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Tipografia"
          note="Instrument Serif nos títulos, Hanken Grotesk no texto. As duas são autohospedadas."
        >
          <div className="space-y-6">
            <p className="font-serif text-6xl leading-none tracking-tight">Monte o seu bolo</p>
            <p className="font-serif text-4xl leading-tight tracking-tight italic">
              com o preço na hora
            </p>
            <p className="max-w-2xl text-lg">
              Escolha andares, massa, recheio e cobertura. O valor é recalculado a cada seleção, sem
              esperar orçamento por mensagem.
            </p>
            <p className="max-w-2xl text-sm text-ink-muted">
              Texto secundário, para dicas, legendas e informações de apoio.
            </p>
          </div>
        </Section>

        <Section
          title="Botões"
          note="O principal é o CTA High-Key. Altura mínima de 44 px para o toque no celular."
        >
          <div className="flex flex-wrap items-center gap-4">
            <Button>Montar meu bolo</Button>
            <Button variant="secondary">Ver catálogo</Button>
            <Button variant="ghost">Cancelar</Button>
            <Button size="lg">Finalizar pedido</Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button loading>Entrando</Button>
            <Button disabled>Indisponível</Button>
            <Link href="/" className={buttonStyles({ variant: 'secondary' })}>
              Link com aparência de botão
            </Link>
          </div>
          <div className="mt-6 max-w-sm">
            <Button fullWidth size="lg">
              Largura total
            </Button>
          </div>
        </Section>

        <Section
          title="Campos"
          note="Rótulo sempre visível, dica e erro ligados ao campo para leitores de tela."
        >
          <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
            <Field label="Nome" placeholder="Mariana Silva" autoComplete="name" />
            <Field
              label="Senha"
              type="password"
              hint="Mínimo de 8 caracteres."
              autoComplete="new-password"
            />
            <Field
              label="E-mail"
              type="email"
              defaultValue="mariana@"
              error="Informe um e-mail válido."
            />
            <Field label="Telefone" disabled defaultValue="(47) 99999-9999" />
          </div>
        </Section>

        <Section
          title="Alertas"
          note="Erro interrompe o leitor de tela; sucesso e informação são anunciados sem interromper."
        >
          <div className="grid max-w-3xl gap-4">
            <Alert variant="error" title="Não foi possível entrar">
              Confira o e-mail e a senha e tente de novo.
            </Alert>
            <Alert
              variant="error"
              title="Corrija os campos abaixo"
              messages={['Informe um e-mail válido.', 'A senha precisa ter 8 caracteres ou mais.']}
            />
            <Alert variant="success" title="Conta criada">
              Bem-vinda! Agora é só montar o seu primeiro bolo.
            </Alert>
            <Alert variant="info">O preço é recalculado a cada alteração.</Alert>
          </div>
        </Section>
      </div>
    </div>
  );
}
