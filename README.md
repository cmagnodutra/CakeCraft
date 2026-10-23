# CakeCraft

Plataforma Web para montagem visual de bolos customizados, com precificação
dinâmica por peso/volumetria e gestão da fila de produção em tempo real.

Projeto de portfólio individual da disciplina de Engenharia de Software
(PAC VIII) - Católica SC.

## Problema que o sistema resolve

Confeitarias artesanais orçam bolos customizados manualmente via aplicativos
de mensagem. O processo é lento (esperas acima de 4 horas derrubam a
conversão), sujeito a erro humano e sem fila de produção estruturada. O
CakeCraft substitui esse fluxo por um construtor visual com preço calculado
em tempo real e um quadro Kanban de produção para a cozinha.

## Estrutura do monorepo

```
cakecraft/
├── apps/
│   ├── api/   -> Backend: API REST (NestJS + TypeScript)
│   └── web/   -> Frontend: Next.js 16 + React 19 + Tailwind (em construção)
└── package.json  -> Raiz do workspace (npm workspaces)
```

Cada app tem o próprio `package.json` e o próprio ciclo de build, mas todos
compartilham um único `node_modules` e um único `package-lock.json` na raiz,
resolvidos por npm workspaces.

## Estado atual

Repositório em construção incremental. O backend (auth, catálogo,
precificação e e-mail) está implementado e testado; o frontend começou pelo
esqueleto do workspace e segue com design system, autenticação, Cake Builder
e administração do catálogo. Decisões do frontend: `docs/DECISOES-FRONTEND.md`.

## Pré-requisitos

- Node.js 20.9 ou superior (exigência do Next.js 16)
- Docker e Docker Compose (para Postgres e Redis em desenvolvimento)

## Como rodar o sistema completo (desenvolvimento)

O frontend sozinho não cadastra ninguém: quem grava a conta é a API, que
precisa do banco. Siga nesta ordem, a partir da raiz do projeto:

1. **Dependências:** `npm install`
2. **Banco e Redis:** `npm run db:up` (Postgres e Redis no Docker; o Docker
   Desktop precisa estar aberto)
3. **Variáveis da API:** crie o arquivo `apps/api/.env` a partir do exemplo.
   Ele é ignorado pelo Git, então **não vem junto do zip nem do clone** e
   precisa ser criado em cada pasta nova:
   - PowerShell: `Copy-Item apps/api/.env.example apps/api/.env`
   - macOS/Linux: `cp apps/api/.env.example apps/api/.env`

   Os valores do exemplo já batem com o Docker. As variáveis de SMTP podem
   ficar com os textos de exemplo em desenvolvimento (nada envia e-mail
   ainda), mas **precisam existir**: sem elas a API se recusa a subir.
4. **Tabelas:** `npm run db:migrate`. Opcional: `npm run db:seed` (cria 8
   ingredientes e o administrador `admin@cakecraft.com.br`, com a senha de
   desenvolvimento `troque-esta-senha`).
5. **API** (terminal 1): `npm run dev:api`. Confira em
   `http://localhost:3001/api/health`.
6. **Frontend** (terminal 2): `npm run dev:web`.
7. Abra **`http://localhost:3000`**. Use sempre `localhost`: a API só aceita
   chamadas vindas desse endereço (CORS), então `127.0.0.1` não funciona.

## Páginas do frontend

| Endereço | O que é | Como chegar |
| --- | --- | --- |
| `/` | Landing | Direto |
| `/cadastro` | Criar conta | Botão "Criar minha conta" da landing |
| `/design-system` | Referência interna de cores, tipografia e componentes | Sem link, de propósito (documentação interna, fora dos buscadores): digite o endereço |

Em construção: login (`/entrar`), Cake Builder e administração do catálogo.

## Se o cadastro não funcionar

A mensagem que aparece na tela indica a causa:

| Mensagem | Causa provável | O que fazer |
| --- | --- | --- |
| "Não foi possível conectar ao servidor…" | A API não está acessível | Veja se `npm run dev:api` está rodando e sem erro no terminal (sem `apps/api/.env` ela não sobe); abra `http://localhost:3001/api/health`; abra o site por `localhost`. No navegador, `F12` > Console mostra um aviso `[CakeCraft]` com a URL que falhou |
| "Algo deu errado do nosso lado…" | A API respondeu com erro interno | Em geral, Docker parado ou tabelas não criadas: `npm run db:up` e `npm run db:migrate`; o terminal da API mostra o erro |
| "Já existe uma conta com este e-mail." | Está funcionando: o e-mail já foi cadastrado | Use outro e-mail |
| "Não foi possível criar a conta. Confira os dados…" | A API recusou os dados | Confira os campos; a aba Rede do navegador mostra a resposta |
| Erro embaixo de um campo | Validação do formulário, antes de chamar a API | Corrija o campo indicado |

## Comandos principais (a partir da raiz)

| Comando | O que faz |
| --- | --- |
| `npm run db:up` / `npm run db:down` | Sobe / derruba o Postgres e o Redis (Docker) |
| `npm run db:migrate` / `npm run db:seed` | Cria as tabelas / popula ingredientes e administrador |
| `npm run dev:api` / `npm run dev:web` | Sobe a API (porta 3001) / o frontend (porta 3000) |
| `npm run test:api` / `npm run test:web` | Testes unitários de cada app |
| `npm run test:e2e:api` | Testes e2e da API (exigem o Docker de pé) |
| `npm run lint:web` | ESLint do frontend |
| `npm run audit:prod` | Vulnerabilidades em dependências de produção (deve ser 0) |

O frontend lê a URL da API de `NEXT_PUBLIC_API_URL` (veja `apps/web/.env.example`).
