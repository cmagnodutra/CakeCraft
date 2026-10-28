# feat(catalog): cache Redis 7 no catalogo publico e painel administrativo UC05

**Branch:** `feature/admin-catalog` -> `main`

## Contexto

Implementa o primeiro fluxo completo de negocio exigido pelo RFC-001 v1.4
(**UC05 - Gerenciar Catalogo de Insumos** e cache de alta frequencia da **Secao
5.4**):

1. `GET /api/catalog` consultava o PostgreSQL a cada requisicao do Cake Builder,
   sem usar o Redis 7 ja previsto na arquitetura e no `envValidationSchema`;
2. Faltava a interface administrativa `/admin/catalogo` protegida para o papel
   `ADMIN` para cadastrar, filtrar, atualizar preco por quilo (`pricePerKg`),
   configurar estrutura aerada (`isAerated` para `RN01`), declarar alergenicos
   (`RF06`) e inativar/reativar insumos preservando o historico de pedidos.

## O que foi implementado

### Backend (`apps/api`)
- **`RedisModule` global (`ioredis`):** cliente configurado com `lazyConnect:
  true`, `maxRetriesPerRequest: 1` e `enableOfflineQueue: false` para degradacao
  imediata ao PostgreSQL caso o Redis esteja temporariamente indisponivel, alem
  de encerramento limpo em `onModuleDestroy()`.
- **Cache e invalidacao em `CatalogService`:**
  - `findAllActive()` le `catalog:active:v1` no Redis (TTL `300s`), hidrata
    `createdAt`/`updatedAt` e `pricePerKg`, e em caso de `MISS` busca no
    PostgreSQL ordenado por `type` e `name` e grava no Redis;
  - `create()`, `update()` e `deactivate()` invalidam imediatamente
    `catalog:active:v1` no Redis e normalizam `name.trim()` e tags de
    `allergens` (minusculas, sem duplicatas nem vazios);
  - `CreateIngredientDto` valida `@IsNotEmpty()` e `@MinLength(2)` no nome.
- **Teste E2E em PostgreSQL 16 + Redis 7 reais (`test/catalog.e2e-spec.ts`):**
  isola o Redis da suite E2E no banco logico `/1` (`resolveE2eRedisUrl`), limpa
  entre testes em `resetE2eState` e comprova o ciclo `MISS -> HIT no Redis 7 ->
  invalidacao em POST, PATCH e DELETE`.

### Frontend (`apps/web`)
- **Cliente de API do catalogo (`lib/api/catalog.ts`):** `fetchPublicCatalog`,
  `fetchAdminCatalog`, `createCatalogIngredient`, `updateCatalogIngredient` e
  `deactivateCatalogIngredient`.
- **Painel `/admin/catalogo` (`AdminCatalogView`):**
  - bloqueia visitantes e clientes comuns (`role !== 'ADMIN'`) sem disparar
    chamada desnecessaria a `/catalog/admin`;
  - filtra insumos por categoria (`Todos`, `Massas`, `Recheios`, `Coberturas`);
  - cadastra e edita insumos com formatacao BRL, flag de massa aerada (`RN01`)
    e alergenicos separados por virgula (`RF06`);
  - inativa logicamente via `DELETE /catalog/:id` e reativa via
    `PATCH /catalog/:id` (`{ active: true }`).
- **Cabecalho (`SiteHeader`):** exibe o link `Catalogo` (`/admin/catalogo`)
  apenas quando `user.role === 'ADMIN'`.

## Como testar

```bash
npm run test:cov:api
npm run test:e2e:api
npm run test:cov:web
npm run lint:api
npm run lint:web
npm run build:api
npm run build:web
npm run audit:prod
```

## Checklist

- [x] `npm run audit:prod` com 0 vulnerabilidades
- [x] Suite E2E executando contra PostgreSQL 16 (`schema=e2e_test`) e Redis 7 (`/1`) reais
- [x] Nenhum link quebrado na navegacao (`SiteHeader`)
