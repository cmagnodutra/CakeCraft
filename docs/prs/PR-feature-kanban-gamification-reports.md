# feat(kanban-reports): Kanban em tempo real UC04, gamificacao RN04 e relatorios CSV UC06

**Branch:** `feature/kanban-gamification-reports` -> `main`

## Contexto

Conclui os fluxos funcionais e administrativos restantes do RFC-001 v1.4:

1. **Kanban de Producao em Tempo Real (`UC04`, `RF08`, Secao 5.4):** maquina de
   estados estrita (`EM_ESPERA -> EM_PRODUCAO -> FINALIZACAO -> PRONTO -> ENTREGUE`)
   desacoplada via **Redis Pub/Sub** (`cakecraft:orders:events:v1`) e entregue
   em tempo real via **Socket.io** (`/ws/orders`) autenticado pelo cookie
   `httpOnly` `access_token`;
2. **Gamificacao e Fidelidade (`UC02`, `RF09`, `RN04`):** credito idempotente e
   transacional ACID de `10 XP` a cada `R$ 10,00` gastos (aritmetica em centavos
   inteiros) quando o pedido atinge `PRONTO`, com progressao de nivel a cada
   `1.000 XP` e envio de e-mail transacional de recompensa ao subir de nivel;
3. **Notificacoes Transacionais (`EmailService`):** aviso automatico de pedido
   `PRONTO`, recompensa de level-up e aviso de cancelamento pela confeitaria com
   escape anti-HTML injection;
4. **Relatorios Financeiros e Exportacao CSV (`UC06`, `RF10`):** consolidacao de
   faturamento liquido (`Payment.PAGO` em pedidos nao cancelados), volume de
   pedidos, ticket medio em centavos inteiros e exportacao CSV com BOM UTF-8,
   separador `;` e sanitizacao OWASP contra CSV Formula Injection (`=`, `+`, `-`,
   `@`, `\t`, `\r`).

## O que foi implementado

### Backend (`apps/api`)
- **`RedisService` (Pub/Sub + resiliencia):**
  - `publishJson` e `subscribeJson` via `client.duplicate()` no canal
    `cakecraft:orders:events:v1`, com fallback local em memoria caso o Redis
    esteja indisponivel e reconexao automatica em producao.
- **`GamificationModule` (`UC02`, `RF09`, `RN04`):**
  - `awardXpForCompletedOrder(orderId)` calcula `Math.floor(cents / 1000) * 10`,
    garante idempotencia consultando `XpTransaction` dentro de
    `prisma.$transaction`, atualiza `user.xp` e `user.level`
    (`Math.floor(xp / 1000) + 1`) e dispara `sendLevelUpRewardEmail` fora da
    transacao quando `newLevel > oldLevel`.
- **`KanbanModule` (`UC04`, `RF08`):**
  - `GET /api/kanban/orders` (`ADMIN`): lista pedidos pagos na fila operacional
    (`EM_ESPERA`, `EM_PRODUCAO`, `FINALIZACAO`, `PRONTO`) com cliente, ficha
    tecnica (`CakeConfiguration`, `CakeLayers`, snapshots `OrderItem`) e
    pagamento;
  - `PATCH /api/kanban/orders/:id/status` (`ADMIN`): impoe transicoes permitidas
    pela maquina de estados (`422` para saltos invalidos ou pedidos ainda em
    `AGUARDANDO_PAGAMENTO`), credita XP e dispara `sendOrderReadyEmail` em
    `PRONTO`, registra `ENTREGUE` na retirada e publica `ORDER_STATUS_UPDATED` no
    Redis Pub/Sub;
  - `KanbanGateway` (`/ws/orders`): autentica o cookie `access_token` no
    handshake Socket.io, isola clientes em `user:<id>` e administradores em
    `kitchen:admins` e propaga `order.updated`.
- **`ReportsModule` (`UC06`, `RF10`):**
  - `GET /api/reports/financial` e `GET /api/reports/financial/csv` (`ADMIN`)
    com validacao de intervalo `from`/`to`, agregacao em centavos inteiros e
    sanitizacao anti-Formula Injection na exportacao CSV.
- **Suite E2E real (`test/kanban-gamification-reports.e2e-spec.ts`):** valida
  handshake Socket.io autenticado por cookie `httpOnly`, propagacao via Redis 7
  Pub/Sub, maquina de estados do Kanban, credito idempotente de XP + level-up e
  relatorio financeiro JSON + CSV sobre PostgreSQL 16 e Redis 7 reais.

### Frontend (`apps/web`)
- **Cliente Socket.io (`lib/realtime/orders-socket.ts`):** assinatura reativa de
  `order.updated` com `withCredentials: true` integrada tanto ao quadro da
  cozinha (`/admin/producao`) quanto a tela do cliente (`/meus-pedidos`, que
  tambem sincroniza `refreshUser()` ao atingir `ENTREGUE`).
- **Quadro Kanban `/admin/producao` (`KitchenKanbanView`):** quatro colunas
  operacionais com ficha tecnica detalhada por bolo, avanco sequencial de etapa
  e cancelamento administrativo com estorno em `EM_ESPERA`.
- **Painel `/admin/relatorios` (`AdminReportsView`):** filtro por periodo,
  cartoes de receita confirmada, pedidos pagos e ticket medio, tabela auditavel
  e download direto de CSV autenticado.
- **Navegacao (`SiteHeader`):** atalhos `Producao` (`/admin/producao`),
  `Catalogo` (`/admin/catalogo`) e `Relatorios` (`/admin/relatorios`) visiveis
  para usuarios `ADMIN`.

## Como testar

```bash
npm run lint:api
npm run build:api
npm run test:cov:api
npm run test:e2e:api
npm run lint:web
npm run typecheck
npm run test:cov:web
npm run build:web
npm run audit:prod
```

## Checklist

- [x] `npm run audit:prod` com 0 vulnerabilidades
- [x] Suite unitaria API com 96.32% Stmts (29/29 suites, 183/183 testes)
- [x] Suite E2E real sobre PostgreSQL 16 + Redis 7 (6/6 suites, 27/27 testes)
- [x] Nenhum link quebrado na navegacao (`SiteHeader`)
