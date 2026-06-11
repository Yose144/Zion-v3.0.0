# ZION Genesis #0 — Vecerni Restart Runbook
## 2026-06-10

> **Cil:** Cisty Genesis #0 na Edge + Local. Vsechny nody od height 0, stejny chain.
> **Kluce:** Zalohovany na flash (F:\ZION_V3_MAINNET_WALLETS.txt)

---

## Aktualni stav (pred restartem)

| Sluzba | Status | Poznamka |
|--------|--------|----------|
| Edge Node 1 | height 261 | OK |
| Edge Node 2 | height 315 | **JINY CHAIN** — edge2-state.db nebyl resetovan |
| Edge Pool | 56 bloku, 20.6 KH/s | OK |
| Local Backup Node | height 260 | OK |
| Local Miner | FAIL | payout_address="native-gpu-miner-01" (nevalidni) |
| Bridge / DAO / WARP | LIVE | OK |

**Kriticky problem:** Node 2 ma tip hash `00003ad3...` oproti N1 `00009f80...` — uplne jiny chain. Pricina: `edge2-state.db` nebyl smazan pri poslednim resetu (2026-06-07).

**Miner problem:** Bězi s `miner_id=native-gpu-miner-01` misto `w11-amd-gpu-miner-01`. Posila payout_address=native-gpu-miner-01 misto zion1... adresy. Pool odmita.

**Config problem (opraveno):** Systemd services pouzivaly testnet config misto mainnet:
- Bridge: `bridge-testnet.toml` → `bridge-mainnet.toml` (opraveno)
- Atomic Swap: `swap-testnet.toml` → `swap-mainnet.toml` (opraveno)
- WARP: `warp-testnet.toml` → `warp-mainnet.toml` (novy soubor vytvoren)

**Backup problem (opraveno):** Edge nemel zadny auto-backup mechanismus. Dashboard kontroloval `zion-edge-backup.timer` ktery neexistoval.
- Novy `edge-deploy/scripts/backup-edge.sh` — zalohuje vsechny DB + config + systemd
- Novy `zion-edge-backup.service` + `.timer` (denni 03:00)
- Pridano do `setup-edge.sh`

---

## Pred-startovni kontrola = OK

| Polozka | Hodnota | Status |
|---------|---------|--------|
| Genesis premine | 14 outputs, 16.78B ZION | OK |
| Fee split | 89/5/5/1 (1% pool burn) | OK |
| Pool wallet | zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604 | OK |
| Humanitarian | zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4 | OK |
| Issobella | zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702 | OK |
| Default miner | zion1w523a76830x2t5m7f3j023w265e8g5c400a4790 | OK |
| Pool payout SK | v edge-environment.sh | OK (flash backup) |
| Genesis timestamp | 1_767_225_600 (2026-01-01) — frozen | OK |

---

## Krok 0: Zalohovat vse PRED resetem (Edge + Local)

**PRED kazdym mazanim DB udej plnou zalohu!**

### Edge:
```bash
ssh root@100.76.16.108

# Manualni plna zaloha (pokud timer jeste nebezi)
/root/zion-2.9.6-main/edge-deploy/scripts/backup-edge.sh

# Nebo pokud je timer aktivni:
systemctl start zion-edge-backup.service

# Overit zalohu:
ls -la /root/zion-backups/daily/
```

### Local PC:
```powershell
# Auto-backup (kopiruje DB + config do C:\ZION-AutoBackups)
cd "C:\Users\yosef\Desktop\Zion\2.9.6-main"
powershell -ExecutionPolicy Bypass -File scripts\auto-backup-all.ps1

# Nebo jen chain data:
powershell -ExecutionPolicy Bypass -File scripts\backup-chain.ps1 -IncludeLogs -IncludeEnv

# Overit zalohy:
ls C:\ZION-AutoBackups\zion-auto-*.zip | sort LastWriteTime
```

---

## Krok 1: Zastavit vse (Edge server)

```bash
ssh root@100.76.16.108

systemctl stop zion-edge-pool zion-edge-node2 zion-edge-node1 \
  zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp \
  zion-edge-watchdog zion-edge-agent zion-edge-dashboard zion-edge-miner

# Overit ze nic nebezi:
systemctl status zion-edge-node1 zion-edge-node2 zion-edge-pool | grep Active
```

---

## Krok 2: Smazat vsechny DB (Edge)

```bash
# Zaloha (jen pro jistotu, i kdyz jde o testovaci data)
mkdir -p /root/zion-backups/genesis-reset-$(date +%Y%m%d-%H%M%S)
cp /root/zion-2.9.6-main/data/*.db /root/zion-backups/genesis-reset-$(date +%Y%m%d-%H%M%S)/ 2>/dev/null || true
cp /root/zion-2.9.6-main/V3/data/*.db /root/zion-backups/genesis-reset-$(date +%Y%m%d-%H%M%S)/ 2>/dev/null || true

# Node DB
rm -f /root/zion-2.9.6-main/data/edge-state.db
rm -f /root/zion-2.9.6-main/data/edge-state.db-shm
rm -f /root/zion-2.9.6-main/data/edge-state.db-wal
rm -f /root/zion-2.9.6-main/data/edge2-state.db          # <-- TOTO BYLO CHYBEJICI!
rm -f /root/zion-2.9.6-main/data/edge2-state.db-shm
rm -f /root/zion-2.9.6-main/data/edge2-state.db-wal

# Bridge / DAO / WARP / Pool SQLite
rm -f /root/zion-2.9.6-main/V3/data/*.db
rm -f /root/zion-2.9.6-main/V3/data/*.db-shm
rm -f /root/zion-2.9.6-main/V3/data/*.db-wal

# Pool state (PPLNS window, shares history)
rm -f /root/zion-2.9.6-main/data/pool-state.json 2>/dev/null || true

# Overit ze je cisto:
ls -la /root/zion-2.9.6-main/data/
ls -la /root/zion-2.9.6-main/V3/data/
```

---

## Krok 3: Build na Edge

```bash
cd /root/zion-2.9.6-main

git pull origin main
git log --oneline -1

cd V3
cargo build --release --workspace

# Overit binarky:
ls -la target/release/node target/release/server target/release/zion-miner \
  target/release/zion-bridge target/release/zion-dao \
  target/release/zion-atomic-swap target/release/zion-warp-server
```

> **POZOR:** Pool a miner binarky MUSI byt z stejneho buildu — protocol neni backward compatible.

---

## Krok 4: Start Genesis sekvence (Edge)

```bash
# 1. Node 1 (Primary / Genesis)
systemctl start zion-edge-node1
sleep 5
journalctl -u zion-edge-node1 --no-pager -n 30

# Overit Genesis #0:
curl -s -X POST http://127.0.0.1:8443/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}'
# Expected: height=0, accepted_blocks=1, tip_hash=...

# 2. Node 2 (Follower)
systemctl start zion-edge-node2
sleep 5

# Overit ze Node 2 syncuje z Node 1:
curl -s -X POST http://127.0.0.1:8446/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}'
# Expected: height=0 (nebo stejne jako N1)

# 3. Pool
systemctl start zion-edge-pool
sleep 3

# Overit pool metrics:
curl -s http://127.0.0.1:8455/metrics | grep zion_pool_active_sessions

# 4. L2/L3 sluzby
systemctl start zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp

# 5. Agent + Dashboard
systemctl start zion-edge-agent zion-edge-dashboard

# 6. Edge miner (pokud bezi primo na Edge)
systemctl start zion-edge-miner 2>/dev/null || true
```

---

## Krok 5: Local PC (Core) reset

Na Windows PowerShell (nebo CMD):

```powershell
# 1. Zastavit local backup node
# (pokud bezi jako sluzba nebo v okne)

# 2. Smazat local DB
Remove-Item -Path "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\data\zion-node-state.db" -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\data\zion-node-state.db-shm" -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\data\zion-node-state.db-wal" -ErrorAction SilentlyContinue

# 3. Zastavit a restartovat miner
# Zavri okno se starym minerem (native-gpu-miner-01)
# Spust nove:
cd "C:\Users\yosef\Desktop\Zion\2.9.6-main"
.\restart-miner-gpu.bat

# 4. Start local backup node
# (pokud mas start-node.bat / start-node.ps1)
.\start-node-window.bat
# nebo
$env:ZION_NODE_ID='local-backup-node'
$env:ZION_P2P_BIND='0.0.0.0:8333'
$env:ZION_RPC_BIND='0.0.0.0:8443'
$env:ZION_NODE_STATE_PATH='V3/data/zion-node-state.db'
$env:ZION_SEED_PEERS='100.76.16.108:8333'
$env:ZION_MINER_ADDRESS='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'
$env:ZION_HUMANITARIAN_WALLET='zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4'
$env:ZION_ISSOBELLA_WALLET='zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702'
cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin node
```

---

## Krok 6: Overeni po restartu

### Edge:
```bash
# Oba nody musi mit stejny height a tip hash
curl -s -X POST http://127.0.0.1:8443/rpc -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}'
curl -s -X POST http://127.0.0.1:8446/rpc -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}'

# Pool musi acceptovat connections
curl -s http://127.0.0.1:8455/metrics | grep "zion_pool_active_sessions\|zion_pool_blocks_found"
```

### Local (dashboard):
```bash
# Dashboard bezi na http://127.0.0.1:8766
curl -s http://127.0.0.1:8766/api/readiness | python -m json.tool
```

Expected:
- `score` = 100 (vsechny checks OK)
- `edge_node.chain_height` = `edge_node2.chain_height` = `node1.chain_height`
- `pool.blocks_found` = 0 (zaciname od nuly)
- `miner.shares_accepted` > 0 (miner musi prijimat shares)

---

## Seznam DB souboru ke smazani

| Host | Cesta | Popis |
|------|-------|-------|
| Edge | `/root/zion-2.9.6-main/data/edge-state.db` | Node 1 Primary |
| Edge | `/root/zion-2.9.6-main/data/edge2-state.db` | Node 2 Follower (TENTO CHYBELO!) |
| Edge | `/root/zion-2.9.6-main/V3/data/*.db` | Bridge, DAO, WARP, Pool |
| Local | `V3/data/zion-node-state.db` | Local Backup Node |
| Local | `V3/data/*.db` | Ostatni local SQLite |

---

## Seznam systemd sluzeb (Edge)

```
zion-edge-node1       (Primary / Genesis)
zion-edge-node2       (Follower)
zion-edge-pool        (Stratum pool)
zion-edge-bridge      (L2 Bridge)
zion-edge-dao         (L2 DAO)
zion-edge-atomic-swap (L2 Atomic Swap)
zion-edge-warp        (L3 WARP)
zion-edge-agent       (Rig lifecycle)
zion-edge-dashboard   (Infra dashboard 8888)
zion-edge-miner       (Edge miner, pokud existuje)
zion-edge-watchdog    (Health monitor)
zion-edge-backup      (Daily DB+config backup 03:00)
```

> **POZOR:** Pokud `zion-edge-backup` jeste neni nainstalovany na Edge, udej to:
> ```bash
> cd /root/zion-2.9.6-main
> ./edge-deploy/setup-edge.sh   # nainstaluje vse vcetne backup timeru
> systemctl enable --now zion-edge-backup.timer
> ```

---

## Poznamky

- **Genesis timestamp** je frozen na 2026-01-01 — nemeni se. Vsechny nody musi mit stejnou hodnotu.
- **Fee split** je v kodu (89/5/5/1), v env nastav `ZION_POOL_FEE_PCT=0` aby pool nededukoval 2x.
- **Pool** a **miner** musi byt z stejneho buildu.
- **Node 2** se pripojuje k Node 1 pres `127.0.0.1:8333` (localhost P2P).
- **Local backup** se pripojuje pres Tailscale `100.76.16.108:8333`.

---

*Runbook vygenerovan pro Genesis #0 restart 2026-06-10.*
