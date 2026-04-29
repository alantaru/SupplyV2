#!/bin/bash

# 1. Setup Frontend
sudo rm -rf /var/www/html/*
if [ -d "/home/ubuntu/frontend_dist" ]; then
    sudo cp -r /home/ubuntu/frontend_dist/* /var/www/html/
    sudo chown -R www-data:www-data /var/www/html
    echo "Frontend deployed to /var/www/html"
else
    echo "WARNING: frontend_dist not found!"
fi

# 2. Generate Self-Signed SSL
sudo mkdir -p /etc/ssl/private
sudo mkdir -p /etc/ssl/certs
sudo openssl req -x509 -nodes -days 36500 -newkey rsa:2048 \
    -keyout /etc/ssl/private/supply_selfsigned.key \
    -out /etc/ssl/certs/supply_selfsigned.crt \
    -subj "/C=BR/ST=MinasGerais/L=YourCity/O=YourOrg/OU=IT/CN=YOUR_SERVER_IP"
echo "SSL Generated"
