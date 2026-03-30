# Migrace na Ubuntu (lokální PC)

Cíl: Připravit Ubuntu (desktop/laptop) tak, aby šlo jednoduše spustit ZION v2.6 (docker-compose prod nebo lokální profil runtime).

## Požadavky
- Ubuntu 22.04+ (doporučeno 24.04 LTS)
- Síť: otevřené porty 18080 (P2P), volitelně 18081 (RPC interně), pool port (3333/3334) pokud používáte pool

## Krok 1 – Základní nástroje
```
# Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
# Git
sudo apt update && sudo apt install -y git
# Node.js LTS (volitelně pro adapter/front)
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```
Poté se odhlaste a znovu přihlaste (kvůli členství ve skupině `docker`).

## Krok 2 – Klon repozitáře
```
mkdir -p ~/work && cd ~/work
git clone https://github.com/Maitreya-ZionNet/Zion-2.6-TestNet.git zion
cd zion
```

## Krok 3 – .env
- Zkopírujte `.env.example` na `.env` a nastavte hodnoty dle potřeby.
- Pokud chcete RPC jen interně, ponechte `ZION_RPC_BIND=127.0.0.1`.
- Pro pool nastavte `POOL_PORT` (vyhněte se konfliktům, např. 3334).

## Krok 4 – Spuštění
```
# čisté prostředí
docker compose -f docker-compose.prod.yml down --remove-orphans || true
# spuštění nodu + pool (profil pool)
docker compose -f docker-compose.prod.yml --profile pool up -d
# ověření běhu
sleep 15
docker ps
# interní RPC health
docker exec zion-production sh -lc "curl -s http://127.0.0.1:18081/getinfo" | jq . || true
```

## Krok 5 – Firewall
```
sudo ufw allow 18080/tcp comment 'ZION P2P'
# pokud používáte pool na 3334
sudo ufw allow 3334/tcp comment 'ZION Pool'
```

## Krok 6 – Adapter (volitelné)
```
cd adapters/wallet-adapter
npm ci --no-audit --no-fund
# vytvořte .env dle .env.example (API key, CORS, …)
npm run start
```

## Odinstalace / cleanup
```
docker compose -f docker-compose.prod.yml down --remove-orphans
docker volume rm zion-repo_zion_data zion-repo_zion_pool_data
```
