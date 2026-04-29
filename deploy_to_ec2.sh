#!/bin/bash
set -e

# Configure these variables before running
HOST="ubuntu@YOUR_SERVER_IP"
KEY="supply-key.pem"
SSH_OPTS="-i $KEY -o StrictHostKeyChecking=no"

echo "Deploying to $HOST..."

# 1. Setup Nginx
echo "Uploading and running Nginx setup..."
scp $SSH_OPTS setup_nginx.sh $HOST:~/setup_nginx.sh
ssh $SSH_OPTS $HOST "chmod +x ~/setup_nginx.sh && ~/setup_nginx.sh"

# 2. Upload Backend Files
echo "Uploading backend files..."
scp $SSH_OPTS backend.tar.gz docker-compose.yml nginx_host_proxy.conf $HOST:~/

# 3. Configure and Start
echo "Configuring and Starting Backend..."
ssh $SSH_OPTS $HOST << 'EOF'
    set -e
    if [ -d "backend" ]; then
        rm -rf backend
    fi
    tar -xzf backend.tar.gz
    sudo mv nginx_host_proxy.conf /etc/nginx/sites-available/default
    sudo nginx -t
    sudo systemctl reload nginx
    sudo docker compose down || true
    sudo docker compose up -d --build
    sudo docker compose ps
    sudo systemctl status nginx --no-pager
EOF

echo "Deployment Finished!"
