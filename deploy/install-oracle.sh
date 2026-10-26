#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Thecodercomau/tag-game.git}"
APP_DIR="${APP_DIR:-/opt/tag-game}"
PUBLIC_IP="${PUBLIC_IP:-}"
RESET_DOMAIN="${RESET_DOMAIN:-0}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git iptables iptables-persistent docker.io docker-compose-v2
systemctl enable --now docker

iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 80 -j ACCEPT
iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 443 -j ACCEPT
iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT -p udp --dport 443 -j ACCEPT
netfilter-persistent save

if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" pull --ff-only
elif [[ -e "$APP_DIR" ]]; then
  echo "$APP_DIR exists but is not a Git checkout." >&2
  exit 1
else
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [[ ! -f .env || "$RESET_DOMAIN" == "1" ]]; then
  if [[ -z "$PUBLIC_IP" ]]; then
    PUBLIC_IP="$(curl -4fsS https://api.ipify.org)"
  fi
  DOMAIN_VALUE="${DOMAIN:-$PUBLIC_IP.sslip.io}"
  cat > .env <<ENV
DOMAIN=$DOMAIN_VALUE
ALLOWED_ORIGINS=https://$DOMAIN_VALUE
PUBLIC_URL=https://$DOMAIN_VALUE
LAN_ONLY=false
MAX_LOBBIES=100
ENV
fi

set -a
. ./.env
set +a

docker compose up -d --build

for _ in $(seq 1 90); do
  if curl -fsS "https://$DOMAIN/api/health" >/dev/null 2>&1; then
    echo "TAG is live at https://$DOMAIN"
    exit 0
  fi
  sleep 2
done

echo "TAG did not become healthy at https://$DOMAIN." >&2
echo "Check the firewall and logs with: cd $APP_DIR && docker compose logs --tail=100 app caddy" >&2
exit 1
