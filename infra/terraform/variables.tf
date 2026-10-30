variable "project_name" {
  description = "Prefixo dos recursos provisionados no Microsoft Azure"
  type        = string
  default     = "cakecraft"
}

variable "location" {
  description = "Regiao Azure recomendada para baixa latencia no Brasil (RNF01)"
  type        = string
  default     = "brazilsouth"
}

variable "vm_size" {
  description = "SKU compativel com creditos do Azure for Students (2 vCPU, 1-2 GB RAM)"
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
