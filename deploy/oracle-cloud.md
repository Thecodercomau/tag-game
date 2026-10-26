# Deploy TAG on Oracle Cloud Always Free

This guide runs TAG in Docker behind Caddy with automatic HTTPS on an Oracle Cloud Always Free VM. The VM stays online, so lobbies do not cold-start.

## 1. Create the VM

1. Sign in to the Oracle Cloud Console and open **Compute → Instances → Create instance**.
2. Choose an Always Free-eligible image: **Ubuntu 24.04**.
3. Choose **VM.Standard.A1.Flex** with **1 OCPU** and **6 GB** memory. The 2026 Always Free allowance is up to 2 OCPUs and 12 GB total.
4. Keep the default VCN, public subnet, internet gateway, and **Assign a public IPv4 address**.
5. Download the SSH private key and create the instance.
6. If Oracle reports `Out of host capacity`, retry with another availability domain, reduce the shape, or try `VM.Standard.E2.1.Micro`.

## 2. Open the network

In the instance's VCN, open the public subnet security list and add ingress rules:

| Source | Protocol | Destination port |
| --- | --- | --- |
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |
| `0.0.0.0/0` | UDP | `443` (optional HTTP/3) |

Restrict SSH port `22` to your own IP when possible.

Oracle's Ubuntu images also have host-level iptables rules. SSH into the VM:

```bash
chmod 600 ~/Downloads/ssh-key.key
ssh -i ~/Downloads/ssh-key.key ubuntu@YOUR_PUBLIC_IP
```

Then open the ports before the `REJECT` rule and persist them:

```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT -p udp --dport 443 -j ACCEPT
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt install -y iptables-persistent
sudo netfilter-persistent save
```

## 3. Install Docker

```bash
sudo apt install -y git docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Disconnect and reconnect over SSH so the Docker group applies.

## 4. Deploy the game

```bash
sudo mkdir -p /opt/tag-game
sudo chown "$USER:$USER" /opt/tag-game
git clone https://github.com/Thecodercomau/tag-game.git /opt/tag-game
cd /opt/tag-game

PUBLIC_IP=$(curl -fsS https://ifconfig.me)
DOMAIN="$PUBLIC_IP.sslip.io"
cat > .env <<ENV
DOMAIN=$DOMAIN
ALLOWED_ORIGINS=https://$DOMAIN
PUBLIC_URL=https://$DOMAIN
LAN_ONLY=false
MAX_LOBBIES=100
ENV

docker compose up -d --build
```

`sslip.io` is a free wildcard DNS service. `YOUR_PUBLIC_IP.sslip.io` resolves to the VM, letting Caddy obtain a trusted Let's Encrypt certificate without buying a domain. Replace `DOMAIN` with your own domain later if you have one.

The first build takes a few minutes. Check it:

```bash
docker compose ps
docker compose logs --tail=100 app caddy
curl -fsS "https://$DOMAIN/api/health"
```

Open `https://$DOMAIN` in a browser.

## 5. Updates

```bash
cd /opt/tag-game
git pull
docker compose up -d --build
```

Caddy certificates and configuration are stored in Docker volumes. Containers have `restart: unless-stopped`, so the game comes back after a VM reboot.

## 6. Operations

```bash
docker compose ps
docker compose logs -f app
docker compose logs -f caddy
docker compose restart app
```

Lobbies and matches are in memory. Restarting the app disconnects active players and clears rooms, which is expected.

## Troubleshooting

- **Connection timed out:** open ports at both the OCI security-list level and the VM iptables level.
- **Caddy certificate failure:** confirm `http://$DOMAIN` resolves to the VM public IP and port 80 is reachable. Inspect `docker compose logs caddy`.
- **Site loads but online play fails:** set `ALLOWED_ORIGINS` to the exact HTTPS origin, then run `docker compose up -d`.
- **Instance out of capacity:** try a different availability domain, create a 1 OCPU / 6 GB A1 instance, or fall back to the AMD micro shape.
- **Public IP changed:** update `DOMAIN`, `ALLOWED_ORIGINS`, and `PUBLIC_URL` in `.env`, then rerun `docker compose up -d`. A reserved public IP avoids this.
