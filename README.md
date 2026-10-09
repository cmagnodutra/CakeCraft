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

## Comandos principais (a partir da raiz)

| Comando | O que faz |
| --- | --- |
| `npm run dev:api` / `npm run dev:web` | Sobe a API (porta 3001) / o frontend (porta 3000) |
| `npm run test:api` / `npm run test:web` | Testes unitários de cada app |
| `npm run test:e2e:api` | Testes e2e da API (exigem o Docker de pé) |
| `npm run lint:web` | ESLint do frontend |
| `npm run audit:prod` | Vulnerabilidades em dependências de produção (deve ser 0) |

O frontend lê a URL da API de `NEXT_PUBLIC_API_URL` (veja `apps/web/.env.example`).
