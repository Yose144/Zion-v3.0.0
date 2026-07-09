# Pokročilý Setup — ZION v2.9.6

Produkční nasazení ZION nodu s monitoringem a zabezpečením.

---

## Systemd služba

```ini
[Unit]
Description=ZION Core Node
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=zion
Group=zion
ExecStart=/opt/zion/zion-core \
  --data-dir /data/zion \
  --rpc-port 8444 \
  --p2p-port 8334 \
  --network testnet \
  --peers "seed.zionterranova.com:8334"
Restart=always
RestartSec=10
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

```bash
sudo cp zion-core.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now zion-core
sudo journalctl -u zion-core -f
```

---

## Firewall

```bash
sudo ufw allow 8334/tcp comment "ZION P2P"
sudo ufw allow 8444/tcp comment "ZION RPC"
sudo ufw enable
```

Pro pool přidej:

```bash
sudo ufw allow 3333/tcp comment "Stratum"
sudo ufw allow 8080/tcp comment "Pool API"
```

---

## Kernel tuning

```bash
cat >> /etc/sysctl.d/99-zion.conf << EOF
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 1024
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
vm.swappiness = 10
EOF

sudo sysctl --system
```

---

## Monitoring

### Kontrola stavu nodu

```bash
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_info"}' \
  -H 'Content-Type: application/json' | python3 -m json.tool
```

### Jednoduchý health-check skript

```bash
#!/bin/bash
HEIGHT=$(curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_info"}' \
  -H 'Content-Type: application/json' | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['height'])")

echo "Block height: $HEIGHT"

if [ -z "$HEIGHT" ]; then
  echo "CHYBA: Node neodpovídá!"
  systemctl restart zion-core
fi
```

---

## Zabezpečení

- RPC bind na `127.0.0.1:8444` místo `0.0.0.0` v produkci
- SSH autentizace pouze přes klíče
- Pravidelné aktualizace z [GitHub Releases](https://github.com/Zion-TerraNova/2.9.6/releases)
- Logování do souborů s rotací přes logrotate
- Fail2ban pro SSH

---

## Adresářová struktura

```text
/opt/zion/
├── zion-core          # binárka
├── zion-miner         # miner binárka
└── zion-pool          # pool binárka

/data/zion/
├── blockchain/        # chain data (LMDB)
├── p2p/               # peer database
└── logs/              # logy
```

---

## Docker produkční setup

```bash
git clone https://github.com/Zion-TerraNova/2.9.6.git
cd 2.9.6/docker

docker compose -f docker-compose.testnet.yml up -d
docker compose -f docker-compose.testnet.yml logs -f
```

---

*ZION TerraNova v2.9.6*