# CakeCraft

Plataforma Web para montagem visual e paramétrica de bolos customizados, com
precificação volumétrica em tempo real, checkout PIX integrado ao **Asaas**,
gestão da fila de produção em tempo real (Kanban via **Socket.io** + **Redis
Pub/Sub**) e motor de fidelidade por XP.

Projeto de portfólio individual da disciplina de Engenharia de Software
(PAC VII / PAC VIII) — Católica SC.

---

## Problema que o sistema resolve

Confeitarias artesanais orçam bolos customizados manualmente via aplicativos de
mensagem. O processo é lento (esperas acima de 4 horas reduzem a conversão em
71% dos clientes entrevistados em Joinville/SC), sujeito a perda de detalhes de
produção (83% dos confeiteiros) e sem fila estruturada na cozinha. O CakeCraft
substitui esse gargalo por um configurador visual 3D com validação física
estrutural (`RN01`), cálculo volumétrico instantâneo (`RN02`), trava de
produção vinculada ao pagamento PIX (`RN03`) e progressão gamificada (`RN04`).

---

## Estrutura do monorepo

```text
cakecraft/
├── apps/
│   ├── api/                 -> Backend NestJS 11 + Prisma 6 + Socket.io + Prometheus
│   └── web/                 -> Frontend Next.js 16 + React 19 + Tailwind CSS v4
├── docs/                    -> RFC-001 v1.5, Diagramas C4/ER, ADRs, Guia Azure e Prova de Autoria
├── infra/
│   ├── caddy/               -> Reverse proxy HTTPS (Let's Encrypt) + headers OWASP
│   ├── observability/       -> Provisionamento Prometheus + Dashboard Grafana (RNF01/RNF07)
│   └── terraform/           -> Infraestrutura como Codigo (IaC) para Microsoft Azure
├── .github/workflows/       -> Pipeline CI/CD (Auditoria, Testes Reais, SonarCloud, GHCR e Deploy)
├── docker-compose.yml       -> PostgreSQL 16 + Redis 7 para desenvolvimento e testes E2E locais
├── docker-compose.prod.yml  -> Topologia completa de producao na VM Microsoft Azure
├── sonar-project.properties -> Configuracao de analise estatica e LCOV no SonarCloud
└── package.json             -> Raiz do workspace (npm workspaces)
```

---

## Documentação de Engenharia (`docs/`)

- [`docs/RFC-001-CakeCraft.md`](docs/RFC-001-CakeCraft.md): especificação oficial do projeto (RFC-001 v1.5 — personas, casos de uso `UC01`–`UC06`, `RF01`–`RF10`, `RNF01`–`RNF08` e `RN01`–`RN04`).
- [`docs/ARQUITETURA-C4.md`](docs/ARQUITETURA-C4.md): diagramas Mermaid de Contexto (C4 Nível 1), Containers no Microsoft Azure (C4 Nível 2), Componentes da API (C4 Nível 3), Modelo Relacional (`erDiagram` das 9 tabelas) e Sequência de Pedido/PIX/Kanban/XP.
- [`docs/DECISOES-FRONTEND.md`](docs/DECISOES-FRONTEND.md): ADRs de interface, Design System "High-Key", acessibilidade WCAG 2.1 AA, preview 3D isométrico, Socket.io com cookie `httpOnly` e exportação CSV.
- [`docs/CONTRATO-SESSAO.md`](docs/CONTRATO-SESSAO.md): contrato HTTP de sessão em cookies `httpOnly`, rotação de `RefreshToken` SHA-256 e revogação.
- [`docs/SEGURANCA-DEPENDENCIAS.md`](docs/SEGURANCA-DEPENDENCIAS.md): política de auditoria (`npm run audit:prod = 0`), `allowScripts` e governança do lockfile.
- [`docs/DEPLOY-AZURE-ASAAS-SONAR.md`](docs/DEPLOY-AZURE-ASAAS-SONAR.md): passo a passo operacional de provisionamento no Microsoft Azure via Terraform, Asaas PIX, Brevo SMTP, SonarCloud, Grafana e publicação na Wiki do GitHub.
- [`docs/GUIA-PROVA-DE-AUTORIA.md`](docs/GUIA-PROVA-DE-AUTORIA.md): roteiro técnico detalhado das regras de negócio, defesas OWASP/LGPD e métricas verificadas para a Prova de Autoria.

---

## Rotas do Frontend (`@cakecraft/web`)

| Rota | Papel | Funcionalidade |
| --- | --- | --- |
| `/` | Público | Landing Page com proposta de valor e acesso direto ao Cake Builder |
| `/builder` | Público / Cliente | Montador 3D rotacionável (`RF02`–`RF06`, `RN01`, `RN02`) com rascunho em `sessionStorage` |
| `/cadastro` | Público | Cadastro de cliente com validação espelhada do backend (`UC03`) |
| `/entrar` | Público | Autenticação JWT via cookies `httpOnly` (`UC03` / `RF01`) |
| `/esqueci-senha` | Público | Solicitação de link único de recuperação de senha via SMTP (`RF01`) |
| `/resetar-senha` | Público | Redefinição de senha com token HMAC de 15 minutos e uso único (`RF01`) |
| `/meus-pedidos` |Autenticado | Checkout PIX Asaas (QR Code + Copia e Cola), regeneração, cancelamento e status ao vivo via Socket.io |
| `/perfil` | Autenticado | Saldo de XP, nível de fidelidade (`RN04`), restrições com opt-in explícito e anonimização LGPD |
| `/admin/producao` | `ADMIN` | Quadro Kanban da cozinha sincronizado em tempo real via Socket.io (`UC04` / `RF08`) |
| `/admin/catalogo` | `ADMIN` | Gestão de massas, recheios e coberturas com invalidação de cache Redis (`UC05`) |
| `/admin/relatorios` | `ADMIN` | Fechamento operacional por período e exportação CSV em 1 clique (`UC06` / `RF10`) |
| `/design-system` | Interno (`noindex`) | Catálogo vivo de tokens tipográficos, paleta "High-Key" e componentes acessíveis |

---

## Principais Endpoints da API (`@cakecraft/api`)

- **Saúde e Observabilidade:** `GET /api/health`, `GET /api/metrics` (formato Prometheus).
- **Autenticação e LGPD:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `DELETE /api/usuarios/me/anonymize`.
- **Catálogo e Precificação:** `GET /api/catalog` (cache Redis `TTL 300s`), `GET /api/catalog/admin`, `POST /api/catalog`, `PATCH /api/catalog/:id`, `DELETE /api/catalog/:id`, `POST /api/pricing/calculate`.
- **Uploads, Pedidos e Pagamentos PIX Asaas:** `POST /api/uploads/rice-paper`, `GET /api/uploads/rice-paper/:filename`, `POST /api/orders`, `GET /api/orders/my`, `GET /api/orders/:id`, `POST /api/orders/:id/cancel`, `POST /api/orders/:id/regenerate-pix`, `POST /api/payments/webhooks/asaas`.
- **Kanban em Tempo Real e Relatórios:** `GET /api/kanban/orders`, `PATCH /api/kanban/orders/:id/status`, namespace Socket.io `/ws/orders`, `GET /api/reports/financial`, `GET /api/reports/financial/csv`.

---

## Como rodar o sistema completo (desenvolvimento local)

### Pré-requisitos
- Node.js `>= 20.9.0` (recomendado Node.js 22 LTS)
- Docker e Docker Compose (PostgreSQL 16 e Redis 7)

### Passo a passo (a partir da raiz do projeto)

1. **Instale as dependências:**
   ```bash
   npm install
   ```
2. **Suba o PostgreSQL 16 e o Redis 7 no Docker:**
   ```bash
   npm run db:up
   ```
3. **Crie o arquivo `apps/api/.env` a partir do modelo:**
   - PowerShell: `Copy-Item apps/api/.env.example apps/api/.env -Force`
   - Linux/macOS: `cp apps/api/.env.example apps/api/.env`
4. **Aplique as migrações e popule o catálogo inicial + administrador:**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
   *(Cria 8 insumos iniciais e o usuário `admin@cakecraft.com.br` com a senha definida em `ADMIN_SEED_PASSWORD` do `.env`, padrão local `troque-esta-senha-admin`.)*
5. **Inicie a API (Terminal 1 — porta `3001`):**
   ```bash
   npm run dev:api
   ```
6. **Inicie o Frontend (Terminal 2 — porta `3000`):**
   ```bash
   npm run dev:web
   ```
7. Acesse **`http://localhost:3000`** (use sempre `localhost` para coincidir com `CORS_ORIGIN`).

---

## Qualidade, Cobertura e Testes Reais

| Comando | O que verifica | Estado Verificado |
| --- | --- | --- |
| `npm run lint:api` / `npm run lint:web` | ESLint 10 estrito na API e no Frontend | 0 erros |
| `npm run test:cov:api` | Testes unitários e integração HTTP da API (meta `>= 75%`) | **96,54% Stmts** (30 suítes, 187 testes) |
| `npm run test:e2e:api` | Testes E2E contra **PostgreSQL 16 + Redis 7 reais** (`schema=e2e_test`) | **28/28 testes** (6 suítes) |
| `npm run test:cov:web` | Testes de componentes, fluxos e contraste WCAG 2.1 (meta `>= 25%`) | **93,19% Stmts** (43 suítes, 328 testes) |
| `npm run build:api` / `npm run build:web` | Compilação de produção NestJS e Next.js 16 | Build limpo (13 rotas) |
| `npm run audit:prod` | Auditoria de vulnerabilidades em dependências de produção | **0 vulnerabilidades** |

Para instruções completas de deploy automatizado no **Microsoft Azure**, configuração do webhook **Asaas**, **SonarCloud**, **Prometheus + Grafana** e publicação da **Wiki**, consulte [`docs/DEPLOY-AZURE-ASAAS-SONAR.md`](docs/DEPLOY-AZURE-ASAAS-SONAR.md).
