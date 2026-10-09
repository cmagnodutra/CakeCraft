# Decisoes do frontend

Registro das decisoes tecnicas e de design do `apps/web`, no formato curto
de ADR (contexto, decisao, consequencia). Serve de memoria para as proximas
branches e de roteiro para explicar as escolhas na banca.

## 1. Next.js 16 e React 19 (e nao Next 14 / React 18)

**Contexto.** O RFC (Secao 5.4) cita "React 18 + Next.js" sem fixar versao
de Next. O plano inicial era Next `^14.2.35`. Ao instalar, `npm audit
--omit=dev` apontou 1 vulnerabilidade critica (execucao remota de codigo) e
1 alta (PostCSS embutido) na linha 14 inteira.

**Evidencia.** Todos os advisories afetam ate `<15.5.x`; o `14.2.35` e a
ultima versao 14 e nao tem correcao. So existem duas linhas corrigidas:
`15.5.24+` (tag `backport`, em manutencao) e `16.4.0` (tag `latest`).

**Decisao.** Next 16.4.0 com React 19. O projeto sera defendido em dezembro
de 2026; comecar numa linha ja em manutencao obrigaria a migrar de major
depois. Com 16.4.0, `npm run audit:prod` fecha em 0.

**Consequencia.** O RFC fala em React 18; a versao 19 e a exigida pelo App
Router do Next 16. A diferenca e de versao, nao de arquitetura (continua
React + Next + TypeScript). Node minimo sobe para 20.9.

## 2. ESLint direto, sem `next lint`

O Next 16 removeu o comando `next lint`. O `apps/web` usa ESLint 10 em flat
config com typescript-eslint (checagem de tipos), regras de hooks do React
e Prettier, o mesmo padrao do `apps/api`. `no-floating-promises` e erro:
em React isso pega `onClick`/`onSubmit` assincronos sem tratamento.

## 3. Tailwind v4

Configurado como plugin do PostCSS e sem `tailwind.config.js`: os tokens do
design system ficam em CSS (`@theme`), junto das variaveis de cor.

## 4. Testes: Jest + React Testing Library via `next/jest`

Mesmo runner do backend (decisao registrada no plano de execucao). O
`next/jest` ja configura SWC, CSS e `next/font`. Meta institucional de
cobertura do frontend: 25%; o `coverageThreshold` global nasce nesse piso.

## 5. URL da API validada em um unico lugar

`src/lib/env.ts` valida `NEXT_PUBLIC_API_URL`: em producao a ausencia e
erro (nunca cai em localhost em silencio), so aceita http/https e remove
barras finais. Sera a base do cliente de API (`credentials: 'include'`,
conforme o contrato de autenticacao por cookie httpOnly).

## Decisoes de design ja tomadas (valem para as proximas branches)

- **Tipografia:** serifa elegante nos titulos + sans limpa no corpo,
  autohospedadas (sem requisicao ao Google Fonts: melhor para LGPD e para
  o build offline).
- **Bolo no Cake Builder:** render 3D rotacionavel (three.js), carregado
  sob demanda para nao pesar a landing e o login, com fallback para
  aparelhos fracos.
- **Cor:** neutros quentes (off-white e areia) em vez de cinza frio; CTAs
  continuam em preto solido com texto branco (design system "High-Key").
- **Layout do builder:** desktop com bolo 3D a esquerda e painel de etapas a
  direita; mobile com bolo no topo e etapas em bottom sheet.
- **Idioma:** pt-BR, com textos centralizados em um arquivo.
- **Marca:** "CakeCraft", so tipografica.
