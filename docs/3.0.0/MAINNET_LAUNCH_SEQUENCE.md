# ZION V3 Mainnet Launch Sequence
**Aktualizováno:** 2026-05-22  
**Genesis Hash:** `003529805e9b47babb9ac0f26b27b1aad0a1cf3c483181857daf3269f7088923`

---

## ✅ PŘEDLAUNCE CHECKLIST (VŠECHNO HOTOVO)

### Konfigurace
- [x] **Fee split adresy aktualizovány** (89/5/5/1 burn model)
  - Miner: `zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3`
  - Humanitarian: `zion1m4v5z8z850u480c5c208z274e334369275n5y20`
  - Issobella: `zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702`
  - Pool Fee: BURNED (žádná peněženka)

- [x] **Genesis premine adresy aktualizovány** (12 výstupů, 16.78B ZION)
  - 3× OASIS + Golden Egg (4.95B ZION)
  - 2× L5 Free World Projects (3.3B ZION — Slots 4 & 5 repurposed from OASIS)
  - 3× DAO Treasury (4.0B ZION, locked 1 rok)
  - 3× Infrastructure (2.59B ZION)
  - 1× Humanitarian (1.44B ZION)

- [x] **Genesis hash ověřen** na obou serverech
- [x] **Všechny launch skripty aktualizovány** s novými adresami

### Infrastruktura (Edge-as-Primary)
- [x] **Edge server** (Hetzner VPS, Tailscale: 100.76.16.108, Public: 77.42.71.94)
  - Node (Primary / Genesis): Běží 24/7, source of chain truth
  - Pool (Primary): PPLNS aktivní, přijímá všechny minery
  - Veřejné porty: 8333 (P2P), 8444 (Pool), 8443 (RPC)
  - Fee split: 89/5/5 burn model

- [x] **Core server** (Windows 11, Tailscale: 100.86.102.5)
  - Node (Backup): Synchronizuje z Edge
  - Miner: GPU mining aktivní, připojen k Edge pool
  - Dashboard: Běží na portu 8766

- [x] **P2P synchronizace Core-Edge** funkční
- [x] **Tailscale VPN** stabilní
- [x] **Firewall (UFW)** konfigurován na Edge

---

## 🚀 MAINNET LAUNCH SEQUENCE

### Fáze 1: Finální Verifikace (PŘED LAUNCHEM)

```powershell
# 1. Zastavit všechny služby
powershell -ExecutionPolicy Bypass -File .\scripts\stop-stack.ps1
ssh -i ssh-key-zion-edge root@77.42.71.94 "systemctl stop zion-edge zion-edge-pool"

# 2. Vyčistit data directories (pro čistý genesis start)
Remove-Item -Path "V3\data\*" -Recurse -Force
ssh -i ssh-key-zion-edge root@77.42.71.94 "rm -f /root/zion-2.9.6-main/data/*"

# 3. Ověřit konfigurace
Get-Content .\scripts\launch-stack.ps1 | Select-String "ZION_"
ssh -i ssh-key-zion-edge root@77.42.71.94 "cat /root/zion-2.9.6-main/edge-environment.sh"
```

### Fáze 2: Genesis Launch (T-MINUS 5 MINUT)

```powershell
# 1. Spustit Core server
$env:ZION_TOPOLOGY='CORE'
$env:EDGE_TS_IP='100.76.16.108'
powershell -ExecutionPolicy Bypass -File .\scripts\_launch-core.ps1

# 2. Spustit Edge server
ssh -i ssh-key-zion-edge root@77.42.71.94 "systemctl start zion-edge zion-edge-pool"

# 3. Ověřit genesis hash
curl -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"get_template","params":[],"id":1}' http://127.0.0.1:8443
```

### Fáze 3: Síťová Stabilizace (T-MINUS 0 MINUT)

```powershell
# 1. Ověřit P2P synchronizaci
tail -f logs/node1.log | grep "relay_block"
ssh -i ssh-key-zion-edge root@77.42.71.94 "journalctl -u zion-edge -f | grep relay_block"

# 2. Ověřit fee split aktivaci
tail -f logs/pool.log | grep "fee_split"
ssh -i ssh-key-zion-edge root@77.42.71.94 "journalctl -u zion-edge-pool -f | grep fee_split"

# 3. Spustit dashboard
powershell -ExecutionPolicy Bypass -File .\dashboard\start-dashboard.ps1
# Otevřít http://127.0.0.1:8766
```

### Fáze 4: Veřejný Launch (T+0 MINUT)

```powershell
# 1. Otevřít pool pro veřejnost
# Ujistit se, že Edge server přijímá připojení na 8444
ssh -i ssh-key-zion-edge root@77.42.71.94 "netstat -tlnp | grep 8444"

# 2. Testovací miner připojení
# Připojit externího miner k 77.42.71.94:8444

# 3. Monitorování
tail -f logs/pool.log | grep "session_start"
ssh -i ssh-key-zion-edge root@77.42.71.94 "journalctl -u zion-edge-pool -f | grep session_start"
```

---

## 📊 PO-LAUNCH MONITORING

### Klíčové Metriky

```powershell
# Core server
Get-Process node,server,zion-miner
netstat -an | findstr "8333 8443 8444"
tail -f logs/node1.log | grep "height="
tail -f logs/pool.log | grep "fee_split\|revenue"

# Edge server
ssh -i ssh-key-zion-edge root@77.42.71.94 "systemctl status zion-edge zion-edge-pool"
ssh -i ssh-key-zion-edge root@77.42.71.94 "journalctl -u zion-edge -f | grep height="
ssh -i ssh-key-zion-edge root@77.42.71.94 "journalctl -u zion-edge-pool -f | grep revenue"
```

### Dashboard Monitoring

- **URL:** http://127.0.0.1:8766
- **Metriky:** Hashrate, Block height, Fee split revenue, Pool sessions

---

## 🛡️ BEZPEČNOSTNÍ CHECKLIST

- [x] SSH klíče správně nakonfigurovány
- [x] Firewall (UFW) povoluje pouze 8333, 8444, 22, 41641
- [x] Tailscale VPN aktivní a stabilní
- [x] Žádné privátní klíče v git repozitáři
- [x] Fee split adresy veřejně ověřitelné
- [x] Genesis hash konzistentní napříč sítí

---

## 🆘 TROUBLESHOOTING

### Edge server nespojí se s Core
```bash
# Ověřit Tailscale
ssh -i ssh-key-zion-edge root@77.42.71.94 "tailscale ping 100.86.102.5"

# Ověřit firewall
ssh -i ssh-key-zion-edge root@77.42.71.94 "ufw status"

# Restartovat Tailscale
ssh -i ssh-key-zion-edge root@77.42.71.94 "systemctl restart tailscaled"
```

### Fee split nefunguje
```powershell
# Ověřit environment proměnné
Get-ChildItem Env: | Where-Object {$_.Name -like "ZION_*"}

# Restartovat pool
Stop-Process -Name server -Force
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File .\scripts\launch-stack.ps1"
```

### Genesis hash nesedí
```powershell
# Vyčistit data directories
Remove-Item -Path "V3\data\*" -Recurse -Force
ssh -i ssh-key-zion-edge root@77.42.71.94 "rm -f /root/zion-2.9.6-main/data/*"

# Restartovat oba servery
powershell -ExecutionPolicy Bypass -File .\scripts\stop-stack.ps1
ssh -i ssh-key-zion-edge root@77.42.71.94 "systemctl restart zion-edge zion-edge-pool"
powershell -ExecutionPolicy Bypass -File .\scripts\_launch-core.ps1
```

---

## 📝 KONTAKTY A SUPPORT

- **Core Server:** Windows 11 (100.86.102.5)
- **Edge Server:** Hetzner VPS (77.42.71.94 / 100.76.16.108)
- **Dashboard:** http://127.0.0.1:8766
- **Logs:** `logs/` (Core), `/var/log/journal/` (Edge)

---

## ✨ STATUS: READY FOR MAINNET LAUNCH

Všechny systémy jsou připraveny:
- ✅ Genesis hash konzistentní
- ✅ Fee split adresy kanonické
- ✅ P2P synchronizace funkční
- ✅ Infrastruktura stabilní
- ✅ Monitoring aktivní

**Síť je připravena pro mainnet launch!** 🚀