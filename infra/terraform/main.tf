terraform {
  required_version = ">= 1.6.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

resource "azurerm_resource_group" "cakecraft" {
  name     = "rg-${var.project_name}-prod"
  location = var.location

  tags = {
    project     = "CakeCraft"
    environment = "production"
    institution = "Catolica-SC-PAC-VIII"
  }
}

resource "azurerm_virtual_network" "cakecraft" {
  name                = "vnet-${var.project_name}"
  address_space       = ["10.20.0.0/16"]
  location            = azurerm_resource_group.cakecraft.location
  resource_group_name = azurerm_resource_group.cakecraft.name
}

resource "azurerm_subnet" "app" {
  name                 = "snet-${var.project_name}-app"
  resource_group_name  = azurerm_resource_group.cakecraft.name
  virtual_network_name = azurerm_virtual_network.cakecraft.name
  address_prefixes     = ["10.20.1.0/24"]
}

resource "azurerm_public_ip" "cakecraft" {
  name                = "pip-${var.project_name}-prod"
  location            = azurerm_resource_group.cakecraft.location
  resource_group_name = azurerm_resource_group.cakecraft.name
  allocation_method   = "Static"
  sku                 = "Standard"
  domain_name_label   = var.domain_name_label
}

resource "azurerm_network_security_group" "cakecraft" {
  name                = "nsg-${var.project_name}-prod"
  location            = azurerm_resource_group.cakecraft.location
  resource_group_name = azurerm_resource_group.cakecraft.name

  security_rule {
    name                       = "AllowHTTP"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "AllowHTTPS"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "AllowSSH"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = var.allowed_ssh_cidr
    destination_address_prefix = "*"
  }
}

resource "azurerm_network_interface" "cakecraft" {
  name                = "nic-${var.project_name}-prod"
  location            = azurerm_resource_group.cakecraft.location
  resource_group_name = azurerm_resource_group.cakecraft.name

  ip_configuration {
    name                          = "ipconfig1"
    subnet_id                     = azurerm_subnet.app.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.cakecraft.id
  }
}

resource "azurerm_network_interface_security_group_association" "cakecraft" {
  network_interface_id      = azurerm_network_interface.cakecraft.id
  network_security_group_id = azurerm_network_security_group.cakecraft.id
}

resource "azurerm_linux_virtual_machine" "cakecraft" {
  name                = "vm-${var.project_name}-prod"
  resource_group_name = azurerm_resource_group.cakecraft.name
  location            = azurerm_resource_group.cakecraft.location
  size                = var.vm_size
  admin_username      = var.admin_username

  network_interface_ids = [
    azurerm_network_interface.cakecraft.id,
  ]

  admin_ssh_key {
    username   = var.admin_username
    public_key = var.ssh_public_key
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
    disk_size_gb         = 30
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }

  custom_data = base64encode(<<-EOF
    #!/bin/bash
    set -euxo pipefail
    # Swap de 2 GiB: a VM gratuita tem 1 GiB de RAM para 7 containers
    # (Postgres, Redis, API, Web, Prometheus, Grafana e Caddy).
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    usermod -aG docker ${var.admin_username}
    mkdir -p /opt/cakecraft/infra/caddy /opt/cakecraft/infra/observability
    chown -R ${var.admin_username}:${var.admin_username} /opt/cakecraft
  EOF
  )
}
