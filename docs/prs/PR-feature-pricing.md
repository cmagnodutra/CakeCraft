# feat(pricing): motor de precificacao em tempo real (RN01/RN02)

**Branch:** `feature/pricing` -> `main`

## Contexto

O Cake Builder precisa mostrar o preco do bolo em tempo real a cada
alteracao de andar/ingrediente (RF03), com resposta abaixo de 500ms
(RNF01). Esta PR implementa o motor de precificacao que calcula esse
preco e aplica a regra de seguranca estrutural do bolo.

## O que foi implementado

- **`PricingService.calculate()`** - RN02 (Calculo Volumetrico de Preco):
  soma, por andar, o preco/kg de cada insumo (massa + cobertura +
  recheios) multiplicado pelo peso estimado do andar, e adiciona a Taxa
  Base de Montagem (`ASSEMBLY_BASE_FEE`, hoje uma constante no service -
  candidata a virar configuravel via `system_settings` se precisar
  mudar sem deploy).
- **`assertStructuralIntegrity()`** - RN01 (Integridade Estrutural):
  bloqueia massa aerada (ex.: Pao de Lo) em bolos com mais de 2 andares,
  respondendo 422. Metodo publico e puro (sem I/O) de proposito - e a
  regra de maior risco de negocio do sistema (bolo que desaba na
  entrega), entao precisa ser testavel isoladamente.
- **`PricingController`** - `POST /api/pricing/calculate`, rota publica
  (o preview de preco no builder funciona antes do cliente se
  autenticar, modo visitante).
- Validacao de ingredientes inexistentes/inativos com 422.
- RNF01: a consulta ao catalogo busca so os ingredientes referenciados
  na requisicao (`findMany` com `in`), nunca o catalogo inteiro.

## Como testar

```bash
cd apps/api
npm test -- src/pricing
npm run test:e2e -- test/pricing.e2e-spec.ts
```

## Cobertura de testes

- **11 testes unitarios** (`pricing.service.spec.ts` + `pricing.controller.spec.ts`):
  RN02 (calculo correto, soma por andar antes da taxa base, ingredientes
  inativos excluidos), RN01 (as duas fronteiras - 2 andares permitido, 3
  andares bloqueado - inclusive com a massa aerada fora do primeiro
  andar), validacao de ingrediente inexistente, e o wiring do
  controller.
- **8 testes e2e** (Supertest, aplicacao completa via `AppModule`):
  as mesmas regras de negocio validadas pela pilha HTTP real (routing +
  `ValidationPipe`, inclusive validacao aninhada do array `floors[]`).

## Checklist

- [x] `npm install` limpo
- [x] `nest build` sem erros
- [x] Testes unitarios e e2e passando
- [x] Sem `console.log`/codigo comentado deixado para tras
- [ ] Revisado por um colega (code review avaliativo da disciplina)
