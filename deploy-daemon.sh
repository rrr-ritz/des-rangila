#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# Des Rangila — Face-Matching Daemon EC2 Deployment
# ──────────────────────────────────────────────────────────────────────────────
#
# Prerequisites:
#   1. AWS CLI configured with appropriate credentials
#   2. A Firebase service account key (serviceAccountKey.json) with
#      Firestore and Cloud Storage permissions
#   3. An EC2 key pair for SSH access
#
# Instance recommendation:
#   - Type: t3.medium (2 vCPU, 4GB RAM) — InsightFace needs ~1.5GB
#   - AMI: Ubuntu 22.04 LTS (ami-0c7217cdde317cfec in us-east-1)
#   - Spot instance is fine for a single evening event
#   - Storage: 20GB gp3 (model is ~300MB, Docker images ~2GB)
#
# ──────────────────────────────────────────────────────────────────────────────

set -e

# ── Step 1: Launch EC2 instance ──────────────────────────────────────────────
# (Do this via AWS Console or CLI — example below)
#
# aws ec2 run-instances \
#   --image-id ami-0c7217cdde317cfec \
#   --instance-type t3.medium \
#   --key-name your-key-pair \
#   --security-group-ids sg-xxx \
#   --instance-market-options '{"MarketType":"spot"}' \
#   --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp3"}}]' \
#   --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=des-rangila-face-daemon}]'

# ── Step 2: SSH in and install Docker ────────────────────────────────────────
# ssh -i your-key.pem ubuntu@<instance-ip>

sudo apt-get update
sudo apt-get install -y docker.io
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu

# ── Step 3: Copy files to EC2 ───────────────────────────────────────────────
# From your local machine:
#
# scp -i your-key.pem Dockerfile ubuntu@<instance-ip>:~/
# scp -i your-key.pem requirements-daemon.txt ubuntu@<instance-ip>:~/
# scp -i your-key.pem scripts/match-daemon.py ubuntu@<instance-ip>:~/scripts/
# scp -i your-key.pem serviceAccountKey.json ubuntu@<instance-ip>:~/creds/sa.json
#
# On the EC2 instance, create the directory structure:
mkdir -p ~/scripts ~/creds

# ── Step 4: Build Docker image ──────────────────────────────────────────────
sudo docker build -t face-daemon .

# ── Step 5: Run the daemon ──────────────────────────────────────────────────
sudo docker run -d \
  --restart unless-stopped \
  --name face-daemon \
  -e GOOGLE_APPLICATION_CREDENTIALS=/creds/sa.json \
  -v ~/creds/sa.json:/creds/sa.json:ro \
  face-daemon

# ── Monitoring ──────────────────────────────────────────────────────────────
# View logs:
#   sudo docker logs -f face-daemon
#
# Check status:
#   sudo docker ps
#
# Restart:
#   sudo docker restart face-daemon
#
# Stop:
#   sudo docker stop face-daemon

# ── Teardown (after event) ──────────────────────────────────────────────────
# sudo docker stop face-daemon
# sudo docker rm face-daemon
# Then terminate the EC2 instance via AWS Console
