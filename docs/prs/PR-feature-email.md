# feat(email): modulo de envio de e-mail via SMTP (Brevo)

**Branch:** `feature/email` -> `main`

## Contexto

Pre-requisito de `AuthService.forgotPassword()`/`resetPassword()` (hoje
`TODO` explicito em `feature/auth`) - RF01. Esta PR constroi so o
modulo de e-mail em si; a integracao com `AuthService` fica para um
commit de integracao posterior, depois que `auth` e `email` estiverem
as duas em `main` (mesmo padrao ja usado para o RBAC pendente em
`catalog`).

## O que foi implementado

- **`EmailSenderPort`** (interface + token de injecao): quem consome
  (`EmailService`) depende so dela, nunca de SMTP ou de um provedor
  especifico diretamente. Mesmo padrao de abstracao da implementacao de
  referencia (`payments/pix-gateway.interface.ts`).
- **`EmailService`**: monta o e-mail de recuperacao de senha (assunto +
  link de reset) e delega pra porta. Reaproveita `CORS_ORIGIN` como
  origem do frontend para montar o link, em vez de criar uma variavel
  nova.
- **`SmtpEmailSender`**: implementacao concreta via `nodemailer`,
  configuravel por variaveis de ambiente (`SMTP_HOST/PORT/USER/
  PASSWORD/FROM`). Provedor de producao: **Brevo** (300 e-mails/dia
  gratis, sem cartao).
- **`EmailModule`**: liga a porta a implementacao concreta via
  `useClass` - trocar de provedor e so trocar essa linha.

## Decisao de seguranca (vale a atencao de quem revisar)

`nodemailer` 9.x (CommonJS) tem uma vulnerabilidade de severidade
**alta** (vazamento de credencial SMTP entre tenants via cache de DNS
compartilhado, mais DoS por profundidade de parser). A correcao esta na
serie 10.x, que passou a ser ESM-only no `package.json` - o mesmo
padrao que ja quebrou outros pacotes `@nestjs/*` neste projeto.
Diferente deles, por sorte o `nodemailer` 10.x publica build **dual**
(CommonJS + ESM) via `exports` condicional, entao funciona normalmente
com `require()`. Fixado em `^10.0.14`: corrigido E compativel.

## Como testar

```bash
cd apps/api
npm test -- src/email
npm run test:e2e
```

## Cobertura de testes

- **8 testes unitarios** (`email.service.spec.ts` + `smtp-email-sender.spec.ts`):
  `nodemailer` e a porta de e-mail sao sempre mockados - **nenhum teste
  automatizado envia e-mail de verdade**. Cobre o assunto/link
  montados, escaping do token na URL, configuracao do transporte
  (host/porta/credenciais) e a alternancia `secure` conforme a porta
  (465 vs 587).
- **e2e**: a suite de `health` (ja existente) confirma que a aplicacao
  inteira sobe com `EmailModule` registrado no grafo de DI.

## Pendencia que so o autor pode fechar

O plano original desta branch (`PLANO-EXECUCAO-CAKECRAFT.md`, Secao
4.2) pede como gate de merge um **envio manual real** de e-mail via
Brevo, pra confirmar que a configuracao de producao de fato funciona -
isso exige uma conta/chave SMTP real, que o Claude nao tem. Fica como
ultimo passo antes de abrir esta PR de verdade.

## Checklist

- [x] `npm install` limpo
- [x] `nest build` sem erros
- [x] Testes unitarios e e2e passando (com mock - nenhum envio real)
- [x] `npm audit` sem vulnerabilidades novas
- [ ] **Envio manual real confirmado (Brevo)** - pendente, exige credencial do autor
- [ ] Revisado por um colega (code review avaliativo da disciplina)
