#!/bin/bash
set -e

echo "Installing Nginx and Certbot..."
sudo DEBIAN_FRONTEND=noninteractive apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx

sudo systemctl enable nginx
sudo systemctl start nginx

echo "Nginx setup complete."
