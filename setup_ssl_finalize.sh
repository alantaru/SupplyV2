#!/bin/bash
set -e

# Set your domain before running
DOMAIN="YOUR_DOMAIN"

echo "Setting up Nginx Bootstrap..."
sudo cp bootstrap_nginx.conf /etc/nginx/sites-available/default
sudo nginx -t
sudo systemctl reload nginx

echo "Running Certbot..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email --redirect

echo "SSL Setup Complete!"
