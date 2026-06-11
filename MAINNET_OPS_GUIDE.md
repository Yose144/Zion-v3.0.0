# ZION Mainnet — Operational Guide

> **Date:** 2026-06-11
> **Topology:** Edge (Hetzner VPS 77.42.71.94) + Local W11 (Core sync node)
> **Chain height:** ~100 blocks (post-genesis reset)
> **Version:** v3.0.1

This document consolidates operational knowledge from the 2026-06-11 session: genesis reset, Edge miner deployment, backup infrastructure, and troubleshooting procedures.

---

## 1. Live Network Topology

```
┌─────────────────────────────────────────────────────────────────┐
│  Edge Server (Hetzner VPS)                                      │
│  77.42.71.94  |  Tailscale: 100.76.16.108                       │
│                                                                 │
│  ├─ zion-edge-node1    P2P 8333  RPC 8443   (primary/genesis) │
│  ├─ zion-edge-node2    P2P 8334  RPC 8446   (follower/sync)   │
│  ├─ zion-edge-pool     Stratum 8444          (public pool)     │
│  ├─ zion-edge-miner    CPU, 2 cores, deeksha_lite_v1           │
│  ├─ zion-edge-bridge   L1↔EVM relay                            │
│  ├─ zion-edge-dao      Governance API                          │
│  ├─ zion-edge-warp     Cross-chain relay                       │
│  ├─ zion-edge-atomic-swap  HTLC daemon                        │
│  └─ zion-edge-backup   Timer every 15 min                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ P2P 8333 / RPC 8443
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Local Windows 11 (ZIONSERVER)                                  │
│  100.86.102.5  |  Tailscale VPN                                │
│                                                                 │
│  ├─ zion-node          P2P 8333  RPC 8443   (sync only)        │
│  ├─ zion-dashboard     Flask http://127.0.0.1:8766             │
│  ├─ zion-backup        PowerShell auto-backup                  │
│  └─ zion-miner         GPU (AMD RX 5700 XT) — currently OFF    │
└─────────────────────────────────────────────────────────────────┘
```

### Seed peers
- Edge node1 connects to: `100.86.102.5:8333` (local W11)
- Local node connects to: `77.42.71.94:8333` (Edge)
- Edge node2 connects to: `127.0.0.1:8333` (node1 localhost)

---

## 2. Genesis Reset Procedure

If the chain ever needs a hard reset to genesis #0, follow these steps **exactly**:

### 2.1 Pre-requisites
1. **Stop ALL miners** on both sides (`killminers`)
2. **Stop ALL pools** (Edge + local)
3. Verify no `node.exe` is running on W11 (check Task Manager)

### 2.2 Edge cleanup
```bash
# SSH to Edge
ssh -i ~/.ssh/ssh-key-zion-edge root@100.76.16.108

# Stop services
systemctl stop zion-edge-node1 zion-edge-node2 zion-edge-pool
killall -9 zion-node zion-pool-server 2>/dev/null

# Delete ALL chain databases
rm -f /root/zion-2.9.6-main/data/edge-state.db
rm -f /root/zion-2.9.6-main/data/edge2-state.db
rm -f /root/zion-2.9.6-main/data/peers.json
rm -f /root/zion-2.9.6-main/data/*.db.bak.*

# Temporarily remove seed peers to prevent cross-sync
sed -i 's/ZION_SEED_PEERS=100.86.102.5:8333/#ZION_SEED_PEERS=100.86.102.5:8333/' \
  /etc/systemd/system/zion-edge-node1.service
systemctl daemon-reload

# Start node1 isolated
systemctl start zion-edge-node1
sleep 5

# Verify genesis #0
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":{},"id":1}' \
  http://127.0.0.1:8443 | python3 -c "import sys,json; r=json.load(sys.stdin)['result']; print('Height:', r['height'], 'Accepted:', r['accepted_blocks'], 'Tip:', r['tip_hash'][:8])"
# Expected: Accepted: 1, Tip: 7543004c
```

### 2.3 Local W11 cleanup
```powershell
# Kill ALL node.exe processes (including auto-restarted ones!)
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Delete databases
Remove-Item -Path 'V3\data\zion-node-state.db' -ErrorAction SilentlyContinue
Remove-Item -Path 'V3\data\zion-node-state.db.journal' -ErrorAction SilentlyContinue
Remove-Item -Path 'V3\data\peers.json' -ErrorAction SilentlyContinue
```

### 2.4 Reconnect
```bash
# Restore seed peers on Edge
sed -i 's/#ZION_SEED_PEERS=100.86.102.5:8333/ZION_SEED_PEERS=100.86.102.5:8333/' \
  /etc/systemd/system/zion-edge-node1.service
systemctl daemon-reload

# Restart node2 on Edge
systemctl start zion-edge-node2

# Start local node (it will sync from Edge)
# Via start-node-window.bat or:
cd C:\Users\yosef\Desktop\Zion\2.9.6-main
set ZION_NODE_ID=local-backup-node
set ZION_SEED_PEERS=77.42.71.94:8333
V3\target\release\node.exe
```

### 2.5 Critical: Windows node.exe auto-restart
**The local `node.exe` auto-restarts when killed.** If you delete the DB while the old process is still running, Windows restores the file from the process's memory/handle. **Always verify with Task Manager that NO `node.exe` exists before deleting DB.**

---

## 3. Edge Miner Deployment (CPU)

### 3.1 Build Linux binary via WSL
The Edge server has no Rust toolchain. Build on local W11 via WSL Ubuntu:

```bash
wsl -d Ubuntu -e bash -c "
  source ~/.cargo/env &&
  cd /mnt/c/Users/yosef/Desktop/Zion/2.9.6-main &&
  cargo build --release --manifest-path V3/Cargo.toml -p zion-miner
"
```

### 3.2 Deploy to Edge
```bash
scp C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\zion-miner \
  root@100.76.16.108:/usr/local/bin/zion-miner-new

ssh root@100.76.16.108
chmod +x /usr/local/bin/zion-miner-new
mv /usr/local/bin/zion-miner /usr/local/bin/zion-miner-old-backdoor
mv /usr/local/bin/zion-miner-new /usr/local/bin/zion-miner
```

### 3.3 Run CPU miner (non-interactive)
```bash
export ZION_POOL_ADDR=127.0.0.1:8444
export ZION_WORKER_NAME=edge-cpu
export ZION_MINER_ID=edge-cpu-01
export ZION_LOOP_COUNT=1000000
export ZION_PAYOUT_ADDRESS=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
export ZION_MINER_ALGORITHM=deeksha_lite_v1
export ZION_THREADS=2
export ZION_INTERACTIVE=false   # REQUIRED for headless/nohup

nohup /usr/local/bin/zion-miner >> /var/log/zion-edge-miner.log 2>&1 &
```

### 3.4 Verify
```bash
pgrep -a zion-miner
tail -f /var/log/zion-edge-miner.log | grep SHARE_ACCEPTED
```

---

## 4. Backup Infrastructure

### 4.1 Edge Backup (systemd timer)
- Script: `/usr/local/bin/zion-edge-backup.sh` (v2.0)
- Timer: `zion-edge-backup.timer` (every 15 min)
- Backups: `/data/zion/backups/`
- Includes: node state, DAO DB + WAL, service DBs, systemd units, pool logs, git ref, health.json + MANIFEST.txt

### 4.2 Local W11 Backup
- Script: `scripts/local-core-backup.ps1`
- Launcher: `backup-local-core.bat`
- Destination: `C:\ZION-AutoBackups\`
- Includes: V3/data, all .db files, configs, git ref, health.json

### 4.3 Dashboard Backup Tab
- API: `/api/backup/status`
- Shows: Local Core health + Edge health
- Auto-refresh: 15 seconds

### 4.4 Known issue: Czech locale JSON
PowerShell `ConvertTo-Json` uses Czech decimal commas on Czech Windows. Wrap in `[System.Globalization.CultureInfo]::InvariantCulture`:
```powershell
[System.Globalization.CultureInfo]::InvariantCulture.Invoke({
    $data | ConvertTo-Json -Depth 5
})
```

---

## 5. Canonical Wallet Addresses

| Purpose | Address | Share |
|---------|---------|-------|
| Pool signer / miner payout | `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604` | 89% |
| Humanitarian (ongoing block subsidy) | `zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4` | 5% |
| Issobella | `zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702` | 5% |
| Pool fee (burned) | `zion196m4n8x764v7a0s406j40094a8z5j8m6z7nk342` | 1% |
| Children Future Fund (genesis premine) | `zion1z7g4u3s2w3c5z5u4a60864m2y7q8e5j304g46r7` | one-time |

---

## 6. Security Notes

### 6.1 DCR Backdoor (RESOLVED)
Old miner binaries (`/usr/local/bin/zion-miner` pre-2026-06-11) contained a stealth Decred worker mining for foreign BTC wallet `bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw`. **Always rebuild from source** before deploying to any server.

### 6.2 Credential Storage
- Pool payout SK: `edge-deploy/config/edge-environment.sh` (Edge server only)
- Wallet mnemonics: `F:\ZION_V3_MAINNET_WALLETS.txt` (offline flash drive)
- SSH key: `~/.ssh/ssh-key-zion-edge` (local W11)

### 6.3 Firewall (Edge)
- UFW active, ports 8333/8443/8444 open
- Tailscale provides encrypted mesh VPN

---

## 7. Quick Commands

### Check all nodes
```bash
# Edge node1
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":{},"id":1}' \
  http://77.42.71.94:8443

# Edge node2 (internal)
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":{},"id":1}' \
  http://100.76.16.108:8446

# Local node
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":{},"id":1}' \
  http://127.0.0.1:8443
```

### Check premine balances
```bash
# Humanitarian
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getBalance","params":{"address":"zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4"},"id":1}' \
  http://77.42.71.94:8443 | python3 -c "import sys,json; r=json.load(sys.stdin)['result']; print('Balance:', int(r['balance_flowers'])/1e12, 'ZION')"

# Issobella (same pattern, address zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702)
```

### Pool metrics
```bash
curl -s http://100.76.16.108:8455/metrics | grep -E "zion_pool|zion_pplns|zion_hashrate"
```

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Local node syncs to 341 instead of 0 after wipe | Old `node.exe` still running | Task Manager → End all `node.exe`, then delete DB |
| Edge node re-syncs to old height after reset | Seed peer (local W11) serves old chain | Remove `ZION_SEED_PEERS` temporarily, start isolated |
| Miner exits immediately on Edge | No TTY + `ZION_INTERACTIVE` default true | Set `ZION_INTERACTIVE=false` |
| Pool shows `session_error` / connection closed | Miner payout address invalid | Verify 44-char `zion1...` address |
| Dashboard `edge_health: null` | Edge backup API unreachable | Check Tailscale / SSH connectivity |
| `cargo` not found in WSL | `.cargo/env` not sourced | Prefix with `source ~/.cargo/env &&` |

---

*Generated with [Devin](https://cli.devin.ai/docs)*
