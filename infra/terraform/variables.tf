variable "subscription_id" {
  description = "ID da assinatura Azure for Students (az account show --query id -o tsv). Obrigatorio no azurerm 4.x"
  type        = string
}

variable "project_name" {
  description = "Prefixo dos recursos provisionados no Microsoft Azure"
  type        = string
  default     = "cakecraft"
}

variable "domain_name_label" {
  description = "Rotulo DNS unico na regiao: gera <rotulo>.<regiao>.cloudapp.azure.com"
  type        = string
  default     = "cakecraft-app"
}

variable "location" {
  description = "Regiao Azure recomendada para baixa latencia no Brasil (RNF01)"
  type        = string
  default     = "brazilsouth"
}

variable "vm_size" {
  description = "SKU elegivel as 750h gratuitas do Azure for Students (2 vCPU, 1 GiB RAM + swap de 2 GiB via cloud-init)"
  type        = string
  default     = "Standard_B2ats_v2"
}

variable "admin_username" {
  description = "Usuario SSH da VM Ubuntu 24.04 LTS"
  type        = string
  default     = "azureuser"
}

variable "ssh_public_key" {
  description = "Chave publica SSH (ed25519 ou rsa) para acesso do runner de CD"
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR autorizado na porta 22 (restrinja ao seu IP ou runner se desejar)"
  type        = string
  default     = "0.0.0.0/0"
}
