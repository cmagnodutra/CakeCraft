# chore(devops): observabilidade Prometheus/Grafana, Terraform Azure, CI/CD, SonarCloud e C4

**Branch:** `chore/devops-azure-observability` -> `main`

## Contexto

Conclui todos os requisitos do nucleo comum de engenharia e diferenciais da
Linha de Projeto Web Apps (Catolica SC) para entrega final e Prova de Autoria:

1. **Observabilidade (`Prometheus + Grafana`):** endpoint `GET /api/metrics`
   instrumentado com `prom-client` (metricas de processo Node.js, histograma
   HTTP com bucket `0.5s` para auditar `RNF01 <= 500ms`, taxa de disponibilidade
   para `RNF07 >= 99,5%` e contadores de pedidos `UC01` e webhooks PIX `RN03`),
   mais provisionamento declarativo do datasource e dashboard Grafana;
2. **Containerizacao Multi-Stage e Proxy HTTPS (`Docker + Caddy`):** imagens
   enxutas e non-root para `@cakecraft/api` (alvos `runner` com `--omit=dev` e
   `migrate`) e `@cakecraft/web` (Next.js 16 `standalone`), orquestradas em
   `docker-compose.prod.yml` atras do **Caddy 2.8** com TLS Let's Encrypt
   automatico, cabecalhos OWASP e bloqueio externo de `/api/metrics`;
3. **Infraestrutura como Codigo no Microsoft Azure (`Terraform`):** modulo
   `infra/terraform/` provisionando Resource Group em `brazilsouth`, VNet,
   Subnet, NSG (`22`, `80`, `443`), IP Publico Estatico com FQDN nativo Azure e
   VM Ubuntu 24.04 LTS preparada via `cloud-init`;
4. **Pipeline CI/CD e Qualidade (`GitHub Actions + SonarCloud + GHCR`):**
   workflow `.github/workflows/ci-cd.yml` com containers reais `postgres:16` e
   `redis:7`, `audit:prod`, lint, typecheck, cobertura unitaria, suite E2E real,
   scan `SonarCloud` (`sonar-project.properties`), publicacao de imagens no
   `ghcr.io` e deploy continuo automatizado na VM Azure;
5. **Documentacao C4, Deploy, Wiki e Prova de Autoria:** criacao de
   `docs/ARQUITETURA-C4.md` (C4 Niveis 1-3, `erDiagram` e sequencia em Mermaid),
   `docs/DEPLOY-AZURE-ASAAS-SONAR.md`, `docs/GUIA-PROVA-DE-AUTORIA.md` e
   consolidacao final do `docs/RFC-001-CakeCraft.md` (v1.5) e do `README.md`.

## Como verificar

```bash
npm run audit:prod
npm run lint:api
npm run lint:web
npm run typecheck -w @cakecraft/web
npm run test:cov:api
npm run test:e2e:api
npm run test:cov:web
npm run build:api
npm run build:web
docker build -f apps/api/Dockerfile -t cakecraft-api:check .
docker build -f apps/web/Dockerfile -t cakecraft-web:check .
```

## Checklist

- [x] `npm run audit:prod` com 0 vulnerabilidades
- [x] `MetricsModule` coberto por testes unitarios e E2E real (`GET /api/metrics`)
- [x] Imagens Docker multi-stage da API e do Web construidas e testadas em execucao real
- [x] Diagramas C4 (Niveis 1, 2 e 3), Modelo ER e Sequencia versionados em Mermaid
- [x] Documentacao atualizada e sincronizada sem arquivos legados obsoletos
