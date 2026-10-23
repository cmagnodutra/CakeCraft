# Contrato da API: sessao (`/me` e `/logout`)

Complementa o contrato de autenticacao ja existente (`register` e `login`).
Todos os enderecos tem o prefixo `/api`, e toda chamada do navegador precisa
de `credentials: 'include'`. As respostas abaixo foram capturadas da API real.

## GET /api/auth/me

Quem esta logado. O frontend chama ao carregar a pagina, porque os cookies
httpOnly sao invisiveis ao JavaScript e nao ha outro jeito de saber.

- **Autenticacao:** cookie `access_token` (enviado pelo navegador).
- **200:** `{ "user": { "id", "name", "email", "role", "xp", "level" } }`.
  Os dados vem do banco, nao do token: XP e nivel aparecem atualizados sem
  precisar logar de novo. Nunca inclui senha, telefone nem data de anonimizacao.
- **401:** `{ "statusCode": 401, "message": "Unauthorized", "path": "/api/auth/me", "timestamp": "..." }`

O 401 significa **"sem sessao"**, nao "erro": a tela trata como visitante, sem
mostrar mensagem. Ele ocorre quando nao ha cookie, o token esta adulterado,
assinado com outro segredo ou expirado, o refresh token e usado no lugar do
access token, ou o usuario foi apagado ou anonimizado (LGPD) depois do login.

## POST /api/auth/logout

Sai da conta.

- **Autenticacao:** nenhuma, de proposito. Com o access token expirado a
  pessoa ainda precisa conseguir sair.
- **204**, sem corpo, sempre. E idempotente: sem sessao, responde 204 igual.
- Manda o navegador apagar os dois cookies (`access_token` com `Path=/` e
  `refresh_token` com `Path=/api/auth/refresh`), com os mesmos atributos de
  quando foram criados. So aceita POST: um GET responde 404.

## O que o frontend precisa saber

1. **A sessao dura 15 minutos.** O access token expira em 15 minutos e a rota
   de refresh ainda nao existe (`AuthService.refresh` e TODO). Depois disso o
   `/me` responde 401 e a pessoa precisa entrar de novo, mesmo com o cookie de
   refresh ainda no navegador. O login deve tratar esse 401 sem alarme.
2. **O logout nao revoga o token no servidor.** Ele so limpa os cookies do
   navegador: um token roubado vale ate expirar. Revogacao de verdade depende
   de persistir e rotacionar o refresh token (pendente).
3. **Estado de sessao no frontend:** guardar o usuario devolvido por `/me`,
   `login` e `register` em memoria (nunca em `localStorage`), e limpar no
   logout.
