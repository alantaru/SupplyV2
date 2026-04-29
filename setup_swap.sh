#!/bin/bash
set -e
if grep -q "swapfile" /proc/swaps; then
    echo "Swap already active."
    exit 0
fi
echo "Creating 2GB Swapfile..."
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo "Swap enabled!"
free -h
