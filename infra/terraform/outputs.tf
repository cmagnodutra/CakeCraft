output "public_ip_address" {
  description = "IP publico estatico da VM Azure (aponte seu dominio DuckDNS ou use <ip>.sslip.io)"
  value       = azurerm_public_ip.cakecraft.ip_address
}

output "azure_fqdn" {
  description = "FQDN nativo fornecido pelo Azure Public IP (suporta HTTPS automatico no Caddy)"
  value       = azurerm_public_ip.cakecraft.fqdn
}
