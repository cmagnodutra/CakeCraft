# feat(auth): ciclo completo de autenticacao, sessao, recuperacao de senha e anonimizacao LGPD

**Branch:** `feature/auth-complete` -> `main`

## Contexto

Conclui o caso de uso **UC03 / RF01** e a exigencia de privacidade **Secao 6.1
(LGPD)** do RFC-001 v1.4 de ponta a ponta (API NestJS + PostgreSQL 16 + Web
Next.js 16):

1. A tabela `refresh_tokens` existia no schema Prisma, mas o `refresh_token`
   ainda nao era persistido, rotacionado nem revogado no logout;
2. Nao existiam as rotas nem as telas de recuperacao e redefinicao de senha
   (`POST /api/auth/forgot-password`, `POST /api/auth/reset-password`,
   `/esqueci-senha` e `/resetar-senha`);
3. Nao existia o endpoint nem a interface de direito ao esquecimento por
   anonimizacao (`DELETE /api/usuarios/me/anonymize` e `/perfil`);
4. O frontend ainda nao possuia contexto global de sessao em memoria,
   renovacao silenciosa em `401`, tela de login (`/entrar`) nem navegacao
   sincronizada no cabecalho.

## O que foi implementado

### Backend (`apps/api`)
- **Persistencia e rotacao de `RefreshToken` (`SHA-256`):** `register` e
  `login` gravam apenas o hash SHA-256 do `refresh_token` em `refresh_tokens`.
  `POST /api/auth/refresh` valida o cookie restrito ao path `/api/auth/refresh`,
  revoga o token utilizado e emite um novo par em transacao atomica. Se um
  token ja revogado for reapresentado (deteccao de reuso/roubo), todos os
  refresh tokens ativos do usuario sao revogados imediatamente.
- **Revogacao server-side no logout:** `POST /api/auth/logout` le o
  `access_token` (mesmo expirado, desde que autentico) para revogar as sessoes
  ativas do usuario no banco antes de limpar os cookies via
  `AuthCookiesService`.
- **Recuperacao de senha de uso unico (15m):** `POST /api/auth/forgot-password`
  responde sempre `200` com mensagem neutra (anti-enumeracao) e envia link para
  `/resetar-senha?token=...` via `EmailService`. O token JWT (`purpose:
  'password-reset'`) usa segredo derivado por HMAC-SHA256 de
  `JWT_ACCESS_SECRET` + `user.id` + `user.passwordHash`, tornando-se invalido
  automaticamente assim que a senha muda em `POST /api/auth/reset-password`
  (que tambem revoga os refresh tokens anteriores).
- **Anonimizacao LGPD (`DELETE /api/usuarios/me/anonymize`):** em transacao
  ACID no PostgreSQL, substitui `name`, `email`, `phone` e `password_hash` por
  valores anonimos irreversiveis, marca `anonymized_at`, limpa
  `delivery_address` nos pedidos vinculados (preservando valores contabeis para
  `RF10`), revoga os refresh tokens e apaga os cookies de sessao.

### Frontend (`apps/web`)
- **Renovacao silenciosa no cliente HTTP (`lib/api/client.ts`):** intercepta
  `401` em rotas autenticadas, deduplica requisicoes concorrentes em um unico
  `POST /auth/refresh` e repete a chamada original uma unica vez.
- **Sessao exclusivamente em memoria (`AuthProvider` / `useAuth`):** hidrata via
  `GET /auth/me` com controle de versao contra condicoes de corrida e zero uso
  de `localStorage`.
- **Cabecalho sincronizado (`SiteHeader`):** exibe `/entrar` e `/cadastro` para
  visitantes e `/perfil` + botao `Sair` para usuarios autenticados (sem nenhum
  link para rotas inexistentes).
- **Novas telas acessiveis (High-Key / WCAG 2.1 AA):**
  - `/entrar` (`LoginForm`);
  - `/esqueci-senha` (`ForgotPasswordForm`);
  - `/resetar-senha` (`ResetPasswordForm` envolto em `<Suspense>`);
  - `/perfil` (`ProfileView` com dados cadastrais, barra de progresso do Clube
    CakeCraft `RN04`, logout e anonimizacao LGPD com confirmacao em duas
    etapas).

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

## Cobertura verificada

- **API (unitarios + integracao HTTP):** 18 suites, 135 testes (97.83%
  statements, 86.88% branches, 95.91% functions, 97.59% lines).
- **API (E2E em PostgreSQL 16 real):** 4 suites, 21 testes cobrindo registro,
  login, `/me`, rotacao e deteccao de reuso de refresh token, recuperacao de
  senha via `RecordingEmailSender`, logout com revogacao e anonimizacao LGPD.
- **Web (unitarios + componentes):** 28 suites, 280 testes (98.15% statements,
  93.12% branches, 98.26% functions, 98.57% lines).

## Checklist

- [x] `npm run audit:prod` com 0 vulnerabilidades
- [x] `npm run build:api` e `npm run build:web` sem erros
- [x] Testes unitarios, de integracao e E2E reais passando
- [x] Documentacao `docs/CONTRATO-SESSAO.md` e `docs/DECISOES-FRONTEND.md` sincronizada
