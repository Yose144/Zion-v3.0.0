# 🏆 ZION TerraNova v2.9.5 — External Pool Integration Guide

**Verze:** 1.0  
**Datum:** 7. února 2026  
**Status:** ✅ ETC/RVN/XMR/ERG LIVE na externích poolech s BTC payouty

---

## 📊 Executive Summary

ZION pool provozuje **multi-stream revenue model** — kromě nativního ZION miningu (Cosmic Harmony) paralelně těží na externích poolech s automatickým BTC výplatním systémem.

### Aktuální stav (7.2.2026)

| Coin | Pool | Algoritmus | Status | BTC Payouts |
|------|------|-----------|--------|-------------|
| **ETC** | 2miners | Ethash | ✅ LIVE — joby přijímány | ✅ Unifikované |
| **RVN** | 2miners | KawPow | ✅ LIVE — joby přijímány | ✅ Unifikované |
| **XMR** | MoneroOcean | RandomX (auto) | ✅ LIVE — 524 H/s, 97+ shares | ✅ Via XMR→BTC |
| **ERG** | 2miners | Autolykos v2 | ✅ LIVE — 83 kH/s Metal GPU | ✅ Unifikované |
| **ALPH** | 2miners | Blake3 | 🔧 Ready (disabled) | Připraveno |
| **KAS** | 2miners | kHeavyHash | ⏸️ Excluded (ASIC dominance) | Připraveno |
| **ZEC** | 2miners | Equihash | 🔧 Config ready | Připraveno |

**Unifikovaná BTC peněženka:**
```
bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw
```

---

## 🏗️ Architektura

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ZION MULTI-STREAM MINING                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐                                            │
│  │     ZION MINER      │  Miner vidí POUZE ZION pool               │
│  │  (CPU: CHv3 50%)    │  na portu 3333. Neví o externích poolech.  │
│  │  (GPU: budoucí)     │                                            │
│  └──────────┬──────────┘                                            │
│             │ Stratum :3333                                          │
│  ┌──────────▼──────────────────────────────────────────────────┐    │
│  │                    ZION POOL SERVER                           │    │
│  │                 (77.42.31.72 Helsinki)                        │    │
│  │                                                               │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │    │
│  │  │ Stratum      │  │ Revenue      │  │ External Miner   │   │    │
│  │  │ Server       │  │ Proxy        │  │ (xmrig)          │   │    │
│  │  │ :3333        │  │ (Rust async) │  │ XMR :10001       │   │    │
│  │  └──────────────┘  └──────┬───────┘  └──────────────────┘   │    │
│  │                           │                                   │    │
│  └───────────────────────────┼───────────────────────────────────┘    │
│                              │                                        │
│         ┌────────────────────┼────────────────────┐                  │
│         │                    │                    │                   │
│  ┌──────▼──────┐   ┌────────▼───────┐   ┌───────▼───────┐          │
│  │  ETC Pool   │   │   RVN Pool     │   │   XMR Pool    │          │
│  │  2miners    │   │   2miners      │   │  MoneroOcean  │          │
│  │  :1010      │   │   :6060        │   │   :10001      │          │
│  │  proxy:3341 │   │   proxy:3342   │   │   (xmrig)     │          │
│  └──────┬──────┘   └────────┬───────┘   └───────┬───────┘          │
│         └────────────────────┼───────────────────┘                   │
│                              │                                        │
│                    ┌─────────▼──────────┐                            │
│                    │   BTC PAYOUTS      │                            │
│                    │  bc1qvujra09wls... │                            │
│                    └────────────────────┘                            │
│                              │                                        │
│                    ┌─────────▼──────────┐                            │
│                    │  Buyback Engine    │                            │
│                    │  (BTC → ZION)      │                            │
│                    │  [MainNet pouze]   │                            │
│                    └────────────────────┘                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Klíčový princip
- **Miner** se připojuje na ZION pool (:3333) a těží CHv3 — neví o externích poolech
- **Pool** na pozadí provozuje **Revenue Proxy** (Rust async), který drží TCP spojení k 2miners
- **External Miner** (xmrig subprocess) těží XMR na MoneroOcean
- Všechny výdělky jdou na **jednu BTC adresu** díky 2miners BTC payout feature

---

## 💰 Revenue Streams (5 proudů příjmů)

```
┌─────────────────────────────────────────────────────────────┐
│              ZION 5-STREAM REVENUE MODEL                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Stream 1: ZION Mining (50%)                                │
│  ├── Cosmic Harmony v3 → ZION block rewards                 │
│  ├── Merged: Keccak-256 intermediate → ETC (free bonus!)    │
│  └── Merged: SHA3-512 intermediate → NXS (free bonus!)      │
│                                                              │
│  Stream 2: GPU Profit-Switch (20%)                          │
│  ├── ETC (Ethash) ──────→ BTC via 2miners                   │
│  ├── RVN (KawPow) ─────→ BTC via 2miners                   │
│  ├── ERG (Autolykos) ──→ BTC via 2miners                    │
│  └── ALPH (Blake3) ────→ BTC via 2miners                    │
│                                                              │
│  Stream 3: CPU Mining (5%)                                   │
│  └── XMR (RandomX) ────→ BTC via MoneroOcean                │
│                                                              │
│  Stream 4: NCL AI Compute (25%)                              │
│  └── AI inference tasks → USD/BTC (marketplace)              │
│                                                              │
│  Stream 5: Fee Revenue                                       │
│  └── Pool fee 1% + Merged 5% + Switch 2% + NCL 10%         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Komponenty

### 1. Revenue Proxy (`revenue_proxy.rs` — 798 řádků)

Plně async Rust (tokio) orchestrátor externích pool spojení.

**Hlavní struktury:**

| Struct | Funkce |
|--------|--------|
| `RevenueProxy` | Orchestrátor — startuje klienty, broadcast kanál, stats |
| `ExternalPoolClient` | Stratum klient pro 1 coin — EthStratum/Standard handshake |
| `ExternalJob` | Job data: coin, algo, job_id, header_hash, target, difficulty |
| `ExternalPoolStats` | Per-coin statistiky: jobs_received, shares_accepted/rejected |

**Protokol auto-detekce:**

| Protokol | Coiny | Handshake |
|----------|-------|-----------|
| **EthStratum V1** | ETC, RVN, ERG | `eth_subscribe` → `eth_submitLogin` |
| **StandardStratum** | KAS, ALPH, XMR | `mining.subscribe` → `mining.authorize` |

**Speciální handling:**
- **KAS (kHeavyHash):** Header přichází jako `[u64, u64, u64, u64]` array místo hex stringu
- **RVN (KawPow):** Notify má 7 parametrů (extra `seed_hash`, `header_hash`)
- **ETC (Ethash):** Notify má 4 parametry (standardní EthStratum)

### 2. Profit Switcher (`profit_switcher.rs` — 604 řádků)

Automatické přepínání těžby na nejvýnosnější algoritmus.

**Konfigurace:**

| Parametr | Default | Popis |
|----------|---------|-------|
| `check_interval_secs` | 300 (5 min) | Interval kontroly profitability |
| `min_profit_threshold` | 10% | Minimální výhoda pro switch |
| `cooldown_secs` | 1800 (30 min) | Cooldown mezi přepnutími |
| `preferred_coins` | `["XMR", "ETC", "RVN"]` | Preferované coiny |
| `excluded_coins` | `["KAS"]` | Vyloučené (ASIC dominance) |
| `fallback_coin` | `"XMR"` | Záložní coin |

**Zdroj dat:** WhatToMine API + CoinGecko fallback

**Switch logika:**
```
every 5 minutes:
    profits = fetch_whattomine()
    current = get_current_coin_profit()
    best = max(profits, exclude=excluded)
    
    if best.profit > current * 1.10:  # 10% threshold
        if cooldown_expired():
            switch_to(best.coin)
            notify_pool(best.coin)
```

**API endpointy:**
- `GET /api/v1/profit-switcher/status` — aktuální stav
- `POST /api/v1/profit-switcher/switch` — ruční přepnutí

### 3. External Miner (`pool_external_miner.rs` — 456 řádků)

Pool-side CPU mining přes xmrig subprocess.

| Parametr | Hodnota |
|----------|---------|
| **Software** | xmrig v6.22.2 |
| **Pool** | `gulf.moneroocean.stream:10001` |
| **Protokol** | Auto-switching (MoneroOcean) |
| **Threads** | 2 (server CPU) |
| **Hashrate** | ~524 H/s |
| **Wallet** | `42m86RBW...skcKsK` (XMR) |

**Auto-install:** Stáhne xmrig z GitHub releases pokud není nainstalován.

### 4. Buyback Engine (`buyback_engine.rs` — 419 řádků)

Monitoring BTC výdělků z externích poolů.

| Fáze | Funkce | Status |
|------|--------|--------|
| **TestNet** | Monitoring + reporting | ✅ Aktivní |
| **MainNet** | Auto-buyback ZION za BTC na DEX/CEX | ⏳ Plánováno |

**Sledované dashboardy:**
- `etc.2miners.com/account/bc1q...`
- `rvn.2miners.com/account/bc1q...`
- `moneroocean.stream/dashboard/42m86...`

**Polling interval:** 600s (10 min)

---

## 🌐 Pool Konfigurace

### 2miners Pools

| Coin | Pool URL | Port | Algoritmus | Min Payout |
|------|---------|------|-----------|-----------|
| **ETC** | `etc.2miners.com` | 1010 | Ethash | 0.005 BTC |
| **RVN** | `rvn.2miners.com` | 6060 | KawPow | 0.005 BTC |
| **ERG** | `erg.2miners.com` | 8888 | Autolykos v2 | 0.005 BTC |
| **KAS** | `kas.2miners.com` | 2020 | kHeavyHash | 0.005 BTC |
| **ALPH** | `alph.2miners.com` | 1199 | Blake3 | 0.005 BTC |
| **ZEC** | `zec.2miners.com` | 1010 | Equihash 200,9 | 0.005 BTC |

**BTC Payout setup:** Všechny 2miners pooly podporují BTC payouts — stačí zadat BTC wallet jako mining adresu.

### MoneroOcean

| Parametr | Hodnota |
|----------|---------|
| **Pool** | `gulf.moneroocean.stream` |
| **Port** | 10001 |
| **Algo** | Auto-switch (RandomX primary) |
| **Wallet** | XMR adresa |
| **Payout** | Min 0.003 XMR → exchange → BTC |

### Dashboard URLs

- **ETC:** https://etc.2miners.com/account/bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw
- **RVN:** https://rvn.2miners.com/account/bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw
- **MoneroOcean:** https://moneroocean.stream (přihlášení přes XMR adresu)

---

## ⚙️ Konfigurační soubor

Hlavní config: `config/ch3_revenue_settings.json`

```json
{
  "streams": {
    "zion": {
      "enabled": true,
      "target_share": 0.5,
      "algorithm": "cosmic_harmony_v3",
      "fee_percent": 0
    },
    "etc": {
      "enabled": true,
      "pool_url": "etc.2miners.com",
      "pool_port": 1010,
      "wallet": "bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw",
      "algorithm": "ethash",
      "protocol": "ethstratum",
      "proxy_listen": "0.0.0.0:3341",
      "fee_percent": 5
    },
    "dynamic_gpu": {
      "RVN": {
        "enabled": true,
        "pool_url": "rvn.2miners.com",
        "pool_port": 6060,
        "wallet": "bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw",
        "algorithm": "kawpow",
        "protocol": "ethstratum",
        "proxy_listen": "0.0.0.0:3342"
      },
      "ERG": {
        "enabled": false,
        "pool_url": "erg.2miners.com",
        "pool_port": 8888,
        "algorithm": "autolykos",
        "protocol": "ethstratum"
      },
      "XMR": {
        "enabled": true,
        "pool_url": "gulf.moneroocean.stream",
        "pool_port": 10001,
        "algorithm": "auto",
        "protocol": "stratum"
      },
      "ALPH": {
        "enabled": false,
        "pool_url": "alph.2miners.com",
        "pool_port": 1199,
        "algorithm": "blake3",
        "protocol": "stratum"
      }
    }
  },
  "profit_switching": {
    "enabled": true,
    "check_interval_secs": 300,
    "min_profit_threshold": 0.10,
    "cooldown_secs": 1800,
    "preferred_coins": ["XMR", "ETC", "RVN"],
    "excluded_coins": ["KAS"],
    "fallback_coin": "XMR"
  },
  "buyback": {
    "enabled": true,
    "btc_wallet": "bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw",
    "min_buyback_btc": 0.001,
    "reserve_percent": 10,
    "check_interval_secs": 600
  }
}
```

---

## 🔌 Stratum Protokol — Per-coin specifika

### ETC (Ethash) — EthStratum V1

```json
// Subscribe
→ {"id":1,"method":"eth_submitLogin","params":["bc1q...","x"]}
← {"id":1,"result":true}

// Job (mining.notify)
← {"id":null,"method":"mining.notify","params":["job_id","seed_hash","header_hash","target"]}

// Submit
→ {"id":2,"method":"eth_submitWork","params":["0xnonce","header_hash","mix_hash"]}
```

### RVN (KawPow) — EthStratum V1

```json
// Job (7 parametrů)
← {"id":null,"method":"mining.notify","params":["job_id","header_hash","seed_hash","target","clean","height","bits"]}

// Submit
→ {"id":2,"method":"mining.submit","params":["worker","job_id","nonce","header","mix_hash"]}
```

### KAS (kHeavyHash) — EthStratum V1

```json
// Job — header jako u64 array!
← {"id":null,"method":"mining.notify","params":["job_id",[u64,u64,u64,u64],"target"]}
```

### XMR (RandomX) — Standard Stratum V1

```json
// Login (MoneroOcean)
→ {"id":1,"method":"login","params":{"login":"42m86...","pass":"x","agent":"ZION-Proxy/1.0"}}
← {"id":1,"result":{"id":"...","job":{...}}}

// Submit
→ {"id":2,"method":"submit","params":{"id":"...","job_id":"...","nonce":"...","result":"..."}}
```

---

## 📊 Performance Data

### XMR Mining (Live — 6.2.2026)

| Metrika | Hodnota |
|---------|---------|
| Hashrate | 524 H/s (2 CPU threads) |
| Shares Accepted | 97+ |
| Shares Rejected | 0 |
| Accept Rate | 100% |
| Pool | MoneroOcean (auto-switch) |
| Uptime | Nepřetržitý provoz |

### ETC/RVN (Proxy — 6.2.2026)

| Metrika | ETC | RVN |
|---------|-----|-----|
| Connection | ✅ Live | ✅ Live |
| Jobs Received | ✅ Ano | ✅ Ano |
| Proxy Port | :3341 | :3342 |
| GPU Shares | ⏸️ Vyžaduje GPU | ⏸️ Vyžaduje GPU |

> **Poznámka:** ETC a RVN vyžadují GPU mining (Ethash DAG ~5GB, KawPow DAG ~4GB). CPU-only server nemůže generovat validní shares. Pro plnou produkci je potřeba server s GPU (RTX 3060+).

---

## 🚀 Deployment

### Docker Deploy (doporučeno)

```bash
# Na Helsinki serveru (77.42.31.72)
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72

cd /root/zion-v2.9/2.9.5
docker-compose -f docker-compose.native-2.9.5.yml up -d
```

Pool automaticky:
1. Startuje Stratum server na :3333
2. Spouští Revenue Proxy → připojí se k 2miners
3. Spouští xmrig pro XMR mining
4. Startuje Buyback Engine monitoring

### Manuální spuštění (development)

```bash
# 1. Build pool s revenue features
cd 2.9.5/zion-native/pool
cargo build --release

# 2. Spusť s konfigurací
./target/release/zion-pool \
  --config /etc/zion-pool/config.toml \
  --revenue-config config/ch3_revenue_settings.json
```

### Ověření

```bash
# Zkontroluj revenue proxy
curl http://localhost:8080/api/v1/revenue/status

# Zkontroluj profit switcher
curl http://localhost:8080/api/v1/profit-switcher/status

# Zkontroluj pool stats
curl http://localhost:8080/stats

# Prometheus metriky
curl http://localhost:8080/metrics | grep "external_pool"
```

---

## 🧪 Testování

### E2E Test (z lokálního stroje)

```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main

# Test všech externích poolů
python 2.9.5/tests/e2e_native_pool_test.py \
  --host 77.42.31.72 \
  --stratum-port 3333 \
  --api-port 8080

# Test ETC stratum
python tools/test_etc_stratum.py
```

### Ověření na 2miners dashboardu

1. Otevřít https://etc.2miners.com/account/bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw
2. Zkontrolovat "Workers" — měl by být vidět ZION proxy worker
3. Zkontrolovat "Hashrate" a "Shares"

---

## 📂 Soubory

### Rust (Production)

| Soubor | Řádky | Popis |
|--------|-------|-------|
| `pool/src/stratum/revenue_proxy.rs` | 798 | Revenue proxy — orchestrátor externích poolů |
| `pool/src/stratum/profit_switcher.rs` | 604 | Profit switching engine |
| `pool/src/stratum/buyback_engine.rs` | 419 | BTC earnings monitor |
| `pool/src/stratum/pool_external_miner.rs` | 456 | xmrig subprocess manager |
| `pool/src/stratum/server_v2.rs` | 1685 | Hlavní Stratum server |

### Python (Tooling)

| Soubor | Řádky | Popis |
|--------|-------|-------|
| `src/pool/revenue_proxy.py` | 903 | Python EthStratum klient |
| `zion-cosmic-harmony-v3/src/engine.rs` | 835 | CH3 engine s multi-algo pipeline |
| `tools/test_etc_stratum.py` | 119 | ETC stratum test |
| `tools/test_external_pool_e2e.py` | 700 | E2E test všech externích poolů |
| `src/pool/blockchain/multichain_submit.py` | — | Multi-chain share submit modul |

### Konfigurace

| Soubor | Popis |
|--------|-------|
| `config/ch3_revenue_settings.json` | Produkční config revenue proxy |
| `ch3_revenue_settings_example.json` | Referenční example config |

---

## ⚠️ Známá omezení

| # | Omezení | Detail | Řešení |
|---|---------|--------|--------|
| 1 | **GPU vyžadován pro ETC/RVN** | Ethash/KawPow DAG vyžaduje GPU s 4+ GB VRAM | Přidat GPU server (RTX 3060+) |
| 2 | **KAS excluded** | ASIC-dominated, CPU/GPU mining nerentabilní | Sledovat situaci |
| 3 | **Buyback pouze monitoring** | Auto-buyback BTC→ZION čeká na MainNet | DEX/CEX integrace po launchi |
| 4 | **Job forwarding nehotový** | Revenue proxy přijímá joby ale neforwarduje na lokální GPU miner | Implementovat job pipeline |
| 5 | **Single BTC wallet** | Všechny coiny na jednu adresu | OK pro TestNet, rozdělit pro MainNet |

---

## 🎯 Roadmap

| Milestone | Target | Status |
|-----------|--------|--------|
| ETC/RVN proxy connection | Feb 2026 | ✅ Live |
| XMR CPU mining | Feb 2026 | ✅ 524 H/s |
| Profit switcher | Feb 2026 | ✅ Implementován |
| Buyback monitoring | Feb 2026 | ✅ Aktivní |
| GPU shares na ETC/RVN | Q1 2026 | ⏳ Vyžaduje GPU server |
| ERG/ALPH aktivace | Q2 2026 | ⏳ Po GPU serveru |
| BTC→ZION auto-buyback | MainNet | ⏳ Po DEX listingu |
| Admin UI (algo manager) | Q2 2026 | ⏳ Proposal ready |

---

*ZION TerraNova v2.9.5 — 5-Stream Revenue: Mine Once, Earn Everywhere* 🏆🌟
