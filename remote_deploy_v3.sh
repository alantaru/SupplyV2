#!/bin/bash
# Robust NVM Loader
export NVM_DIR="/home/ubuntu/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20 || nvm use node || nvm use default || true

set -e

echo "⚙️ Deploying Backend (Systemd)..."
# Unpack backend directly into /opt/supply
sudo tar -xzf ~/backend.tar.gz -C /opt/supply/ --strip-components=1

# Restart service
sudo systemctl restart supply-api

echo "🌐 Deploying Frontend (Remote Build)..."
cd ~
sudo rm -rf ~/frontend_build
mkdir -p ~/frontend_build
tar -xzf ~/frontend_src.tar.gz -C ~/frontend_build
cd ~/frontend_build/frontend
npm install --no-package-lock --prefer-offline --no-audit --no-fund
npm run build

echo "🛡️ Finalizing Frontend..."
sudo mkdir -p /opt/supply/frontend
sudo rm -rf /opt/supply/frontend/dist
sudo cp -r dist /opt/supply/frontend/
sudo chown -R www-data:www-data /opt/supply/frontend

# CLEANUP
echo "🧹 Post-build cleanup..."
cd ~
rm -rf ~/frontend_build
rm -f ~/backend.tar.gz ~/frontend_src.tar.gz

# Nginx config
sudo cp ~/nginx_supply.conf /etc/nginx/sites-available/default
sudo nginx -t
sudo systemctl restart nginx

echo "✅ Deploy Concluido!"
df -h
