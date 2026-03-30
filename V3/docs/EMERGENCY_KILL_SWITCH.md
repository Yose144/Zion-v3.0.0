# ZION V3 — Emergency Kill-Switch Procedure

Status: 2026-03-27  
Autor: Yose144 + AI Native  
Go/No-Go checklist #9

---

## Úrovně eskalace

| Stupeň | Situace | Akce |
|--------|---------|------|
| **L1** | Konkrétní node je nestabilní | Restart kontejneru |
| **L2** | Síť produkuje nevalidní bloky | Stop mining, keep nodes |
| **L3** | Konsenzus selhání / chain split | Stop ALL nodes |
| **L4** | Kritická bezpečnostní zranitelnost | Full shutdown + DNS kill |

---

## L1 — Restart konkrétního služby

```bash
# Na postiženém serveru:
ssh zion-primary   # nebo zion-mainnet / zion-us / zion-sg

# Restart jednoho kontejneru
docker compose -f docker/docker-compose.v3-mainnet.yml restart core

# Podrobný log pro diagnostiku
docker logs --tail 100 -f zion-core
```

## L2 — Stop mining, ponechat nodes

```bash
# Na VŠECH serverech:
for host in zion-primary zion-mainnet zion-us zion-sg; do
  ssh $host "cd /root/zion-2.9.6 && docker compose -f docker/docker-compose.v3-mainnet.yml stop miner pool"
done

# Monitorovat chain:
ssh zion-primary "docker exec zion-core sh -c \"echo '{\\\"jsonrpc\\\":\\\"2.0\\\",\\\"method\\\":\\\"getChainInfo\\\",\\\"id\\\":1}' | nc -w2 127.0.0.1 8443\""
```

## L3 — Full chain stop

```bash
# Na VŠECH serverech — zastavit celý stack:
for host in zion-primary zion-mainnet zion-us zion-sg; do
  ssh $host "cd /root/zion-2.9.6 && docker compose -f docker/docker-compose.v3-mainnet.yml down"
done

# Ověřit, že nic neběží:
for host in zion-primary zion-mainnet zion-us zion-sg; do
  echo "=== $host ==="
  ssh $host "docker ps --format '{{.Names}} {{.Status}}'"
done
```

## L4 — Full shutdown + DNS kill

```bash
# 1. Stop ALL nodes (viz L3)

# 2. Zablokovat P2P port na firewallu (ufw)
for host in zion-primary zion-mainnet zion-us zion-sg; do
  ssh $host "ufw deny 8333/tcp && ufw deny 8334/tcp && ufw reload"
done

# 3. Odstranit DNS seed záznamy
# V Hetzner DNS panelu smazat:
#   seed-eu1.zionchain.org
#   seed-us1.zionchain.org
#   seed-us2.zionchain.org
#   seed-ap1.zionchain.org

# 4. Oznámení komunitě
# → Discord #announcements
# → Website banner
```

---

## Recovery postup (po opravě)

1. Aplikovat fix do kódu, `cargo test --workspace`
2. Rebuild Docker images: `docker compose build --no-cache`
3. Obnovit firewall: `ufw allow 8333/tcp && ufw allow 8334/tcp`
4. Start stack: `docker compose up -d`
5. Ověřit chain sync mezi nodes
6. Obnovit DNS seed záznamy
7. Restart mining: `docker compose up -d miner pool`

---

## Kontakty

| Role | Kdo | Kanál |
|------|-----|-------|
| Lead Developer | Yose144 | Discord DM / SSH |
| Infrastructure | Yose144 | SSH `zion-primary` |

---

## Quick-reference příkazy

```bash
# Chain height na node:
echo '{"jsonrpc":"2.0","method":"getChainInfo","id":1}' | nc -w2 <IP> 8443

# Peer list:
echo '{"jsonrpc":"2.0","method":"getPeerInfo","id":1}' | nc -w2 <IP> 8443

# Mempool stav:
echo '{"jsonrpc":"2.0","method":"getMempoolInfo","id":1}' | nc -w2 <IP> 8443

# Prometheus metriky:
curl http://<IP>:9115/metrics

# Health endpoint:
curl http://<IP>:9115/health
```
