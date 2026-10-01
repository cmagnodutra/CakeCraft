# feat(catalog): CRUD de ingredientes com inativacao logica

**Branch:** `feature/catalog` -> `main`

## Contexto

O Cake Builder e o `PricingService` dependem de um catalogo de
ingredientes (massa/recheio/cobertura) com preco por kg. Esta PR
implementa o CRUD administrativo desse catalogo (UC05) e o seed inicial
usado em desenvolvimento.

## O que foi implementado

- **`CatalogService`**: `findAllActive()` (rota publica, consumida pelo
  Cake Builder e pelo `PricingService`), `findAllForAdmin()` (inclui
  inativos), `create()`, `update()` e `deactivate()`.
- **Inativacao logica, nunca delete fisico** - um ingrediente marcado
  inativo preserva o historico de pedidos antigos que ja o referenciam.
- **`CatalogController`**: `GET /api/catalog` (publica), `GET /api/catalog/admin`,
  `POST /api/catalog`, `PATCH /api/catalog/:id`, `DELETE /api/catalog/:id`
  (inativa, responde 204).
- Seed inicial com 8 ingredientes + 1 usuario admin.

## Pendencia conhecida, documentada no proprio codigo

As rotas administrativas (`POST`/`PATCH`/`DELETE`/`GET /admin`) ainda
estao **publicas de proposito** - esta branch foi construida em paralelo
com `feature/auth`, e o RBAC (`JwtAuthGuard` + `RolesGuard` + `@Roles`)
so fica disponivel depois que as duas forem mergeadas em `main`. Ha um
TODO explicito em `catalog.controller.ts` marcando exatamente isso. Vira
um commit de integracao logo apos o merge de ambas.

## Como testar

```bash
cd apps/api
npm test -- src/catalog
npm run test:e2e -- test/catalog.e2e-spec.ts
```

## Cobertura de testes

- **13 testes unitarios** (`catalog.service.spec.ts` + `catalog.controller.spec.ts`):
  CRUD completo, inativacao logica (confirma que nunca deleta
  fisicamente), bloqueio de acesso a id inexistente (404), e o wiring
  de cada rota do controller.
- **9 testes e2e** (Supertest, aplicacao completa): o mesmo CRUD
  validado pela pilha HTTP real, incluindo validacao do DTO (`type`
  fora do enum `IngredientType`, `pricePerKg` negativo, ambos 400).

## Nota tecnica corrigida nesta PR

`@nestjs/mapped-types` estava fixado em uma serie ESM-only
(incompativel com o restante do projeto, que roda em CommonJS) -
corrigido para a ultima versao CommonJS compativel. Sem essa correcao a
rota `PATCH /api/catalog/:id` quebraria em runtime em qualquer maquina,
nao so em desenvolvimento.

## Checklist

- [x] `npm install` limpo
- [x] `nest build` sem erros
- [x] Testes unitarios e e2e passando
- [x] Sem `console.log`/codigo comentado deixado para tras
- [ ] Revisado por um colega (code review avaliativo da disciplina)
