# Contrato da API: sessao, recuperacao de senha e anonimizacao LGPD

Complementa o contrato de autenticacao (`POST /api/auth/register` e
`POST /api/auth/login`). Todos os enderecos tem o prefixo `/api`, e toda
chamada do navegador precisa de `credentials: 'include'`.

## GET /api/auth/me

Quem esta logado. O frontend chama ao carregar a pagina, porque os cookies
httpOnly sao invisiveis ao JavaScript e nao ha outro jeito de saber.

- **Autenticacao:** cookie `access_token` (`Path=/`, `HttpOnly`, `SameSite=Lax`).
- **200:** `{ "user": { "id", "name", "email", "role", "xp", "level" } }`.
  Os dados vem do banco, nao do token: XP e nivel aparecem atualizados sem
  precisar logar de novo. Nunca inclui senha, telefone nem data de anonimizacao.
- **401:** `{ "statusCode": 401, "message": "Unauthorized", "path": "/api/auth/me", "timestamp": "..." }`

O 401 significa **"sem sessao ativa no access token"**: o cliente de API tenta
uma unica vez `POST /api/auth/refresh` (caso haja cookie `refresh_token`
valido) antes de considerar o usuario deslogado.

## POST /api/auth/refresh

Rotaciona a sessao sem exigir novo login (Secao 3.2 e Secao 6 do RFC).

- **Autenticacao:** cookie `refresh_token` (`Path=/api/auth/refresh`,
  `HttpOnly`, `SameSite=Lax`). O navegador so envia esse cookie para esta rota,
  reduzindo a superficie de exposicao do token de vida longa (7 dias).
- **Rate limit:** 10 requisicoes por minuto por IP.
- **200:** `{ "user": { "id", "name", "email", "role", "xp", "level" } }` e
  dois novos cabecalhos `Set-Cookie` (`access_token` e `refresh_token`).
- **Persistencia e deteccao de reuso:** o servidor guarda apenas o hash SHA-256
  do `refresh_token` na tabela `refresh_tokens`. A cada uso valido, o registro
  anterior recebe `revoked_at` e um novo par e emitido em transacao atomica. Se
  um `refresh_token` ja revogado for reapresentado (sinal de roubo de sessao),
  o servidor revoga imediatamente todos os refresh tokens ativos daquele
  usuario e responde **401**.
- **401:** sem cookie, token expirado/adulterado, reuso detectado ou conta
  inexistente/anonimizada.

## POST /api/auth/logout

Encerra a sessao no navegador e no servidor.

- **Autenticacao:** nenhuma obrigatoria (idempotente). Se o cookie
  `access_token` estiver presente e tiver assinatura valida - mesmo que ja
  esteja expirado (`ignoreExpiration: true`) - o servidor revoga todos os
  refresh tokens ativos daquele usuario no banco.
- **204**, sem corpo, sempre.
- Manda o navegador apagar os dois cookies (`access_token` com `Path=/` e
  `refresh_token` com `Path=/api/auth/refresh`), com os mesmos atributos de
  quando foram criados (`AuthCookiesService`).

## POST /api/auth/forgot-password

Dispara o e-mail de recuperacao de senha (UC03, passo 4).

- **Corpo:** `{ "email": "cliente@exemplo.com" }`
- **Rate limit:** 5 requisicoes por minuto por IP.
- **200:** `{ "message": "Se o e-mail estiver cadastrado, enviaremos as instrucoes de recuperacao." }`
  Sempre responde 200 (mesmo para e-mail inexistente ou conta anonimizada) para
  impedir enumeracao de contas.
- **Token de uso unico (15m):** JWT de proposito `password-reset` assinado com
  segredo derivado via HMAC-SHA256 de `JWT_ACCESS_SECRET` + `user.id` +
  `user.passwordHash`. Assim que a senha muda, qualquer link anterior torna-se
  criptograficamente invalido sem exigir tabela extra.

## POST /api/auth/reset-password

Redefine a senha a partir do token enviado por e-mail (UC03, passo 4).

- **Corpo:** `{ "token": "<jwt>", "newPassword": "<8 chars a 72 bytes UTF-8>" }`
- **Rate limit:** 5 requisicoes por minuto por IP.
- **204**, sem corpo: grava o novo hash bcrypt (custo 12) e revoga todos os
  refresh tokens ativos do usuario na mesma transacao.
- **400:** token invalido, expirado, ja utilizado ou senha fora das regras.

## DELETE /api/usuarios/me/anonymize

Direito ao esquecimento por anonimizacao irreversivel (Secao 6.1 do RFC - LGPD).

- **Autenticacao:** cookie `access_token` (`JwtAuthGuard`).
- **204**, sem corpo: em transacao atomica no PostgreSQL:
  1. substitui `name` por `"Usuario Anonimizado"`, `email` por
     `"deleted_<uuid>@anon.cakecraft.local"`, `phone` por `null`,
     `password_hash` por um hash bcrypt inutilizavel aleatorio e preenche
     `anonymized_at`;
  2. limpa `delivery_address` (`null`) nos pedidos vinculados, preservando os
     valores financeiros e itens para integridade contabil (UC06 / RF10);
  3. revoga todos os refresh tokens ativos do usuario;
  4. limpa os cookies `access_token` e `refresh_token` na resposta.

## O que o frontend precisa saber

1. **Renovacao silenciosa:** quando uma rota autenticada responde `401`, o
   cliente HTTP (`lib/api/client.ts`) dispara uma unica chamada compartilhada a
   `POST /api/auth/refresh` e repete a requisicao original se a renovacao der
   `200`. Rotas de credenciais (`/auth/login`, `/auth/register`,
   `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`,
   `/auth/reset-password`) nao disparam refresh automatico.
2. **Estado de sessao no frontend:** guardar o usuario devolvido por `/me`,
   `login`, `register` e `refresh` apenas em memoria React (`AuthProvider`),
   nunca em `localStorage` ou `sessionStorage`, e limpar no logout ou na
   anonimizacao.
