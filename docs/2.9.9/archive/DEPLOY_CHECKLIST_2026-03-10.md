# Deploy Checklist - 2026-03-10

## Release refs

- Website/API stabilization commit: `1ba1650a9185c0d7d6c6f37f9ae1bc218f8f6425`
- Deploy compose-path fix: `eb482bf`
- Target branch: `main`

## 1) Upload to server (local shell)

```powershell
scp -i "$HOME/.ssh/zion_hetzner_key" -r "C:\Users\anaha\Desktop\ZION\2.9.6-main\APP&WEB\website-v2.9" root@91.98.122.165:/root/zion-web-deploy/
scp -i "$HOME/.ssh/zion_hetzner_key" "C:\Users\anaha\Desktop\ZION\2.9.6-main\docker\docker-compose.website.yml" root@91.98.122.165:/root/zion-web-deploy/docker/
ssh -i "$HOME/.ssh/zion_hetzner_key" root@91.98.122.165
```

## 2) Rebuild and restart website (server)

```bash
cd /root/zion-web-deploy
docker network create zion-net 2>/dev/null || true
docker compose -f docker/docker-compose.website.yml build website
docker rm -f zion-website || true
docker compose -f docker/docker-compose.website.yml up -d website
docker ps --filter name=zion-website
```

## 3) Health + smoke checks (server/local)

```bash
curl -sS http://127.0.0.1:3000/api/health
curl -sS http://127.0.0.1:3000/api/v2.9/revenue/config
curl -sS "http://127.0.0.1:3000/api/blockchain/transactions?limit=5"
curl -sS http://127.0.0.1:3000/api/dao/health
```

Manual browser checks:
- `/explorer/transactions`
- `/explorer/tx?hash=<valid_tx_hash>`
- `/admin/revenue-v3`
- `/dao`

## 4) Rollback (if needed)

```bash
cd /root/zion-web-deploy
git checkout HEAD~1 -- docker/docker-compose.website.yml || true
docker compose -f docker/docker-compose.website.yml up -d website
```

Or redeploy previous known-good website source bundle.

## Notes

- Current environment issue in VS Code agent terminal: OpenSSH may fail with `getsockname failed: Not a socket`.
- If that appears, run deploy commands from a normal local terminal (PowerShell/CMD/WSL) outside agent terminal.

## 5) Ekam Deeksha chain rollout (2026-03-11)

Použít pro plný chain reset a re-deploy canonical Ekam Deeksha stacku na `91.98.122.165`.

### Server rebuild

```bash
cd /root/zion-2.9.6
docker compose -f docker/docker-compose.testnet.yml build --no-cache core
docker compose -f docker/docker-compose.testnet.yml build --no-cache pool
docker compose -f docker/docker-compose.testnet.yml build --no-cache miner
```

### Clean reset volumes

```bash
cd /root/zion-2.9.6
docker compose -f docker/docker-compose.testnet.yml down
docker volume rm docker_seed1-testnet-data docker_seed2-testnet-data pool-testnet-data zion-testnet-data
docker volume create zion-testnet-data
docker volume create pool-testnet-data
```

### Start stack

```bash
cd /root/zion-2.9.6
docker compose -f docker/docker-compose.testnet.yml --env-file .env up -d
```

### Critical validation

```bash
curl -s http://localhost:8444/jsonrpc \
	-H "Content-Type: application/json" \
	-d '{"jsonrpc":"2.0","method":"get_info","params":[],"id":1}'

curl -s http://localhost:8080/stats
docker logs zion-miner --tail 20
docker logs zion-pool --tail 20
```

Expected signals:

- core height roste od genesis (`height > 0` během pár minut)
- miner reportuje `algo: cosmic_harmony` a accepted share bez rejectů
- pool log obsahuje `Share ACCEPTED` a následně `BLOCK FOUND`
- Redis je healthy; bez explicitního `--env-file .env` spadne na `requirepass wrong number of arguments`
