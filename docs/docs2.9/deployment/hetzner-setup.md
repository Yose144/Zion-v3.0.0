# Hetzner Server Setup - Krok po kroku

## 1. Prvé prihlásenie a základná bezpečnosť

### Prihlás sa na server
```bash
ssh root@<tvoja-server-ip>
```

### Aktualizuj systém
```bash
apt update && apt upgrade -y
```

### Vytvor nového používateľa (bezpečnejšie než root)
```bash
# Vytvor používateľa
adduser zion

# Pridaj do sudo skupiny
usermod -aG sudo zion

# Prepni sa na nového používateľa
su - zion
```

## 2. Nastavenie Firewall (UFW)

### Inštaluj a nastav UFW
```bash
# Inštaluj UFW ak nie je
sudo apt install ufw -y

# Základné pravidlá - POZOR na SSH!
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH - DÔLEŽITÉ! Inak sa zamkneš
sudo ufw allow 22/tcp
# Alebo ak používaš iný SSH port:
# sudo ufw allow 2222/tcp

# Pre Zion Pool Server
sudo ufw allow 3333/tcp   # Stratum pool port
sudo ufw allow 18081/tcp  # P2P port
sudo ufw allow 18080/tcp  # RPC port (voliteľné - môžeš nechať zatvorené)

# Pre web monitoring (ak budeš používať)
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 3000/tcp   # Grafana (voliteľné)

# Aktivuj firewall
sudo ufw --force enable

# Skontroluj status
sudo ufw status verbose
```

## 3. Hetzner Cloud Firewall (v konzole)

Prihlás sa do Hetzner Cloud Console a nastav firewall:

### Vytvor Firewall pravidlá:

**Inbound Rules:**
```
SSH         | TCP | 22    | 0.0.0.0/0  | Povolené
Stratum     | TCP | 3333  | 0.0.0.0/0  | Povolené  
P2P         | TCP | 18081 | 0.0.0.0/0  | Povolené
HTTP        | TCP | 80    | 0.0.0.0/0  | Povolené
HTTPS       | TCP | 443   | 0.0.0.0/0  | Povolené
```

**Outbound Rules:**
```
All Traffic | Any | Any   | 0.0.0.0/0  | Povolené
```

## 4. Inštalácia Docker

```bash
# Rýchla inštalácia Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Pridaj používateľa do docker skupiny
sudo usermod -aG docker zion

# Odhlás sa a prihlás znova (alebo použi newgrp)
newgrp docker

# Over že Docker funguje
docker --version
docker ps
```

## 5. Inštalácia Docker Compose

```bash
# Stiahni najnovšiu verziu
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Nastav práva
sudo chmod +x /usr/local/bin/docker-compose

# Over inštaláciu
docker-compose --version
```

## 6. Deploy Zion Pool

### Možnosť A: Automatický deploy script
```bash
# Stiahni a spusti deployment script
curl -sSL https://raw.githubusercontent.com/Yose144/Zion/master/docker/deploy.sh -o deploy.sh
chmod +x deploy.sh
./deploy.sh pool
```

### Možnosť B: Manuálny deploy
```bash
# Vytvor adresár pre projekt
sudo mkdir -p /opt/zion
sudo chown -R zion:zion /opt/zion
cd /opt/zion

# Klonuj repository
git clone https://github.com/Yose144/Zion.git .
git submodule update --init --recursive

# Vytvor data adresáre
mkdir -p data/pool logs/pool

# Build Docker image
docker build -t zion:latest .

# Vytvor .env súbor
cat > .env <<EOF
POOL_FEE=1
POOL_DIFFICULTY=1000
SEED_NODES=""
EOF

# Spusti pool server
docker-compose -f docker-compose.prod.yml up -d pool
```

## 7. Nastavenie systemd service (voliteľné)

Vytvor systemd service pre automatický štart:

```bash
sudo tee /etc/systemd/system/zion-pool.service <<EOF
[Unit]
Description=Zion Mining Pool
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=zion
Group=zion
WorkingDirectory=/opt/zion
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d pool
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
ExecReload=/usr/local/bin/docker-compose -f docker-compose.prod.yml restart pool

[Install]
WantedBy=multi-user.target
EOF

# Aktivuj a spusti service
sudo systemctl daemon-reload
sudo systemctl enable zion-pool.service
sudo systemctl start zion-pool.service
sudo systemctl status zion-pool.service
```

## 8. Monitoring a logs

### Sleduj logs
```bash
# Real-time logs
docker logs -f zion-pool

# Posledných 100 riadkov
docker logs --tail 100 zion-pool

# S časovými značkami
docker logs -t zion-pool
```

### Skontroluj či pool beží
```bash
# Docker status
docker ps

# Test stratum portu
nc -zv localhost 3333

# Test P2P portu
nc -zv localhost 18081

# Systemd status (ak používaš)
sudo systemctl status zion-pool
```

## 9. SSL/HTTPS s Let's Encrypt (voliteľné)

Pre web dashboard alebo API:

```bash
# Inštaluj Certbot
sudo apt install certbot python3-certbot-nginx -y

# Získaj certifikát
sudo certbot certonly --standalone -d pool.tvoja-domena.com

# Alebo s nginx
sudo certbot --nginx -d pool.tvoja-domena.com
```

## 10. Zálohovanie

### Vytvor backup script
```bash
cat > /home/zion/backup.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/home/zion/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup blockchain data
docker run --rm \
  -v zion_pool-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/zion-backup-$DATE.tar.gz /data

# Zachovaj len posledných 7 backupov
ls -t $BACKUP_DIR/zion-backup-*.tar.gz | tail -n +8 | xargs -r rm

echo "Backup completed: zion-backup-$DATE.tar.gz"
EOF

chmod +x /home/zion/backup.sh
```

### Nastav cron pre automatické zálohy
```bash
# Otvor crontab
crontab -e

# Pridaj denné zálohy o 3:00
0 3 * * * /home/zion/backup.sh >> /home/zion/backup.log 2>&1
```

## 11. Bezpečnostné odporúčania

### Zmeň SSH port (voliteľné ale odporúčané)
```bash
# Edituj SSH config
sudo nano /etc/ssh/sshd_config

# Zmeň port
Port 2222  # alebo iný

# Zakáž root login
PermitRootLogin no

# Povoľ len key authentication
PasswordAuthentication no

# Reštartuj SSH
sudo systemctl restart sshd
```

### Nastav SSH kľúče
```bash
# Na tvojom lokálnom počítači
ssh-keygen -t ed25519 -C "zion@hetzner"

# Skopíruj public key na server
ssh-copy-id -i ~/.ssh/id_ed25519.pub zion@<server-ip>
```

### Fail2ban pre ochranu proti brute-force
```bash
sudo apt install fail2ban -y

# Vytvor lokálnu konfiguráciu
sudo tee /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF

sudo systemctl restart fail2ban
sudo systemctl status fail2ban
```

## 12. Finálna kontrola

```bash
# Skontroluj všetky služby
sudo systemctl status
docker ps
sudo ufw status

# Skontroluj porty
sudo netstat -tlnp

# Skontroluj miesto na disku
df -h

# Skontroluj využitie RAM
free -h

# Skontroluj CPU
htop
```

## Testovanie Pool servera

Z lokálneho počítača:

```bash
# Test stratum spojenia
nc -zv <server-ip> 3333

# Test s telnetom
telnet <server-ip> 3333

# Alebo curl test
curl -X POST http://<server-ip>:3333 \
  -H "Content-Type: application/json" \
  -d '{"method":"login","params":{"user":"test","pass":"x"},"id":1}'
```

## Troubleshooting

### Ak sa niečo pokazí:

```bash
# Reštartuj Docker
sudo systemctl restart docker

# Reštartuj kontajner
docker restart zion-pool

# Vymaž a znova vytvor kontajner
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d pool

# Skontroluj logy
docker logs zion-pool --tail 200

# Skontroluj systémové logy
sudo journalctl -xe
```

## Dôležité IP adresy a porty

Po nastavení budeš mať:

- **SSH**: `<server-ip>:22` (alebo tvoj custom port)
- **Stratum Pool**: `<server-ip>:3333`
- **P2P Network**: `<server-ip>:18081`
- **RPC API**: `<server-ip>:18080` (ak povolené)
- **Grafana**: `<server-ip>:3000` (ak nainštalované)

## Pripojenie minerov

Mineri sa môžu pripojiť:
```
stratum+tcp://<server-ip>:3333
```

---

**HOTOVO! Tvoj Zion pool server je pripravený! 🚀**