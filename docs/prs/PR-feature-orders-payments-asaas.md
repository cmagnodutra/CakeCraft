# feat(orders): montador 3D UC01, uploads seguros RF05 e checkout PIX Asaas RN03

**Branch:** `feature/orders-payments-asaas` -> `main`

## Contexto

Entrega o segundo grande fluxo ponta a ponta do RFC-001 v1.4 (**UC01 - Montar
Bolo e Realizar Pedido**, cobrindo `RF02` a `RF07`, `RN01` a `RN03`, `RNF06` e
os fluxos alternativos da **Secao 3.2**):

1. Upload seguro de imagens para impressao comestivel em papel de arroz (`RF05`);
2. Persistencia transacional ACID de pedidos com snapshots historicos de preco
   por insumo (`OrderItem`) e cobranca PIX via **Asaas v3** (`RF07` / `RNF06`);
3. Webhook autenticado e idempotente (`POST /api/payments/webhook/asaas`) que
   libera o pedido de `AGUARDANDO_PAGAMENTO` para `EM_ESPERA` somente apos a
   liquidacao financeira (`RN03`);
4. Interface interativa `/builder` com preview 3D rotacionavel (`RF04`),
   bloqueio estrutural de massas aeradas acima de 2 andares (`RN01`), deteccao
   de conflitos de alergenicos com sugestao de substituto (`RF06`), rascunho em
   `sessionStorage` e acompanhamento de pagamento PIX em `/meus-pedidos`.

## O que foi implementado

### Backend (`apps/api`)
- **`UploadsModule` (`RF05` / Secao 6 OWASP File Upload):**
  - `POST /api/uploads/rice-paper` (JWT, limite 5 MB): inspeciona os magic bytes
    reais do buffer (`PNG`, `JPEG`, `WEBP`), rejeitando SVG/HTML/scripts
    disfarcados com extensao `.png`; descarta `originalname` e grava apenas
    `<uuid>.<ext>`;
  - `GET /api/uploads/rice-paper/:filename`: valida regex estrito contra Path
    Traversal (`../`) e responde com `X-Content-Type-Options: nosniff`.
- **`PaymentsModule` (`RF07`, `RN03`, `RNF06`):**
  - Porta `PixGatewayPort` + adaptador `AsaasPixGateway` (`https://api-sandbox.asaas.com/v3`,
    header `access_token`, criacao/consulta de cliente, cobranca PIX com
    validade de 15 min, QR Code Base64 + BR Code Copia e Cola e estorno
    `/refund`), com fallback deterministico de Sandbox local quando
    `ASAAS_API_KEY === 'sandbox-asaas-local-dev'` (bloqueado em producao pelo
    `envValidationSchema`);
  - `POST /api/payments/webhook/asaas`: valida `asaas-access-token` com
    `timingSafeEqual` e processa de forma idempotente e atomica
    `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` (`Payment.PAGO` + `Order.EM_ESPERA`),
    `PAYMENT_OVERDUE` (`Payment.EXPIRADO`) e `PAYMENT_REFUNDED`
    (`Payment.ESTORNADO` + `Order.CANCELADO`).
- **`OrdersModule` (`UC01` + Secao 3.2):**
  - `POST /api/orders`: recalcula integralmente o valor no servidor via
    `PricingService`, valida conflitos `RF06` (`422`), emite cobranca PIX Asaas
    e grava `Order` + `CakeConfiguration` + `CakeLayers` + snapshots `OrderItem`
    + `Payment` em uma unica `prisma.$transaction`;
  - `GET /api/orders/my` e `GET /api/orders/:id` (com protecao anti-IDOR `403` e
    sincronizacao automatica de QR Code vencido);
  - `POST /api/orders/:id/cancel`: cancelamento gratuito pelo cliente enquanto
    `AGUARDANDO_PAGAMENTO`, e pelo `ADMIN` ate `EM_ESPERA` com estorno no Asaas;
  - `POST /api/orders/:id/regenerate-pix`: emissao de novo QR Code PIX de 15 min
    quando o anterior expira.
- **Suite E2E real (`test/orders-payments.e2e-spec.ts`):** exercita upload com
  bloqueio de SVG falso, bloqueio `422` de alergenicos, criacao atomica de
  pedido, protecao IDOR `403`, webhook Asaas invalido (`401`) e confirmado +
  idempotente (`AGUARDANDO_PAGAMENTO -> EM_ESPERA`), regeneracao de PIX e
  cancelamento sobre PostgreSQL 16 e Redis 7 reais.

### Frontend (`apps/web`)
- **Suporte `FormData` em `apiRequest` (`lib/api/client.ts`)** e cliente tipado
  `lib/api/orders.ts`.
- **Preview 3D interativo (`CakePreview3D`):** projecao isometrica rotacionavel
  de 1 a 4 andares nos formatos `REDONDO`, `QUADRADO` e `RETANGULAR` com
  iluminacao High-Key derivada do HEX em tempo real, placa de mensagem de topo e
  indicador de arte em papel de arroz.
- **Montador `/builder` (`CakeBuilderView`):** cotacao ao vivo via
  `POST /pricing/calculate`, substituicao estrutural `RN01`, alerta bloqueante
  com sugestao de substituto `RF06`, upload `RF05` e persistencia de rascunho em
  `sessionStorage`.
- **Painel `/meus-pedidos` (`MyOrdersView`):** listagem de pedidos, exibicao do
  QR Code PIX + botao de copiar codigo Copia e Cola, regeneracao de PIX expirado
  e cancelamento de pedido pendente.
- **Navegacao (`SiteHeader` e `HomePage`):** links `/builder` e `/meus-pedidos`
  ativados junto das respectivas rotas.

## Como testar

```bash
npm run lint:api
npm run build:api
npm run test:cov:api
npm run test:e2e:api
npm run lint:web
npm run typecheck
npm run test:cov:web
npm run build:web
npm run audit:prod
```

## Checklist

- [x] `npm run audit:prod` com 0 vulnerabilidades
- [x] Suite E2E executando contra PostgreSQL 16 e Redis 7 reais (25/25 testes)
- [x] Nenhum link quebrado na navegacao (`SiteHeader` e `HomePage`)
