#!/bin/bash
# deploy_full.sh - @DevOps Unified Deployment Script
set -e

HOST="ubuntu@34.238.194.188"
KEY="supply-key.pem"
SSH_OPTS="-i $KEY -o StrictHostKeyChecking=no"

echo "🚀 Iniciando Deploy Full Stack para $HOST..."

# 1. Upload dos Artefatos
echo "📦 Enviando pacotes..."
scp $SSH_OPTS backend.tar.gz frontend.tar.gz docker-compose.yml nginx_supply.conf $HOST:~/

# 2. Execução Remota
ssh $SSH_OPTS $HOST << 'EOF'
    set -e
    
    # --- Backend ---
    echo "⚙️ Configurando Backend..."
    mkdir -p ~/supply_app
    tar -xzf backend.tar.gz -C ~/supply_app
    cd ~/supply_app
    sudo docker compose down || true
    sudo docker compose up -d --build
    
    # --- Frontend ---
    echo "🌐 Configurando Frontend..."
    sudo rm -rf /var/www/html/*
    sudo mkdir -p /var/www/html
    sudo tar -xzf ~/frontend.tar.gz -C /var/www/html --strip-components=1
    sudo chown -R www-data:www-data /var/www/html
    
    # --- Nginx ---
    echo "🛡️ Configurando Nginx..."
    sudo cp ~/nginx_supply.conf /etc/nginx/sites-available/default
    sudo nginx -t
    sudo systemctl restart nginx
    
    echo "✅ Deploy concluído com sucesso!"
    sudo docker compose ps
EOF
