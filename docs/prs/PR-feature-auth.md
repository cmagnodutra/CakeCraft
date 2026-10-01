# feat(auth): cadastro, login e JWT via cookies httpOnly

**Branch:** `feature/auth` -> `main`

## Contexto

UC03 (Cadastro e Autenticacao) e RF01 (JWT + recuperacao de senha).
Esta PR cobre cadastro e login; recuperacao de senha fica para
`feature/email` (modulo de e-mail ainda nao existe nesta branch).

## O que foi implementado

- **`AuthService.register()`/`login()`**: senha hasheada com bcrypt
  (custo configuravel via `BCRYPT_SALT_ROUNDS`, nunca fixo no codigo),
  e-mail sempre normalizado (`trim().toLowerCase()`) antes de qualquer
  consulta/persistencia, 401 generico no login (nao revela se o e-mail
  existe ou se foi a senha que errou), usuario anonimizado (LGPD) nao
  consegue logar mesmo com a senha antiga correta.
- **Tokens como cookies httpOnly, nunca no corpo da resposta** -
  `access_token` e `refresh_token`, com `sameSite: 'lax'` e `secure`
  condicional a `NODE_ENV`. `refresh_token` restrito ao path
  `/api/auth/refresh`.
- **`JwtStrategy`** le o access token do cookie (nao do header
  `Authorization`), com `cookie-parser` registrado como middleware
  global.
- **RBAC**: `Role` enum, `@Roles()` decorator, `JwtAuthGuard` e
  `RolesGuard` - ainda nao consumidos por nenhuma rota desta propria
  branch (entram no catalog assim que esta PR for mergeada).
- `refresh()`, `forgotPassword()`, `resetPassword()` ficam como `TODO`
  explicito (dependem de `RefreshToken` e de `feature/email`,
  respectivamente).

## Como testar

```bash
cd apps/api
npm test -- src/auth
npm run test:e2e -- test/auth.e2e-spec.ts
```

## Cobertura de testes

- **18 testes unitarios** (`auth.service.spec.ts`: 14 + `auth.controller.spec.ts`: 4):
  100% de cobertura de linhas/branches em `auth.service.ts` e
  `auth.controller.ts`. Inclui os dois casos de normalizacao de e-mail
  (maiusculas e espacos nas pontas), verificando o argumento exato
  recebido pelo Prisma - nao so o resultado final.
- **9 testes e2e** (Supertest, aplicacao completa): cadastro com
  cookies httpOnly reais no `Set-Cookie`, 409 em e-mail duplicado
  (inclusive variacao de maiusculas), 400 em corpo invalido e em campo
  nao declarado no DTO (protecao contra mass assignment), login com 200
  e 401 nos dois casos de credencial invalida.

## Checklist

- [x] `npm install` limpo
- [x] `nest build` sem erros
- [x] Testes unitarios e e2e passando
- [x] Sem `console.log`/codigo comentado deixado para tras
- [ ] Revisado por um colega (code review avaliativo da disciplina)
