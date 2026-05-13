#!/bin/bash
set -e

echo "🛑 Stopping Services..."
sudo systemctl stop supply-api

echo "🧹 Cleaning up old artifacts..."
# Delete all .py files and __pycache__ in root
sudo find /opt/supply -maxdepth 1 -name "*.py" -delete
sudo rm -rf /opt/supply/__pycache__
# Delete the nested backend folder if it exists
sudo rm -rf /opt/supply/backend

echo "⚙️ Extracting fresh Backend..."
# The tarball backend.tar.gz contains the 'backend' folder
# Extracting at /opt/supply/ will create /opt/supply/backend/
sudo tar -xzf ~/backend.tar.gz -C /opt/supply/
sudo chown -R ubuntu:ubuntu /opt/supply/backend

echo "🌐 Deploying Frontend..."
sudo mkdir -p /opt/supply/frontend
sudo rm -rf /opt/supply/frontend/dist
tar -xzf ~/dist.tar.gz -C /tmp/
sudo mv /tmp/frontend/dist /opt/supply/frontend/
sudo chown -R www-data:www-data /opt/supply/frontend

echo "🚀 Restarting Services..."
sudo systemctl start supply-api
sudo cp ~/nginx_supply.conf /etc/nginx/sites-available/default
sudo nginx -t
sudo systemctl restart nginx

echo "✅ Clean Deploy Concluido!"
df -h
