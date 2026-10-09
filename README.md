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
│   └── web/   -> Frontend: Next.js (entra em uma rodada posterior)
└── package.json  -> Raiz do workspace (npm workspaces)
```

Cada app tem o próprio `package.json` e o próprio ciclo de build, mas todos
compartilham um único `node_modules` e um único `package-lock.json` na raiz,
resolvidos por npm workspaces.

## Estado atual

Repositório em construcao incremental. O backend está sendo desenvolvido
primeiro; o frontend entra depois que os modulos de API estiverem
implementados e testados.

## Pré-requisitos

- Node.js 20 ou superior
- Docker e Docker Compose (para Postgres e Redis em desenvolvimento)
