# Guia Operacional de Deploy: Microsoft Azure, Asaas PIX, SonarCloud, Grafana e Wiki

Este documento descreve o procedimento completo e reproduzivel para publicar o **CakeCraft** em ambiente publico real no **Microsoft Azure (`Azure for Students`)**, conectar o gateway PIX **Asaas**, ativar o quality gate no **SonarCloud**, acessar o painel **Grafana** e sincronizar a **Wiki do GitHub**.

> **Conformidade com a Linha de Projeto Web Apps (Catolica SC):**
> - **Zero plataformas vedadas:** nao utiliza Vercel, Netlify, Render, Firebase nem BaaS/no-code.
> - **Zero deploy manual via SSH/FTP:** todo deploy de aplicacao ocorre exclusivamente via pipeline automatizado no **GitHub Actions** (`.github/workflows/ci-cd.yml`) publicando imagens imutaveis (`sha-<commit>`) no **GitHub Container Registry (`ghcr.io`)**.

---

## 1. Provisionamento da Infraestrutura no Microsoft Azure (Terraform IaC)

Com o pacote **GitHub Student Developer Pack**, ative o beneficio **Azure for Students** (US$ 100 de credito sem cartao de credito em `https://azure.microsoft.com/free/students/`).

### 1.1 Gerar par de chaves SSH dedicado ao CD

No seu terminal (PowerShell ou Bash):

```bash
ssh-keygen -t ed25519 -C "cakecraft-azure-cd" -f ~/.ssh/cakecraft_azure -N ""
```

- `~/.ssh/cakecraft_azure.pub`: chave publica injetada na VM pelo Terraform.
- `~/.ssh/cakecraft_azure`: chave privada cadastrada no segredo `AZURE_VM_SSH_KEY` do GitHub Actions.

### 1.2 Aplicar o modulo Terraform (`infra/terraform/`)

```bash
az login
cd infra/terraform
terraform init
terraform apply \
  -var="subscription_id=$(az account show --query id -o tsv)" \
  -var="ssh_public_key=$(cat ~/.ssh/cakecraft_azure.pub)"
```

> [!NOTE]
> - A VM padrao (`Standard_B2ats_v2`, 1 GiB de RAM) e elegivel as 750 horas gratuitas mensais do Azure for Students; o `cloud-init` cria **2 GiB de swap** para acomodar os 7 containers. Se a regiao `brazilsouth` ou esse SKU nao estiverem liberados na sua assinatura de estudante, use `-var="location=eastus"` e/ou `-var="vm_size=Standard_B2s"` (4 GiB, consome credito).
> - Se o rotulo DNS `cakecraft-app` ja estiver em uso na regiao, passe outro: `-var="domain_name_label=cakecraft-cmagno"`.

Ao concluir (~2 minutos), o Terraform exibira duas saidas:

- `public_ip_address`: IP estatico da VM Ubuntu 24.04 LTS em `brazilsouth`.
- `azure_fqdn`: dominio publico nativo do Azure (`cakecraft-app.brazilsouth.cloudapp.azure.com`), para o qual o **Caddy 2.8** emite certificado HTTPS **Let's Encrypt** automaticamente na porta `443` (voce tambem pode usar um subdominio gratuito do DuckDNS, se preferir).

O script `cloud-init` embutido em `infra/terraform/main.tf` ja instala Docker Engine, Docker Compose v2 e prepara `/opt/cakecraft` automaticamente.

### 1.3 Configurar o arquivo `.env.production` uma unica vez na VM

Copie o modelo `.env.production.example` para `/opt/cakecraft/.env.production` na VM e preencha os segredos reais (gere senhas fortes com `openssl rand -hex 24`):

- `APP_DOMAIN=cakecraft-app.brazilsouth.cloudapp.azure.com`
- `POSTGRES_PASSWORD`, `REDIS_PASSWORD`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (minimo 32 caracteres aleatorios cada)
- `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- `ASAAS_API_URL`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` (a chave do Asaas comeca com `$aact_`: mantenha-a entre **aspas simples** no arquivo, senao o Docker Compose interpola o `$` e a chave chega vazia)
- `GRAFANA_ADMIN_USER=admin`, `GRAFANA_ADMIN_PASSWORD`

---

## 2. Configuracao do Gateway PIX Asaas (`RF07` / `RN03`)

1. Crie uma conta gratuita de Sandbox em `https://sandbox.asaas.com` (ou producao em `https://www.asaas.com`).
2. Em **Minha Conta -> Integracoes -> Chaves de API**, gere uma nova API Key:
   - Salve em `ASAAS_API_KEY` no `/opt/cakecraft/.env.production`.
   - Mantenha `ASAAS_API_URL=https://api-sandbox.asaas.com/v3` (ou `https://api.asaas.com/v3` em producao).
3. Em **Minha Conta -> Integracoes -> Webhooks -> Cobrancas**, cadastre:
   - **URL do Webhook:** `https://cakecraft-app.brazilsouth.cloudapp.azure.com/api/payments/webhooks/asaas`
   - **Versao da API:** `v3`
   - **Token de autenticacao (`asaas-access-token`):** o mesmo valor salvo em `ASAAS_WEBHOOK_TOKEN` no `.env.production` (validado em tempo constante via `crypto.timingSafeEqual` pelo `PaymentsService`).
   - **Eventos marcados:** `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`.

---

## 3. Configuracao do Relay SMTP Transacional (Brevo)

1. Crie uma conta gratuita em `https://www.brevo.com` (plano gratuito de 300 e-mails/dia).
2. Em **SMTP & API -> SMTP**, gere uma chave SMTP e copie os valores para `SMTP_USER` e `SMTP_PASSWORD` no `.env.production`.
3. O CakeCraft envia automaticamente 4 e-mails transacionais com escape anti-HTML Injection:
   - Recuperacao de senha (`POST /api/auth/forgot-password` - link valido por 15 min e uso unico);
   - Aviso de pedido `PRONTO` para retirada/entrega (`PATCH /api/kanban/orders/:id/status`);
   - Recompensa de fidelidade ao subir de nivel a cada `1.000 XP` (`RN04`);
   - Aviso de cancelamento com estorno PIX quando acionado pela confeitaria.

---

## 4. Configuracao do SonarCloud (Analise Estatica e Cobertura)

1. Acesse `https://sonarcloud.io` autenticado com sua conta GitHub (`cmagnodutra`).
2. Importe o repositorio publico `cmagnodutra/Cakecraft` (plano gratuito para repositorios publicos).
3. Em **Administration -> Analysis Method**, desative a Automatic Analysis para que a analise seja executada pelo GitHub Actions (que envia os relatorios reais de cobertura LCOV da API e do Web configurados em `sonar-project.properties`).
4. Copie o `SONAR_TOKEN` gerado.

---

## 5. Segredos e Variaveis no GitHub Actions (CI/CD Automatico)

No repositorio GitHub (`Settings -> Secrets and variables -> Actions`):

### Aba **Secrets**
| Nome | Valor |
| --- | --- |
| `SONAR_TOKEN` | Token gerado no SonarCloud |
| `AZURE_VM_HOST` | `cakecraft-app.brazilsouth.cloudapp.azure.com` (ou IP estatico da VM) |
| `AZURE_VM_USER` | `azureuser` |
| `AZURE_VM_SSH_KEY` | Conteudo completo da chave privada `~/.ssh/cakecraft_azure` |

### Aba **Variables**
| Nome | Valor |
| --- | --- |
| `APP_DOMAIN` | `cakecraft-app.brazilsouth.cloudapp.azure.com` |

A partir desse momento, todo `git push origin main`:
1. Sobe PostgreSQL 16 e Redis 7 reais no runner do GitHub Actions;
2. Executa `audit:prod` (0 vulnerabilidades), `lint`, `typecheck`, testes unitarios com cobertura (`96,54%` API / `93,19%` Web), testes E2E reais (`28/28`) e scan do **SonarCloud**;
3. Constroi as imagens multi-stage non-root e publica no `ghcr.io` com tag imutavel `sha-<commit>`;
4. Aciona o deploy automatizado na VM Azure, aplicando `prisma migrate deploy` no container `migrate` antes de atualizar `api` e `web`.

Para popular o catalogo inicial e o usuario administrador na primeira subida na VM:

```bash
cd /opt/cakecraft
ADMIN_SEED_PASSWORD="SuaSenhaForteAdmin123!" docker compose --env-file .env.production -f docker-compose.prod.yml run --rm -e ADMIN_SEED_PASSWORD migrate npx prisma db seed
```

---

## 6. Observabilidade em Producao (Prometheus + Grafana)

- **Endpoint interno de metricas:** `GET http://api:3001/api/metrics` (coletado a cada 15s pelo container `prometheus`; bloqueado com HTTP `403` para a internet externa pelo `Caddyfile`).
- **Painel Grafana publico autenticado:** `https://cakecraft-app.brazilsouth.cloudapp.azure.com/grafana/`
  - Login: `admin` e a senha configurada em `GRAFANA_ADMIN_PASSWORD`.
  - O datasource Prometheus e o dashboard **CakeCraft - Observabilidade e SLAs (RNF01 / RNF07)** ja nascem provisionados automaticamente (`infra/observability/grafana/`), exibindo latencia P95 de `/api/pricing/calculate` (`<= 0.5s`), disponibilidade HTTP (`>= 99,5%`), throughput por rota, memoria RSS, pedidos criados e webhooks PIX Asaas.

---

## 7. Publicacao da Documentacao na Wiki do GitHub

A disciplina exige documentacao publicada na **Wiki do GitHub** junto ao repositorio.
1. No GitHub (`cmagnodutra/Cakecraft`), clique na aba **Wiki** e clique em **Create the first page -> Save Page** (isso inicializa o repositorio Git da Wiki).
2. Em uma pasta temporaria fora do monorepo, clone a Wiki e copie os documentos versionados de `docs/`:

```bash
git clone https://github.com/cmagnodutra/Cakecraft.wiki.git
cp cakecraft/README.md Cakecraft.wiki/Home.md
cp cakecraft/docs/RFC-001-CakeCraft.md Cakecraft.wiki/RFC-001-Especificacao.md
cp cakecraft/docs/ARQUITETURA-C4.md Cakecraft.wiki/Arquitetura-C4-e-Modelo-de-Dados.md
cp cakecraft/docs/DECISOES-FRONTEND.md Cakecraft.wiki/ADRs-Frontend-e-Design-System.md
cp cakecraft/docs/CONTRATO-SESSAO.md Cakecraft.wiki/Contrato-de-Sessao-e-Seguranca.md
cp cakecraft/docs/SEGURANCA-DEPENDENCIAS.md Cakecraft.wiki/Seguranca-de-Dependencias.md
cp cakecraft/docs/DEPLOY-AZURE-ASAAS-SONAR.md Cakecraft.wiki/Deploy-CI-CD-e-Observabilidade.md
cd Cakecraft.wiki
git add .
git commit -m "docs(wiki): sincroniza documentacao completa de engenharia do CakeCraft"
git push origin master
```
