# fix(api): endurecimento de seguranca, dominio e suite E2E em PostgreSQL real

**Branch:** `fix/backend-hardening` -> `main`

## Contexto

Auditoria tecnica da base existente contra o RFC-001 v1.4 e o playbook
institucional identificou cinco lacunas criticas antes de avancar para os
novos modulos de negocio:

1. Rotas administrativas do catalogo (`GET /admin`, `POST`, `PATCH /:id`,
   `DELETE /:id`) publicas sem `JwtAuthGuard` + `RolesGuard`;
2. Ausencia de teto de 72 bytes UTF-8 na senha (`RegisterDto`, `LoginDto` e
   formulario web), expondo ao truncamento silencioso do bcrypt;
3. Ausencia de Rate Limiting global e por rota sensivel (RNF05 e Secao 6);
4. `PricingService` sem validacao de `IngredientType` por slot, sem bloqueio
   de recheios repetidos no mesmo andar e sujeito a desvio IEEE-754 em ponto
   flutuante;
5. Suite E2E substituindo `PrismaService` por fakes em memoria, o que ocultou
   inclusive a serializacao de `Prisma.Decimal` como string JSON no catalogo.

## O que foi implementado

- **RBAC no `CatalogController` (Secao 6 / UC05):** aplica
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN)` em todas as
  rotas administrativas, mantendo apenas `GET /api/catalog` publica.
- **Serializacao numerica em `CatalogService`:** normaliza `pricePerKg`
  (`Prisma.Decimal`) para `number` na saida do servico, preservando o contrato
  JSON numerico com o frontend.
- **Limite de 72 bytes UTF-8 da senha:** decorator `@MaxByteLength(72)` em
  `RegisterDto` e `LoginDto`, espelhado em `validateRegister` no frontend sem
  depender de alocacao de `Uint8Array`.
- **Rate Limiting (`RNF05`):** `@nestjs/throttler` via `APP_GUARD` (60 req/min
  global por IP, 10 req/min em `POST /api/auth/login` e
  `POST /api/auth/register`, `@SkipThrottle()` em `GET /api/health`).
- **Endurecimento do `PricingService` (RN01/RN02):** valida `IngredientType`
  de cada slot (`MASSA`, `COBERTURA`, `RECHEIO`), bloqueia recheios repetidos
  no mesmo andar e `floorNumber` fora de `1..N`, fixa `@HttpCode(200)` em
  `POST /api/pricing/calculate` e calcula valores em inteiros (centavos x
  gramas) com arredondamento half-up exato.
- **Suite E2E em PostgreSQL 16 real (`schema=e2e_test`):** remove todos os
  fakes de `apps/api/test/`, aplica migrations automaticamente via
  `global-setup-e2e.ts` e usa `configureApp()` para paridade total com
  `main.ts`.
- **Piso institucional de cobertura da API (75%):** ajusta
  `collectCoverageFrom` em `apps/api/package.json` (excluindo `*.spec.ts` e
  `main.ts`) e adiciona `coverageThreshold` global de 75%.

## Como testar

```bash
npm run test:cov:api
npm run test:e2e:api
npm run test:cov:web
npm run lint:api
npm run lint:web
npm run audit:prod
```

## Cobertura verificada

- **API (unitarios + integracao HTTP):** 18 suites, 142 testes (98.6%
  statements, 86.76% branches, 95.23% functions, 98.41% lines).
- **API (E2E em PostgreSQL 16 real):** 4 suites, 23 testes.
- **Web (unitarios + componentes):** 19 suites, 214 testes (100% statements,
  96.94% branches, 100% functions, 100% lines).

## Checklist

- [x] `npm install` e `npm run audit:prod` com 0 vulnerabilidades
- [x] `npm run build:api` e `npm run build:web` sem erros
- [x] Testes unitarios, de integracao e E2E reais passando
- [x] Sem codigo comentado ou mocks falsos na suite E2E
