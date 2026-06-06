# ZION Miner na SimpleMining OS — Kompletní Setup

## Co bylo vygenerováno

| | Hodnota |
|---|---|
| **Payout Address** | `zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3` |
| **Mnemonic (24 words)** | `only elephant scrub receive couch penalty follow crush mind fine ship sphere vicious inquiry eagle dice kingdom main video view timber grape renew version` |
| **Private Key** | `72781912c7a673bfe27c4aa497eaa5d08d8e15e7ff26481e8327a8ecb9805a50` |

> ⚠️ **ULOŽ MNEMONIC — je jediný způsob, jak obnovit peněženku!**

---

## Tvůj SMOS rig (z API)

| | |
|---|---|
| **Rig ID** | `518837` |
| **Name** | `ZionRig` |
| **GPU** | AMD RX Vega 64 |
| **IP (LAN)** | `192.168.0.146` |
| **IP (WAN)** | `109.81.81.193` |
| **Current Group** | ZANO (srbminer-multi-v3.2.5) |
| **Hashrate** | ~17.68 MH/s |

---

## Rychlá cesta (doporučeno) — SSH instalace

Nejjednodušší způsob je připojit se k rigu přes SSH a nainstalovat zion-miner přímo.

### Krok 1: Buildni zion-miner na Edge serveru

SSH na Edge server a spusť build:

```bash
ssh root@77.42.71.94
# v repozitáři:
bash ZionOS/scripts/build-zion-miner-linux.sh
```

Tím vznikne `/root/zion-2.9.6-main/ZionOS/dist/zion-miner-linux-amd64`.

### Krok 2: Nahraj binary na veřejný URL

```bash
cp /root/zion-2.9.6-main/ZionOS/dist/zion-miner-linux-amd64 /var/www/zion-miner/zion-miner-linux-amd64
```

Nebo použij GitHub Raw / jiný hosting.

### Krok 3: Připoj se k SMOS rigu přes SSH

```bash
ssh miner@192.168.0.146   # LAN
# nebo
ssh miner@109.81.81.193     # WAN (pokud je SSH otevřené)
# Default heslo: žádné / viz SMOS nastavení
```

### Krok 4: Spusť instalační skript

```bash
export ZION_WALLET=zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3
export ZION_POOL=77.42.71.94:8444
export ZION_WORKER=vega-smos
export MINER_URL=https://TVUJ-URL/zion-miner-linux-amd64

curl -fsSL https://raw.githubusercontent.com/Yose144/Zion-v3.0.0/main/ZionOS/scripts/smos-install-zion.sh | bash
```

### Krok 5: Ověř na poolu

```bash
curl http://77.42.71.94:8444/api/v1/miner/zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3/stats
```

---

## Alternativní cesta — SMOS Web UI (Custom Miner)

Pokud chceš použít SMOS dashboard místo SSH:

1. **Buildni zion-miner na Edge serveru** (viz Krok 1 výše)
2. **Vytvoř .zip package** pro SMOS:
   ```bash
   mkdir -p custom-miner-zion && cd custom-miner-zion
   cp /root/zion-2.9.6-main/ZionOS/dist/zion-miner-linux-amd64 zion-miner
   chmod +x zion-miner
   zip -r ../zion-miner-v1.0.0.zip .
   ```
3. **Nahraj .zip** na veřejný URL (např. `https://zionterranova.com/miners/zion-miner-v1.0.0.zip`)
4. **SMOS Dashboard** → Mining → Rig Groups → Add Group
   - Name: `ZION-EdgePool`
   - Miner: Custom Miner
   - Custom Miner URL: `https://zionterranova.com/miners/zion-miner-v1.0.0.zip`
   - Options: `--pool 77.42.71.94:8444 --wallet zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3 --worker vega-smos`
5. **Přiřaď rig** do skupiny a klikni Reload

---

## API přepínač (po ručním vytvoření group)

Jakmile máš ZION group config vytvořenou ručně, můžeš přepínat rig přes API:

```powershell
.\switch-to-zion-api.ps1 `
  -ApiKey "api-df8a355c9016a08c1cc16f60b3afcf5d76853e45d8345a8895e39a813e0e245d" `
  -GroupId 9999999   # <-- nahraď ID tvé ZION skupiny
```

---

## Důležité poznámky

- **Pool**: `77.42.71.94:8444` (Edge primary, veřejná IP)
- **VPN fallback**: `100.76.16.108:8444` (Tailscale, pokud je veřejná IP blokovaná)
- **ZION_LOOP_COUNT**: Použij `1000000` pro sustained mining (ne `1`, což způsobuje odpojování)
- **Payout fix**: Pool používá account-model payouty (fix z 2026-06-01), payouty by měly fungovat
- **PPLNS**: Pool počítá payouty z posledních N shares — první payout může trvat

---

## Ověření payoutů

```powershell
# Pool stats pro tvou adresu
Invoke-RestMethod -Uri "http://77.42.71.94:8444/api/v1/miner/zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3/stats"

# Payout historie
Invoke-RestMethod -Uri "http://77.42.71.94:8444/api/v1/miner/zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3/payouts"
```
