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

## 8. Cake Builder (`/builder`), motor 3D WebGL (`Three.js`), divisao proporcional de peso e checkout PIX (`/meus-pedidos`)

**Motor 3D em tempo real com WebGL (`Three.js` em `cake-scene-builder.ts` e `cake-canvas-3d.tsx`).**
Para cumprir `RF04` com fidelidade visual na vitrine inicial (`/`) e no montador
(`/builder`), o sistema utiliza geometrias procedurais tridimensionais em
`Three.js` (`CylinderGeometry`, `ExtrudeGeometry` com cantos arredondados para
formatos quadrado e retangular, iluminação de estudio High-Key em 3 pontos com
sombras suaves `PCFSoftShadowMap`, pedestal de porcelana, ganache *drip*,
perolas de confeitaria, rosetas e textura de papel de arroz no topo). A rotacao
em 360 graus funciona tanto por arraste livre de mouse/toque (*pointer events*)
quanto por botoes acessiveis de teclado (`-30` / `+30` / `Centralizar`), com
degradacao graciosa em ambientes sem WebGL (ex.: JSDOM nos testes automatizados)
e descarte explicito de geometrias/materiais (`disposeObject3D`) para evitar
vazamento de VRAM. A mensagem comemorativa de topo e exibida exclusivamente no
quadro branco da interface acima do canvas 3D para legibilidade maxima.

**Selecao unica por quantidade de pessoas e divisao ideal de peso entre os andares (`cake-weight-distribution.ts`).**
Em vez de exigir que o cliente digite manualmente o peso em quilos de cada
andar, o montador apresenta um unico seletor de **Quantidade de pessoas** (de 10
a 120 pessoas, considerando 100g por porcao), respeitando automaticamente o
minimo estrutural por numero de andares (10 para 1 andar, 15 para 2, 25 para 3
e 30 para 4 andares). O peso total e o peso ideal de cada andar sao informados
apenas para leitura, distribuidos de forma decrescente da base mais larga ao
topo (`100%` em 1 andar; `62% / 38%` em 2; `46% / 32% / 22%` em 3;
`36% / 26% / 21% / 17%` em 4) usando aritmetica inteira em dezenas de gramas
(`0,01 kg`) para eliminar desvios IEEE-754.

**Persistencia de rascunho em `sessionStorage` (Secao 3.2 do RFC).** Visitantes
podem montar o bolo antes de autenticar. O estado da montagem (somente formato,
quantidade de pessoas, cor, camadas, restricoes, mensagem de topo e URL relativa
da imagem — nunca tokens ou dados pessoais) fica salvo em
`cakecraft:builder-draft:v1` no `sessionStorage` e e restaurado automaticamente
apos login ou cadastro. Ao concluir `POST /orders`, o rascunho e limpo.

**Regras RN01 e RF06 espelhadas na interface e revalidadas no servidor.** Ao
subir para 3 ou 4 andares, massas aeradas (`isAerated = true`) ficam bloqueadas
no seletor e eventuais selecoes anteriores sao trocadas automaticamente pela
primeira massa estruturada ativa (`RN01`). Ao marcar restricoes alimentares
(`RF06`), o builder cruza alergenicos equivalentes (`lactose`/`leite`,
`gluten`/`trigo`, `ovos`, `castanhas`, `amendoim`, `soja`), exibe alerta
bloqueante com sugestao de substituto compativel da mesma categoria e impede o
envio ate a correcao. O backend (`PricingService` e `OrdersService`) revalida
ambas as regras de forma independente.

## 9. Kanban em tempo real (`/admin/producao`), WebSockets com cookie `httpOnly` e Relatorios (`/admin/relatorios`)

**Socket.io autenticado por cookie `httpOnly` (`subscribeToOrderUpdates`).** Para
cumprir `RF08` e `UC04` sem expor o JWT ao JavaScript (mantendo zero tokens em
`localStorage`), o cliente `socket.io-client` conecta ao namespace `/ws/orders`
com `withCredentials: true`. O navegador anexa o cookie `access_token`
automaticamente no handshake HTTP/WebSocket, e o `KanbanGateway` valida a
assinatura JWT e inscreve a conexao nas salas `user:<id>` (clientes) e
`kitchen:admins` (confeiteiros `ADMIN`). Tanto `/admin/producao` quanto
`/meus-pedidos` reagem ao evento `order.updated`, atualizando cartoes, status e
saldo de XP/Nivel em tempo real sem F5.

**Quadro Kanban operacional e acessivel (`KitchenKanbanView`).** Em vez de
depender exclusivamente de drag-and-drop com mouse (inacessivel via teclado e
propenso a toques acidentais em tablets na cozinha com maos enfarinhadas), cada
cartao do quadro de quatro colunas (`EM_ESPERA`, `EM_PRODUCAO`, `FINALIZACAO`,
`PRONTO`, com baixa final para `ENTREGUE`) oferece botoes explicitos de `>= 44px`
para mover entre as etapas permitidas da maquina de estados
(`PATCH /api/kanban/orders/:id/status`) ou cancelar com estorno em `EM_ESPERA`,
exibindo ficha tecnica completa (formato, andares, HEX, alergenicos, mensagem de
topo, arte em papel de arroz e gramaturas por insumo).

**Relatorios financeiros e exportacao CSV segura (`AdminReportsView`).** A tela
`/admin/relatorios` (`UC06` / `RF10`) consulta `GET /api/reports/financial` com
filtro `from` e `to`, apresenta indicadores consolidados (faturamento liquido
confirmado, pedidos concluidos e ticket medio calculados em centavos inteiros no
servidor) e aciona `GET /api/reports/financial/csv` via `Blob` +
`URL.createObjectURL`, preservando a autenticacao por cookie `httpOnly` e o BOM
UTF-8 (`;`) compativel com Excel/LibreOffice em `pt-BR`.

## Decisoes de design ja tomadas (valem para as proximas branches)

- **Tipografia:** serifa elegante nos titulos + sans limpa no corpo,
  autohospedadas (sem requisicao ao Google Fonts: melhor para LGPD e para
  o build offline).
- **Bolo no Cake Builder e na Vitrine Inicial:** motor 3D interativo em WebGL
  (`Three.js` em `cake-scene-builder.ts` e `cake-canvas-3d.tsx`) com rotacao em
  360 graus por arraste ou controles acessiveis.
- **Cor:** neutros quentes (off-white e areia) em vez de cinza frio; CTAs
  continuam em preto solido com texto branco (design system "High-Key").
- **Layout do builder:** desktop em duas colunas (configuracao a esquerda +
  preview 3D e orcamento fixos a direita); mobile empilhado com alvos >= 44px.
- **Idioma:** pt-BR, com textos centralizados em um arquivo.
- **Marca:** "CakeCraft", so tipografica.
