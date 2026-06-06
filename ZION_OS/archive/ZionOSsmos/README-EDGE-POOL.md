# ZionOS — Edge Pool Mining Setup

## Co jsem opravil v kódu

1. **`dashboard/src/main.rs`** — aktualizoval jsem default `ZIONOS_POOL_METRICS` z local Prometheus (`127.0.0.1:9090`) na **Edge pool HTTP API** (`77.42.71.94:8444`)
2. **`dashboard/src/main.rs`** — vyměnil jsem **dead Praha node** (`91.98.122.165:3333`) za **Edge pool** (`77.42.71.94:8444`) ve všech demo rigech a flight sheets

## Pool dostupnost

| Endpoint | Status |
|----------|--------|
| `77.42.71.94:8444` (public stratum) | TCP OK |
| `100.76.16.108:8444` (Tailscale VPN) | TCP OK |

## Nastavení lokálního rigu

### 1. Přes ZionOS Dashboard API (pokud máš web UI na rigu)

```powershell
$RIG = "http://IP_TVOJEHO_RIGU:8888"
$WALLET = "zion1TVA_ADRESA"
$WORKER = "nazev-rigu"

# Vytvoř Edge pool flight sheet
Invoke-RestMethod -Uri "$RIG/api/flightsheets" -Method POST -ContentType "application/json" -Body (@{
    id = "fs-edge"
    name = "Edge Pool"
    coin = "ZION"
    algo = "Ekam Deeksha v2"
    pool_addr = "77.42.71.94:8444"
    wallet = $WALLET
    miner_args = ""
    gpu_mode = "cpu"
    threads = 0
    intensity = $null
    created_at = [int](Get-Date -UFormat %s)
} | ConvertTo-Json -Depth 3)

# Aplikuj na rig
Invoke-RestMethod -Uri "$RIG/api/rigs/rig-$WORKER/apply-flightsheet" -Method POST -ContentType "application/json" -Body '{"flight_sheet_id":"fs-edge"}'

# Start mining
Invoke-RestMethod -Uri "$RIG/api/rigs/rig-$WORKER/action" -Method POST -ContentType "application/json" -Body '{"action":"start"}'
```

### 2. Přes CLI na rigu

```bash
# Jako standalone miner
zionos-miner --pool 77.42.71.94:8444 --wallet zion1TVA_ADRESA --worker rig-01

# Nebo přes agenta (auto-restart + telemetrie)
zionos-agent --dashboard http://127.0.0.1:8888 \
  --miner zionos-miner \
  --pool 77.42.71.94:8444 \
  --wallet zion1TVA_ADRESA \
  --worker rig-01
```

### 3. Přes SimpleMining OS (SMOS)

Zkopíruj `ZionOS/smos/build.sh` a `package.sh` na rig, nastav env:

```bash
export ZION_POOL_ADDR=77.42.71.94:8444
export ZION_MINER_ID=zion1TVA_ADRESA
export ZION_WORKER_NAME=rig-01
```

## Ověření payoutů

### Pool API (přes stratum port — pool server detekuje HTTP)

```powershell
# Statistiky miner
Invoke-RestMethod -Uri "http://77.42.71.94:8444/api/v1/miner/zion1TVA_ADRESA/stats" | ConvertTo-Json -Depth 5

# Payout historie
Invoke-RestMethod -Uri "http://77.42.71.94:8444/api/v1/miner/zion1TVA_ADRESA/payouts" | ConvertTo-Json -Depth 5
```

### Z lokálního dashboardu

```powershell
Invoke-RestMethod -Uri "$RIG/api/wallet/earnings" | ConvertTo-Json -Depth 3
```

## Důležité poznámky

- **Pool defaultně používá PPLNS** (Pay Per Last N Shares) — payouty se počítají z posledních N shareů
- **Account-model payout fix** byl nasazen 2026-06-01 (`PAYOUT_FIX_2026-06-01.md`) — payouty by měly fungovat
- **ZION_LOOP_COUNT=1000000** pro sustained mining (ne 1, což způsobuje odpojování)
- **ZION_NONCE_COUNT** pool default je 1024 — pro GPU zvyš na 4096 pro lepší využití
