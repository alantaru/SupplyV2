#!/bin/bash
set -e

# Configure these variables before running
HOST="ubuntu@YOUR_SERVER_IP"
KEY="supply-key.pem"
SSH_OPTS="-i $KEY -o StrictHostKeyChecking=no"

echo "Retrying Deployment to $HOST..."

echo "Uploading backend files..."
scp $SSH_OPTS backend.tar.gz $HOST:~/backend.tar.gz
scp $SSH_OPTS docker-compose.yml $HOST:~/docker-compose.yml
scp $SSH_OPTS nginx_host_proxy.conf $HOST:~/nginx_host_proxy.conf

echo "Configuring and Starting Backend..."
ssh $SSH_OPTS $HOST << 'EOF'
    set -e
    echo "Unpacking..."
    if [ -d "backend" ]; then
        rm -rf backend
    fi
    tar -xzf backend.tar.gz
    echo "Configuring Nginx..."
    sudo mv -f nginx_host_proxy.conf /etc/nginx/sites-available/default
    sudo nginx -t
    sudo systemctl reload nginx
    echo "Starting Docker containers..."
    sudo docker compose down || true
    sudo docker compose up -d --build
    sudo docker compose ps
EOF

echo "Retry Deployment Finished!"
