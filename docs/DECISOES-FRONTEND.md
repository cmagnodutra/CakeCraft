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

## 6. Design system "High-Key" quente (implementado)

**Fontes.** Libre Caslon Text (normal e italico) nos titulos e Hanken
Grotesk (variavel) no texto. Autohospedadas em `src/app/fonts`, licenca
OFL-1.1 junto dos arquivos, carregadas por `next/font/local`. Nenhuma
requisicao ao Google Fonts (LGPD, build offline). Peso total: cerca de 88 KB.
Os glifos do pt-BR foram conferidos um a um com fonttools.

**Cores como contrato testado (RNF03).** Os tokens vivem em
`src/app/globals.css` e o teste `design-tokens.spec.ts` le esse arquivo e
valida cada par texto/fundo (>= 4.5:1) e cada borda ou foco (>= 3:1) pela
formula oficial da WCAG 2.1 (`lib/contrast.ts`). Trocar uma cor no CSS sem
respeitar o contraste faz um teste falhar. Menores valores atuais: texto
5.49:1, borda de campo 3.67:1.

**Componentes.** Button, Field e Alert em `src/components/ui`, com testes de
comportamento e de acessibilidade (rotulo associado, aria-describedby,
role alert/status, estado de carregamento anunciado). Tela de referencia:
`/design-system` (noindex).

**Textos.** Centralizados em `src/content/messages.ts`; comentarios de
codigo em ASCII, textos de interface com acento.

**Marca.** "CakeCraft", com C maiusculo, como no RFC e como confirmado pelo
autor. Na interface, "Cake" em serifa reta e "Craft" em italico na cor de
acento. O nome vive em `messages.brand.name` e um teste garante que a marca
visual e o texto nunca divergem. Identificadores de codigo (`@cakecraft/*`) e
o endereco do repositorio no GitHub seguem em minusculas, por convencao.

**Landing.** Titulo, frase de valor e um unico botao, para `/cadastro`. Ela
so foi feita depois de existir a rota do cadastro: um botao que leva a lugar
nenhum e motivo de reprovacao direta. O titulo tem duas partes em linhas
proprias (a oracao em romano e o fecho em italico), porque o balanceamento
automatico de linhas partia a frase em italico no meio no celular. O espaco
vazio a direita no desktop e intencional: e onde o bolo 3D vai entrar quando
o builder existir.

**Navegacao.** O cabecalho so tem a marca. Links como "Montar bolo" e
"Entrar" entram junto das rotas que abrem: um botao que nao funciona e
motivo de reprovacao direta na regua da disciplina.

## 7. Cliente de API e tela de cadastro

**Um unico ponto de rede.** `lib/api/client.ts` (`apiRequest`) e o unico
codigo do frontend que chama a API. Envia `credentials: 'include'` sempre
(o navegador so manda os cookies httpOnly entre origens, `localhost:3000` ->
`3001`, com essa opcao) e nunca envia `Authorization`: ha um teste que falha
se alguem reintroduzir o header, porque a decisao do projeto e que a sessao
vive so em cookie httpOnly (protege contra XSS).

**Dois tipos de erro, de proposito.** `ApiError` (o servidor respondeu com
erro) e `NetworkError` (nao houve resposta). A tela reage diferente:
"dados invalidos" x "verifique sua conexao". `extractMessages` le o formato
do contrato (string ou array) e nunca lanca, mesmo com corpo estranho
(HTML de proxy, por exemplo).

**A mensagem da API nunca chega ao usuario.** A API responde em ingles e sem
acento ("Ja existe uma conta..."). `describeRegisterError` traduz cada
situacao para um texto de `messages.ts`: 409 aparece no campo e-mail, rede,
5xx e demais viram aviso geral.

**Validacao espelha o backend.** `validateRegister` segue o `RegisterDto`
(nome >= 2, senha >= 8, e-mail valido, telefone livre) e acrescenta o que e
so de interface: telefone opcional com DDD. O corpo enviado tem so os 4
campos aceitos, porque a API usa `forbidNonWhitelisted` e recusa a requisicao
inteira se vier qualquer outro. A senha nunca e aparada.

**Formulario.** Foco no primeiro campo invalido; erro apagado so no campo
corrigido; guarda por `ref` contra envio duplo (dois submits antes do
re-render passam pelo botao ainda habilitado); no sucesso o foco vai para o
novo titulo, porque o formulario some e o foco se perderia no body.

**Como foi verificado no navegador.** Nao ha Postgres no ambiente de
desenvolvimento do assistente (o engine do Prisma nao baixa). A verificacao
sobe o codigo REAL da API (controller, DTOs, ValidationPipe, bcrypt 12, JWT,
cookies, CORS, filtro de erros) trocando so o acesso ao banco por memoria, e
um Chromium percorre o fluxo: corpo e cabecalhos da requisicao, cookies
(httpOnly, SameSite, path), 409 com e-mail em outra caixa, queda de rede com
a API derrubada e nova tentativa com ela de volta. O limite: isso nao exercita
o Postgres; quem cobre o banco sao os testes e2e da API.

## Pendencias de backend encontradas (nao sao do frontend)

1. **`GET /api/auth/me` e `POST /api/auth/logout`: FEITO** na branch
   `feature/auth-session` e endurecido com revogacao server-side na branch
   `feature/auth-complete` (contrato em `docs/CONTRATO-SESSAO.md`).
2. **Senhas longas e bcrypt: FEITO** na branch `fix/backend-hardening`.
   `RegisterDto`, `LoginDto` e `ResetPasswordDto` rejeitam com 400 senhas acima
   de 72 bytes UTF-8 (`@MaxByteLength(72)`), e o frontend espelha a regra.
3. **Rate limiting (RNF05 do RFC): FEITO** na branch `fix/backend-hardening`.
   `@nestjs/throttler` configurado via `APP_GUARD` (60 req/min global por IP,
   10 req/min em `/api/auth/login`, `/api/auth/register` e `/api/auth/refresh`,
   5 req/min em `/api/auth/forgot-password` e `/api/auth/reset-password`,
   `/api/health` isenta).
4. **Rota de refresh, recuperacao de senha e anonimizacao LGPD: FEITO** na
   branch `feature/auth-complete` (`POST /api/auth/refresh` com rotacao SHA-256
   e deteccao de reuso, `POST /api/auth/forgot-password`,
   `POST /api/auth/reset-password` e `DELETE /api/usuarios/me/anonymize`).

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
