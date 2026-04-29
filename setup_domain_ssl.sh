#!/bin/bash

# Set your domain before running
DOMAIN="YOUR_DOMAIN"

echo "--- Installing Certbot ---"
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

echo "--- Configuring Nginx for Domain ---"
cat <<EOF | sudo tee /etc/nginx/sites-available/default
server {
    listen 80;
    server_name $DOMAIN;
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;

    root /var/www/html;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo nginx -t && sudo systemctl reload nginx

echo "--- Requesting Certificate ---"
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email --redirect

echo "--- Setup Complete ---"
