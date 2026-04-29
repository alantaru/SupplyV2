#!/bin/bash
echo "Starting Supply App..."
cd ~/supply_app
sudo swapon --show
sudo docker compose up -d --build
sudo mv -f nginx_host_proxy.conf /etc/nginx/sites-available/default 2>/dev/null || true
sudo systemctl reload nginx
echo "Deployment Complete! Check https://YOUR_DOMAIN"
