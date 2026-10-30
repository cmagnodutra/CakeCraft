# Guia de Defesa Tecnica - Prova de Autoria (CakeCraft)

Este guia resume as decisoes de engenharia, onde cada regra mora no codigo e como responder objetivamente as perguntas mais provaveis da banca na **Prova de Autoria (30/11/2026)**.

---

## 1. Posicionamento do Tema (Por que NAO e um e-commerce generico nem gestao financeira?)

- **Problema real validado em Joinville/SC:** confeitarias artesanais perdem horas orcando bolos por peso manualmente no WhatsApp (espera > 4h derruba conversao em 71% dos clientes) e sofrem prejuizos com detalhes perdidos na cozinha (83% dos confeiteiros).
- **Diferencial de Engenharia:** ao contrario de uma loja virtual de catalogo fixo, o CakeCraft e um **configurador parametrico multicamadas com validacao fisica estrutural (`RN01`), precificacao volumetrica dinamica (`RN02`), trava transacional de manufatura sob encomenda (`RN03` + Kanban em tempo real via WebSockets `RF08`) e motor de fidelidade (`RN04`)**.
- O modulo `/admin/relatorios` (`RF10`) e um apoio operacional secundario para fechamento de pedidos concluidos, nao um sistema contabil/financeiro generico.

---

## 2. Onde Mora Cada Regra de Negocio (`RN01` a `RN04`) e Como Funciona

### RN01 - Integridade Estrutural (Massas aeradas bloqueadas acima de 2 andares)
- **Onde esta:** `apps/api/src/pricing/pricing.service.ts` (validacao autoritativa no servidor, retorna HTTP `422 Unprocessable Entity`) e `apps/web/src/features/builder/cake-builder-view.tsx` (prevencao na interface com troca automatica pela primeira massa estruturada ativa).
- **Detalhe importante para a banca:** bolos de **1 ou 2 andares** aceitam massa aerada (`isAerated = true`, ex.: Pao de Lo); a partir de **3 ou 4 andares** (`floors.length > 2`), a massa aerada nao suporta a carga fisica dos andares superiores. Mesmo que alguem burle o frontend via `curl`, `POST /api/pricing/calculate` e `POST /api/orders` rejeitam com `422`.

### RN02 - Calculo Volumetrico sem Erros de Ponto Flutuante (IEEE-754)
- **Onde esta:** `apps/api/src/pricing/pricing.service.ts`.
- **Formula:** para cada andar, soma-se o preco por kg da massa + cobertura + recheios selecionados (ate 2 por andar), multiplica-se pelo `estimatedWeightKg` do andar e soma-se a taxa base de montagem (`R$ 25,00`).
- **Por que centavos e gramas inteiros?** Em JavaScript, `0.1 + 0.2 === 0.30000000000000004`. Para evitar divergencia de centavos entre orcamento e cobranca PIX, convertemos precos para **centavos inteiros** (`Math.round(price * 100)`) e pesos para **gramas inteiras** (`Math.round(kg * 1000)`), calculamos `Math.floor((pricePerKgCombinedCents * weightGrams + 500) / 1000)` por andar (arredondamento half-up feito so com inteiros; a taxa base fica em `ASSEMBLY_BASE_FEE_CENTS = 2500`) e so dividimos por `100` na serializacao final.
- **Protecao historica (`OrderItem` snapshot):** em `apps/api/src/orders/orders.service.ts`, quando o pedido e fechado, gravamos `ingredientNameSnapshot` e `pricePerKgSnapshot` em `order_items`. Se o admin reajustar o preco do morango amanha (`UC05`), pedidos antigos nao mudam de valor.

### RN03 - Trava de Producao e Webhook PIX Idempotente (Asaas v3)
- **Onde esta:** `apps/api/src/payments/asaas-pix.gateway.ts`, `apps/api/src/payments/payments.service.ts` e `apps/api/src/kanban/kanban.service.ts`.
- **Como funciona:** todo pedido nasce em `AGUARDANDO_PAGAMENTO`. A query `KanbanService.listProductionQueue()` filtra estritamente `[EM_ESPERA, EM_PRODUCAO, FINALIZACAO, PRONTO]`, mantendo pedidos nao pagos invisiveis para a cozinha.
- **Seguranca e ACID no Webhook (`POST /api/payments/webhooks/asaas`):**
  1. Valida o header `asaas-access-token` usando `crypto.timingSafeEqual` (impede Timing Attacks);
  2. Verifica idempotencia: se `payment.status === 'PAGO'`, retorna `ALREADY_PAID` sem duplicar efeitos colaterais (gateways reenviam webhooks em caso de timeout de rede);
  3. Atualiza `Payment -> PAGO` e `Order -> EM_ESPERA` dentro de `prisma.$transaction` (garantia ACID `RNF06`) e publica `ORDER_PAID` no Redis Pub/Sub.

### RN04 - Motor de XP e Fidelidade Idempotente
- **Onde esta:** `apps/api/src/gamification/gamification.service.ts`.
- **Como funciona:** quando o confeiteiro marca o pedido como `PRONTO` no Kanban (`KanbanService.transitionOrderStatus`), `awardXpForCompletedOrder(orderId)` converte `totalPrice` para centavos inteiros, calcula `Math.floor(totalCents / 1000) * 10` (`10 XP` a cada `R$ 10,00` completos) e abre uma `prisma.$transaction`:
  - Verifica se ja existe `XpTransaction` para aquele `orderId` (idempotencia contra duplo clique);
  - Grava o registro auditavel em `xp_transactions` e atualiza `user.xp` e `user.level = Math.floor(newXp / 1000) + 1`;
  - Se `newLevel > previousLevel`, dispara `EmailService.sendLevelUpRewardEmail` fora da transacao do banco (para que lentidao de SMTP nunca segure lock no PostgreSQL).

---

## 3. Seguranca (OWASP Top 10) e Privacidade (LGPD)

1. **Zero JWT em `localStorage` (Defesa contra XSS):**
   - `AuthCookiesService` (`apps/api/src/auth/auth-cookies.service.ts`) grava `access_token` (15 min, `Path=/`) e `refresh_token` (7 dias, `Path=/api/auth/refresh`) em cookies `httpOnly`, `SameSite=Lax`, `Secure` (em producao). Nenhum script na pagina consegue ler os tokens.
   - No frontend (`apps/web/src/lib/api/client.ts`), `apiRequest` usa `credentials: 'include'` e intercepta `401` fazendo **refresh silencioso deduplicado** em `POST /api/auth/refresh`.
2. **Rotacao de Refresh Token com Deteccao de Reuso:**
   - O banco nunca guarda o refresh token puro, apenas seu hash **SHA-256** (`refresh_tokens.tokenHash`). A cada `POST /api/auth/refresh`, o token usado e revogado e um novo par e emitido. Se um token ja revogado for apresentado novamente (sinal de roubo de sessao), todas as sessoes ativas daquele usuario sao revogadas imediatamente.
3. **Limite UTF-8 de 72 Bytes no Bcrypt (`@MaxByteLength(72)`):**
   - O algoritmo Bcrypt trunca silenciosamente entradas acima de 72 bytes. Em UTF-8, caracteres acentuados ocupam 2+ bytes (`Buffer.byteLength(str, 'utf8')`). O validador `apps/api/src/common/validators/max-byte-length.validator.ts` rejeita senhas > 72 bytes com HTTP `400`, evitando colisao de prefixo.
4. **Upload Seguro por Magic Bytes (`RF05`):**
   - `apps/api/src/uploads/uploads.service.ts` nao confia em `mimetype` nem na extensao enviada pelo navegador: inspeciona os primeiros bytes binarios reais do arquivo (`89 50 4E 47` para PNG, `FF D8 FF` para JPEG, `RIFF....WEBP` para WebP), bloqueando SVG/HTML/scripts disfarcados, renomeia para `<uuid>.<ext>` e serve com `X-Content-Type-Options: nosniff` + regex anti-Path Traversal.
5. **Protecao contra CSV Formula Injection (`RF10`):**
   - Em `apps/api/src/reports/reports.service.ts`, campos textuais iniciados por `=`, `+`, `-`, `@`, `\t` ou `\r` sao prefixados com apostrofo (`'`) antes de entrarem no CSV, impedindo execucao de formulas maliciosas ao abrir a planilha no Excel/LibreOffice.
6. **Anonimizacao LGPD (`DELETE /api/usuarios/me/anonymize`):**
   - Substitui nome (`Usuario Anonimizado`), e-mail (`anonimizado-<userId>@anon.cakecraft.local`), telefone, senha e restricoes alimentares, revoga todos os refresh tokens e preenche `anonymizedAt`, preservando apenas os registros agregados de `orders` para integridade financeira da confeitaria.

---

## 4. Tempo Real (Redis Pub/Sub + Socket.io) e Cache de Alta Frequencia

- **Cache de Catalogo (`CatalogService` + `RedisService`):**
  - `GET /api/catalog` le primeiro `catalog:active:v1` no Redis (TTL `300s`). Qualquer `create`, `update` ou `deactivate` executado pelo `ADMIN` invalida `DEL catalog:active:v1` imediatamente, atendendo `RNF01` e `RNF08` (200+ usuarios simultaneos no Builder).
- **Eventos em Tempo Real (`KanbanGateway` em `/ws/orders`):**
  - No handshake WebSocket, `KanbanGateway` le o mesmo cookie `httpOnly` `access_token`, valida o JWT e coloca clientes na sala isolada `user:<userId>` (um cliente nunca recebe eventos do pedido de outro!) e administradores na sala `kitchen:admins`.
  - O desacoplamento via canal Redis Pub/Sub `cakecraft:orders:events:v1` permite escalar horizontalmente multiplas instancias da API mantendo todos os clientes Socket.io sincronizados.

---

## 5. Preview 3D no Frontend, Acessibilidade WCAG 2.1 e Design System "High-Key"

- **Por que `CakePreview3D` usa projecao isometrica SVG + CSS 3D em vez de WebGL pesado?**
  - `three.js` adicionaria ~600 KB ao bundle e depende de contexto WebGL (que falha ou trava em celulares de entrada e ambientes sem GPU). `apps/web/src/features/builder/cake-preview-3d.tsx` projeta cilindros e prismas isometricos de 1 a 4 andares nos formatos `REDONDO`, `QUADRADO` e `RETANGULAR` com sombreamento calculado do HEX da cobertura e rotacao interativa `-180` a `+180` graus em `< 16ms`, 100% testavel em Jest.
- **Contraste WCAG 2.1 AA Verificado por Teste Automatizado (`RNF03`):**
  - `apps/web/src/app/design-tokens.spec.ts` faz parse real do `globals.css` e calcula matematicamente a razao de luminancia relativa de todos os pares cor/fundo, falhando o CI caso algum texto caia abaixo de `4.5:1` ou borda de controle abaixo de `3.0:1`.

---

## 6. Numeros Reais de Qualidade, Cobertura e Observabilidade

| Indicador | Meta da Disciplina | Resultado Verificado no CakeCraft |
| --- | --- | --- |
| Cobertura de testes Backend (`@cakecraft/api`) | `>= 75%` | **96,54% Statements / 96,47% Lines** (30 suites, 187 testes) |
| Testes E2E Reais Backend (PostgreSQL 16 + Redis 7) | Integracao real | **28 testes E2E em 6 suites** (zero mocks de banco/cache) |
| Cobertura de testes Frontend (`@cakecraft/web`) | `>= 25%` | **93,19% Statements / 94,46% Lines** (43 suites, 328 testes) |
| Vulnerabilidades de Producao (`npm run audit:prod`) | `0` | **0 vulnerabilidades** |
| Observabilidade (`Prometheus + Grafana`) | Obrigatoria | `/api/metrics` + Dashboard Grafana provisionado (`RNF01` P95 e `RNF07` SLA) |
| CI/CD + Qualidade + IaC | Obrigatorio + Diferencial | GitHub Actions + SonarCloud + GHCR + Terraform Azure (`infra/terraform/`) |
