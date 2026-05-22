# ZION V3 Mainnet Launch Plan - 20.6.2026
**Summer Solstice Launch**
**Launch Date:** Saturday, June 20, 2026
**Launch Time:** 12:00 UTC (14:00 CEST)
**Genesis Hash:** `003529805e9b47babb9ac0f26b27b1aad0a1cf3c483181857daf3269f7088923`

---

## 🎯 LAUNCH OVERVIEW

### Symbolický Význam
- **Summer Solstice**: Nejdelší den roku - symbol začátku éry světla
- **Cosmic Harmony**: Zarovnání s kosmickými cykly
- **20.6.2026**: Astrologicky významný den pro nový začátek

### Technical Cíle
- Spuštění L1 mainnet s novým genesis blokem
- Aktivace fee split distribuce (89/5/5/1)
- Otevření poolu pro veřejné minery
- Stabilní Core+Edge topologie

---

## ⏰ TIMELINE

### Před-Launch (T-MINUS 24 HODIN)

**19.6.2026 (Friday) - 12:00 UTC**
- [ ] Final check všech serverů (Core + Edge)
- [ ] Backup konfigurací a klíčů
- [ ] Monitoring setup (Prometheus + Grafana)
- [ ] Community oznámení (Twitter, Discord, Website)

**19.6.2026 (Friday) - 18:00 UTC**
- [ ] Final verification genesis hash
- [ ] Test launch sequence (dry run)
- [ ] Team připravenost check
- [ ] Emergency plán review

**20.6.2026 (Saturday) - 06:00 UTC (T-MINUS 6 HODIN)**
- [ ] Stop všech testovacích služeb
- [ ] Clean data directories
- [ ] Final configuration check
- [ ] Team standby

---

## 🚀 LAUNCH SEQUENCE (20.6.2026)

### T-MINUS 1 HODINA (11:00 UTC)

**11:00 UTC - Core Server Preparation**
```powershell
# 1. Stop all services
powershell -ExecutionPolicy Bypass -File .\scripts\stop-stack.ps1

# 2. Clean data directories
Remove-Item -Path "V3\data\*" -Recurse -Force

# 3. Verify configuration
Get-Content .\scripts\launch-stack.ps1 | Select-String "ZION_"

# 4. Pre-flight checks
$env:ZION_TOPOLOGY='CORE'
$env:EDGE_TS_IP='100.66.162.125'
```

**11:15 UTC - Edge Server Preparation**
```bash
# 1. Stop all services
ssh -i ssh-key-zion-edge root@77.42.71.94 "systemctl stop zion-edge zion-edge-pool"

# 2. Clean data directories
ssh -i ssh-key-zion-edge root@77.42.71.94 "rm -f /root/zion-2.9.6-main/data/*"

# 3. Verify configuration
ssh -i ssh-key-zion-edge root@77.42.71.94 "cat /root/zion-2.9.6-main/edge-environment.sh"

# 4. Verify Tailscale
ssh -i ssh-key-zion-edge root@77.42.71.94 "tailscale ping 100.86.102.5"
```

**11:30 UTC - Team Sync**
- [ ] Všichni operátoři online
- [ ] Communication channels test
- [ ] Emergency contacts ready
- [ ] Monitoring dashboard připraven

### T-MINUS 30 MINUT (11:30 UTC)

**11:30 UTC - Final Pre-Launch Checks**
- [ ] Server stability check
- [ ] Network connectivity test
- [ ] Storage capacity check
- [ ] Power/UPS check (Core server)
- [ ] Service dependencies check

**11:45 UTC - Launch Countdown**
- [ ] Team countdown sync
- [ ] Monitoring started
- [ ] Log capture aktivován
- [ ] Community announcement připravena

### LAUNCH (12:00 UTC)

**12:00:00 UTC - GENESIS LAUNCH**

**Step 1: Core Server Launch (12:00:00-12:00:30)**
```powershell
# Launch Core server
powershell -ExecutionPolicy Bypass -File .\scripts\_launch-core.ps1

# Verify services
Get-Process node,server,zion-miner
netstat -an | findstr "8333 8443 8444"
```

**Step 2: Edge Server Launch (12:00:30-12:01:00)**
```bash
# Launch Edge server
ssh -i ssh-key-zion-edge root@77.42.71.94 "systemctl start zion-edge zion-edge-pool"

# Verify services
ssh -i ssh-key-zion-edge root@77.42.71.94 "systemctl status zion-edge zion-edge-pool"
```

**Step 3: Genesis Verification (12:01:00-12:02:00)**
```powershell
# Verify genesis hash
# (TBD - specific RPC method)

# Verify fee split activation
tail -f logs/pool.log | grep "fee_split"

# Verify P2P sync
tail -f logs/node1.log | grep "relay_block"
```

**Step 4: Public Announcement (12:02:00 UTC)**
- [ ] Website announcement live
- [ ] Twitter/X post
- [ ] Discord announcement
- [ ] Block explorer update

---

## 📊 POST-LAUNCH MONITORING

### Immediate Monitoring (12:02-13:00 UTC)

**Core Server Metrics**
- Node height progression
- Pool session count
- Mining hashrate
- Fee split activation

**Edge Server Metrics**
- P2P peer connections
- Pool relay activity
- Network latency
- Resource usage

**Network Metrics**
- Block propagation time
- P2P sync status
- Mempool size
- Transaction throughput

### First Hour Critical Checks (13:00-13:00 UTC)

**13:00 UTC - First Block Check**
- [ ] První block nalezen?
- [ ] Genesis hash potvrzen?
- [ ] Fee split správně aplikován?

**13:15 UTC - Pool Functionality**
- [ ] Veřejní minery se připojují?
- [ ] Share relay funguje?
- [ ] Stratum protokol stabilní?

**13:30 UTC - Network Stability**
- [ ] P2P synchronizace stabilní?
- [ ] Žádné reorgy?
- [ ] Mempool normální?

**13:45 UTC - Infrastructure**
- [ ] CPU/RAM normální?
- [ ] Disk space OK?
- [ ] Network stabilní?

---

## 🆘 EMERGENCY PROCEDURES

### Scenario 1: Genesis Hash Mismatch
**Symptom:** Nodes se nemohou synchronizovat
**Action:**
1. Okamžitě stop všech služeb
2. Vyčistit data directories
3. Ověřit genesis.rs konzistenci
4. Překompilovat a restartovat

### Scenario 2: Fee Split Neaktivní
**Symptom:** Fee split nefunguje v logu
**Action:**
1. Ověřit environment proměnné
2. Restartovat pool služby
3. Zkontrolovat genesis.rs konfiguraci

### Scenario 3: P2P Sync Selhání
**Symptom:** Edge se nesynchronizuje s Core
**Action:**
1. Ověřit Tailscale VPN
2. Zkontrolovat firewall pravidla
3. Restartovat Tailscale službu
4. Manual seed peers konfigurace

### Scenario 4: Pool Dostupnost
**Symptom:** Veřejný pool nedostupný
**Action:**
1. Zkontrolovat port binding
2. Ověřit firewall (UFW)
3. Restartovat pool službu
4. Fallback na Core pool pouze

---

## 📱 COMMUNICATION PLAN

### Pre-Launch (19.6.2026)
- **Website:** Countdown timer
- **Discord:** Launch announcement
- **Twitter/X:** Teaser posts
- **Email:** Newsletter update

### Launch Moment (20.6.2026 12:00 UTC)
- **Website:** "MAINNET LIVE" banner
- **Discord:** Live launch party
- **Twitter/X:** "ZION Mainnet is LIVE!"
- **GitHub:** Release tag v3.0.0-mainnet

### Post-Launch (20.6.2026+)
- **Website:** Live statistics
- **Discord:** Mining support
- **Twitter/X:** Progress updates
- **GitHub:** Bug reports & issues

---

## 🔧 TECHNICAL SPECIFICATIONS

### Launch Configuration

**Core Server (Windows 11)**
- Node ID: `w11-native-node`
- P2P Bind: `0.0.0.0:8333`
- RPC Bind: `0.0.0.0:8443`
- Pool Bind: `0.0.0.0:8444`
- Topology: `CORE`
- Edge IP: `100.66.162.125`

**Edge Server (Hetzner VPS)**
- Node ID: `zion-edge-relay`
- P2P Bind: `0.0.0.0:8333`
- RPC Bind: `127.0.0.1:8443`
- Pool Bind: `0.0.0.0:8444`
- Seed Peers: `100.86.102.5:8333`
- Public IP: `77.42.71.94`

### Fee Split Configuration
- Miner: 89% → `zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3`
- Humanitarian: 5% → `zion1m4v5z8z850u480c5c208z274e334369275n5y20`
- Issobella: 5% → `zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702`
- Pool Fee: 1% → `zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5`

---

## 📋 SUCCESS CRITERIA

Launch je považován za úspěšný pokud:
- ✅ Genesis hash konzistentní napříč sítí
- ✅ První block nalezen do 30 minut
- ✅ Fee split aktivní a ověřený
- ✅ P2P synchronizace funkční
- ✅ Pool přijímá veřejné minery
- ✅ Žádné kritické chyby v prvních 24 hodinách

---

## 🎉 POST-LAUNCH CELEBRATION

Pokud launch proběhne úspěšně:
- **12:30 UTC:** Community call na Discordu
- **13:00 UTC:** First block celebration
- **18:00 UTC:** Launch party stream
- **20:00 UTC:** Official launch completion

---

**Dokument připraven:** 22.5.2026
**Final review:** 15.6.2026
**Launch execution:** 20.6.2026 12:00 UTC

**V případě problémů kontaktuj:**
- Technical Lead: [TBD]
- Infrastructure: [TBD]
- Community: [TBD]