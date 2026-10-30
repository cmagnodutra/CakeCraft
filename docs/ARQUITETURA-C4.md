# Arquitetura do Sistema CakeCraft (Modelo C4, Modelo de Dados e Sequencia)

Este documento formaliza os diagramas arquiteturais referenciados nas **Secoes 3.1, 5.1 e 5.2** do `docs/RFC-001-CakeCraft.md`, versionados como codigo em Mermaid para rastreabilidade em Git e publicacao direta na Wiki do GitHub.

---

## 1. C4 Nivel 1 - Diagrama de Contexto

Mostra o sistema **CakeCraft** como caixa-preta, seus atores humanos (Personas da Secao 2.1 do RFC) e os sistemas externos integrados via rede.

```mermaid
flowchart TB
    Cliente["Mariana - Cliente Final B2C (Navegador Desktop / Mobile)"]
    Admin["Chef Roberto e Juliana - Confeiteiro / Administradora (Tablet na Cozinha / Desktop)"]

    subgraph Core["Plataforma CakeCraft"]
        Sistema["Sistema CakeCraft (Montador 3D, Precificacao Volumetrica, Kanban em Tempo Real e Fidelidade)"]
    end

    Asaas["Asaas API v3 (Gateway PIX - Cobranca Dinamica, Estorno e Webhooks)"]
    Brevo["Brevo SMTP Relay (E-mails Transacionais: Recuperacao de Senha, Pedido Pronto, Level-Up e Estorno)"]

    Cliente -->|"Monta bolo 3D, consulta preco em tempo real, paga via PIX e acompanha status (HTTPS + WSS)"| Sistema
    Admin -->|"Gerencia catalogo, opera fila Kanban da cozinha e exporta relatorios CSV (HTTPS + WSS)"| Sistema
    Sistema -->|"Cria cobranca PIX de 15 min, consulta QR Code e solicita estorno (REST HTTPS)"| Asaas
    Asaas -->|"Notifica PAYMENT_CONFIRMED, PAYMENT_OVERDUE e PAYMENT_REFUNDED (Webhook HTTPS autenticado)"| Sistema
    Sistema -->|"Dispara notificacoes transacionais (SMTP TLS :587)"| Brevo
```

---

## 2. C4 Nivel 2 - Diagrama de Containers (Topologia Microsoft Azure)

Detalha os containers Docker orquestrados em producao (`docker-compose.prod.yml`) sobre uma VM Linux Ubuntu 24.04 LTS provisionada via Terraform no **Microsoft Azure (`brazilsouth`)**.

```mermaid
flowchart TB
    Browser["Navegador do Usuario (Cliente B2C ou Administrador)"]
    AsaasExt["Asaas Gateway PIX (API Externa)"]
    BrevoExt["Brevo Relay SMTP (Servico Externo)"]

    subgraph AzureVM["Microsoft Azure VM - Ubuntu 24.04 LTS (Docker Compose)"]
        Caddy["Caddy 2.8 Reverse Proxy (TLS Let's Encrypt automatico :80/:443)"]
        Web["@cakecraft/web (Next.js 16 + React 19 Standalone :3000)"]
        Api["@cakecraft/api (NestJS 11 REST + Socket.io :3001)"]
        Pg[("PostgreSQL 16 (Persistencia Relacional ACID :5432)")]
        Redis[("Redis 7 (Cache de Catalogo TTL 300s + Pub/Sub :6379)")]
        Prom["Prometheus v2.55 (Coleta /api/metrics a cada 15s :9090)"]
        Graf["Grafana OSS 11.3 (Dashboards RNF01 e RNF07 /grafana)"]
    end

    Browser -->|"HTTPS /*"| Caddy
    Browser -->|"HTTPS /api/* e WSS /socket.io/*"| Caddy
    AsaasExt -->|"POST /api/payments/webhooks/asaas"| Caddy

    Caddy -->|"Proxy /*"| Web
    Caddy -->|"Proxy /api/* e /socket.io/* (bloqueia /api/metrics externo)"| Api
    Caddy -->|"Proxy /grafana/*"| Graf

    Api -->|"Queries parametrizadas e transacoes ACID (Prisma 6)"| Pg
    Api -->|"Cache catalog:active:v1 e canal cakecraft:orders:events:v1 (ioredis)"| Redis
    Api -->|"REST HTTPS (access_token)"| AsaasExt
    Api -->|"SMTP STARTTLS (Nodemailer)"| BrevoExt

    Prom -->|"Scrape interno GET http://api:3001/api/metrics"| Api
    Graf -->|"PromQL"| Prom
```

---

## 3. C4 Nivel 3 - Componentes Internos da API Core (`@cakecraft/api`)

Mapeia os modulos internos do backend NestJS, suas fronteiras de seguranca e dependencias.

```mermaid
flowchart TB
    subgraph GuardsAndCrossCutting["Camada Transversal (Guards, Pipes, Interceptors e Filters)"]
        Throttler["ThrottlerGuard (RNF05: 60/min global, 10/min auth, 5/min reset)"]
        JwtGuard["JwtAuthGuard + RolesGuard (Cookie httpOnly access_token + RBAC)"]
        ValPipe["ValidationPipe (whitelist + forbidNonWhitelisted)"]
        MetricsInt["HttpMetricsInterceptor + MetricsModule (/api/metrics)"]
    end

    subgraph DomainModules["Modulos de Dominio"]
        AuthMod["AuthModule (Registro, Login, Rotacao Refresh SHA-256, Reset Senha, Anonimizacao LGPD)"]
        CatalogMod["CatalogModule (CRUD Admin + Cache Redis TTL 300s com invalidacao automatica)"]
        PricingMod["PricingModule (RN01 trava massa aerada > 2 andares + RN02 calculo volumetrico em centavos)"]
        UploadsMod["UploadsModule (RF05 validacao Magic Bytes PNG/JPEG/WEBP + UUID anti-traversal)"]
        OrdersMod["OrdersModule (UC01 criacao atomica ACID + snapshots OrderItem + anti-IDOR)"]
        PaymentsMod["PaymentsModule + AsaasPixGateway (RF07 cobranca PIX 15m + RN03 webhook timingSafeEqual)"]
        KanbanMod["KanbanModule + KanbanGateway (UC04/RF08 maquina de estados + Socket.io /ws/orders)"]
        GamifMod["GamificationModule (UC02/RF09/RN04 10 XP por R$ 10 + Level-Up a cada 1000 XP)"]
        ReportsMod["ReportsModule (UC06/RF10 KPIs em centavos + CSV UTF-8 BOM anti-Formula Injection)"]
        EmailMod["EmailModule (Templates HTML escapados via Nodemailer / Brevo)"]
    end

    subgraph InfraAdapters["Adaptadores de Infraestrutura"]
        PrismaSvc["PrismaService (PostgreSQL 16)"]
        RedisSvc["RedisService (Cache JSON + Pub/Sub)"]
    end

    OrdersMod --> PricingMod
    OrdersMod --> PaymentsMod
    OrdersMod --> EmailMod
    OrdersMod --> RedisSvc
    OrdersMod --> PrismaSvc

    PaymentsMod --> RedisSvc
    PaymentsMod --> PrismaSvc

    KanbanMod --> GamifMod
    KanbanMod --> EmailMod
    KanbanMod --> RedisSvc
    KanbanMod --> PrismaSvc

    GamifMod --> EmailMod
    GamifMod --> PrismaSvc

    CatalogMod --> RedisSvc
    CatalogMod --> PrismaSvc
    AuthMod --> EmailMod
    AuthMod --> PrismaSvc
    ReportsMod --> PrismaSvc
```

---

## 4. Modelo de Dados Relacional (Secao 5.2 do RFC - `schema.prisma`)

Representa todas as 9 tabelas persistidas no PostgreSQL 16, destacando chaves primarias, chaves estrangeiras e os snapshots historicos (`order_items`) que isolam pedidos fechados contra reajustes futuros no catalogo.

```mermaid
erDiagram
    users ||--o{ refresh_tokens : "possui"
    users ||--o{ orders : "realiza"
    users ||--o{ xp_transactions : "acumula"

    orders ||--|| cake_configurations : "especifica"
    orders ||--o{ order_items : "congela_precos"
    orders ||--o| payments : "liquida_via_pix"
    orders ||--o{ xp_transactions : "origina"

    cake_configurations ||--|{ cake_layers : "composta_por_andares"
    cake_layers ||--o{ cake_layer_fillings : "recheada_com"

    ingredients ||--o{ cake_layers : "massa_ou_cobertura"
    ingredients ||--o{ cake_layer_fillings : "recheio"
    ingredients ||--o{ order_items : "referencia_catalogo"

    users {
        uuid id PK
        string name
        string email UK
        string passwordHash
        string phone
        enum role "CLIENTE | ADMIN"
        string_array dietaryRestrictions
        datetime dietaryConsentAt
        int xp
        int level
        datetime anonymizedAt
    }

    refresh_tokens {
        uuid id PK
        uuid userId FK
        string tokenHash
        datetime expiresAt
        datetime revokedAt
    }

    ingredients {
        uuid id PK
        string name
        enum type "MASSA | RECHEIO | COBERTURA"
        decimal pricePerKg
        boolean active
        boolean isAerated "RN01"
        string_array allergens "RF06"
    }

    orders {
        uuid id PK
        uuid userId FK
        enum status "AGUARDANDO_PAGAMENTO..ENTREGUE"
        decimal totalPrice
        string toppingMessage
        string riceImageUrl "RF05"
        string deliveryAddress
    }

    cake_configurations {
        uuid id PK
        uuid orderId FK
        enum format "REDONDO | QUADRADO | RETANGULAR"
        int floorsCount
        string colorHex "RF04"
        string_array dietaryFlags "RF06"
    }

    cake_layers {
        uuid id PK
        uuid cakeConfigurationId FK
        int floorNumber
        uuid doughIngredientId FK
        uuid coverageIngredientId FK
        decimal estimatedWeightKg
    }

    cake_layer_fillings {
        uuid cakeLayerId PK,FK
        uuid ingredientId PK,FK
    }

    order_items {
        uuid id PK
        uuid orderId FK
        uuid ingredientId FK
        string ingredientNameSnapshot
        decimal pricePerKgSnapshot
        decimal weightKg
        decimal subtotal
    }

    payments {
        uuid id PK
        uuid orderId FK
        string gatewayProvider "ASAAS"
        string gatewayReference
        string qrCode
        string copyPasteCode
        enum status "PENDENTE | PAGO | EXPIRADO | ESTORNADO"
        datetime expiresAt
        datetime paidAt
        datetime refundedAt
    }

    xp_transactions {
        uuid id PK
        uuid userId FK
        uuid orderId FK
        int amount "RN04"
        string reason
    }
```

---

## 5. Diagrama de Sequencia - Pedido, PIX Asaas, Kanban Socket.io e Gamificacao (Secao 3.1)

Demonstra a integracao ponta a ponta desde a montagem no `/builder` ate a entrega na cozinha e credito de XP.

```mermaid
sequenceDiagram
    actor C as Cliente (Mariana)
    participant W as Next.js Web (/builder e /meus-pedidos)
    participant A as NestJS API Core
    participant P as PostgreSQL 16 (ACID)
    participant G as Asaas PIX API v3
    participant R as Redis 7 Pub/Sub
    actor K as Cozinha (/admin/producao)

    C->>W: Configura andares, insumos, HEX e restricoes
    W->>A: POST /api/pricing/calculate
    A->>P: Consulta precos ativos (ou cache Redis)
    A-->>W: 200 OK (subtotal por andar + total em centavos RN01/RN02)

    C->>W: Confirma pedido e checkout PIX
    W->>A: POST /api/orders (cookie httpOnly access_token)
    A->>A: Revalida RN01 (massa aerada) e RF06 (alergenicos)
    A->>G: POST /v3/payments + GET /pixQrCode (expiracao 15 min)
    G-->>A: gatewayReference + QR Code Base64 + BR Code
    A->>P: $transaction(Order AGUARDANDO_PAGAMENTO + Layers + Snapshots + Payment PENDENTE)
    A-->>W: 201 Created (exibe QR Code PIX em /meus-pedidos)

    C->>G: Paga PIX no aplicativo do banco
    G->>A: POST /api/payments/webhooks/asaas (header asaas-access-token)
    A->>A: timingSafeEqual(token) + verifica idempotencia
    A->>P: $transaction(Payment.PAGO + Order.EM_ESPERA) [RN03]
    A->>R: PUBLISH cakecraft:orders:events:v1 (ORDER_PAID)
    R-->>A: KanbanGateway consome evento
    A-->>K: Socket.io order.updated (sala kitchen:admins)
    A-->>C: Socket.io order.updated (sala user:<id>)

    K->>A: PATCH /api/kanban/orders/:id/status (EM_PRODUCAO -> FINALIZACAO -> PRONTO)
    A->>P: $transaction(Order.PRONTO + XpTransaction + User.xp/level) [RN04]
    A->>R: PUBLISH cakecraft:orders:events:v1 (ORDER_STATUS_UPDATED)
    A-->>C: Socket.io order.updated + E-mail de Pedido Pronto (e Level-Up se >= 1000 XP)
```
