#!/bin/bash
set -e

echo ">>> [1/5] Cleaning up legacy infrastructure..."
sudo systemctl stop supply-backend || true
sudo systemctl disable supply-backend || true
sudo rm -f /etc/systemd/system/supply-backend.service
sudo systemctl daemon-reload
# Don't delete database to preserve data, but move it to safe location if needed
# mkdir -p backend_data
# sudo cp /home/ubuntu/supply_app/supply.db ./backend_data/ || true

echo ">>> [2/5] Installing Docker Engine..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker ubuntu
    echo "Docker installed. Note: You might need to re-login for group changes to take effect."
else
    echo "Docker already installed."
fi

echo ">>> [3/5] Setting up Docker Compose..."
# Stop existing containers if any
sudo docker compose down || true

echo ">>> [4/5] Building and Starting Containers..."
# Build with no cache to ensure fresh code
sudo docker compose up -d --build --force-recreate

echo ">>> [5/5] Docker Stack is UP!"
sudo docker ps
