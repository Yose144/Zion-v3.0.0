# 🏆 ZION CH3 Revenue Mining — Kompletní Report & Integrační Plán
## 6. února 2026 | Unified Mining Architecture

---

## 🎯 VIZE

```
Miner těží CHv3 (ZION) → Pool přijme shares → Pool na pozadí forwarduje
hashpower na 2miners → BTC výplata → ZION buyback → Deflace
```

**Princip:** Miner NEVÍ o externích poolech. Těží Cosmic Harmony v3 na ZION poolu.
Pool na pozadí tuto sílu monetizuje přes externí pooly (ETC, RVN, ERG, KAS).
BTC výtěžek jde zpět do ekosystému ZION jako buyback = deflační tlak.

---

## 📊 AKTUÁLNÍ STAV — Co máme hotové

### ✅ 1. Rust Universal Miner — External Pool klient
| Soubor | Řádky | Stav |
|--------|-------|------|
| `zion-universal-miner/src/stratum/ethstratum.rs` | ~514 | ✅ Hotovo |
| `zion-universal-miner/src/miner/external_pool.rs` | ~387 | ✅ Hotovo |
| `zion-universal-miner/src/main.rs` | rozšířen | ✅ CLI args |

- Plný **EthStratum V1** async klient (tokio)
- **6 coinů**: ETC, RVN, ERG, KAS, ALPH, FLUX
- Subscribe → Authorize → Mining.notify → Submit
- Reconnect s konfigurovatelným počtem pokusů
- `ExternalPoolManager` pro běh více coinů současně
- CLI: `--external-coin etc --external-pool host:port --external-wallet BTC --external-percent 25`

### ✅ 2. Python External Pool Miner
| Soubor | Řádky | Stav |
|--------|-------|------|
| `mining/external_pool_miner.py` | ~672 | ✅ Otestováno |

- Standalone modul i integrovaný do `zion_native_miner_v2_9.py`
- Threading-based EthStratum V1 klient
- Event-based response handling (opravený socket conflict)

**Test výsledek (USA server 5.78.145.234):**
```
15:38:32 ✅ TCP Connect → etc.2miners.com:1010
15:38:33 ✅ Subscribe OK (extranonce: ab05)
15:38:33 ✅ Authorize OK (wallet.worker)
15:38:33 ⚡ Difficulty: 1.999969
15:38:33 📋 Job přijat: 780b2
15:38:33 💎 Share submit → Pool: "Invalid share" (sha3 ≠ Ethash — očekáváno)
```

### ✅ 3. Revenue Proxy na Poolu (Rust)
| Soubor | Řádky | Stav |
|--------|-------|------|
| `zion-native/pool/src/revenue_proxy.rs` | ~338 | ✅ LIVE |

- **LIVE na Helsinki** — kontejner `zion-pool:2.9.5-btc`
- ETC → `etc.2miners.com:1010` (proxy :3341) — připojeno, joby přicházejí
- RVN → `rvn.2miners.com:6060` (proxy :3342) — připojeno, joby přicházejí
- Auto-reconnect, EthStratum V1 handshake

### ✅ 4. Pool — Share Acceptance Fix
- Fix `json!(true)` místo `json!(false)` v `server_v2.rs`
- Mineri úspěšně dostávají share potvrzení od ZION poolu

### ✅ 5. CH3 Revenue Config System
```json
{
  "version": "2.9.5-ch3",
  "revenue_streams": {
    "zion_native": { "enabled": true, "allocation_percent": 50 },
    "etc":         { "enabled": true, "pool": "etc.2miners.com:1010", "proxy_port": 3341 },
    "rvn":         { "enabled": true, "pool": "rvn.2miners.com:6060", "proxy_port": 3342 },
    "ncl":         { "enabled": true, "npu_allocation_percent": 30 }
  },
  "btc_wallet": "bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw"
}
```

---

## 🏗️ CÍLOVÁ ARCHITEKTURA

```
┌─────────────────────────────────────────────────────────────────┐
│                      SVĚT MINERA                                 │
│                                                                  │
│  Miner vidí POUZE:                                               │
│  • ZION pool (pool.zionterranova.com:3333)                       │
│  • Cosmic Harmony v3 algoritmus                                  │
│  • ZION odměny + consciousness XP bonus                          │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │          ZION Rust Universal Miner v2.9.5                 │   │
│  │                                                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │  CPU Mining   │  │  GPU Mining   │  │  NCL Client    │  │   │
│  │  │  CosmicH v3   │  │  Metal/CUDA   │  │  AI inference  │  │   │
│  │  │  RandomX      │  │  Vulkan       │  │  úlohy         │  │   │
│  │  └───────┬───────┘  └───────┬───────┘  └───────┬────────┘  │   │
│  │          │                  │                   │           │   │
│  │          └──────┬───────────┘                   │           │   │
│  └─────────────────┼───────────────────────────────┼───────────┘   │
│                    │ Stratum                       │ gRPC          │
└────────────────────┼───────────────────────────────┼───────────────┘
                     │ :3333                         │
                     ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SVĚT POOLU (Helsinki)                       │
│                                                                  │
│  Pool dělá TŘI věci současně:                                    │
│                                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  1️⃣  ZION NATIVE MINING (50% — primární funkce)                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Stratum Server (:3333)                                   │   │
│  │  • Přijímá CHv3 shares od minerů                          │   │
│  │  • Validuje proti ZION Core (:8444 RPC)                   │   │
│  │  • PPLNS odměny: 50 ZION + consciousness bonus            │   │
│  │  • VarDiff, session management, XP tracking               │   │
│  │                                                           │   │
│  │              ┌──────────────────┐                         │   │
│  │              │  ZION Core Node  │                         │   │
│  │              │  :8444 RPC       │                         │   │
│  │              │  :8334 P2P       │                         │   │
│  │              │  Block templates │                         │   │
│  │              └──────────────────┘                         │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  2️⃣  EXTERNAL REVENUE MINING (25% — pool-side worker)            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Revenue Proxy Manager (revenue_proxy.rs)                 │   │
│  │  • Drží TCP připojení k externím poolům                   │   │
│  │  • Přijímá joby (mining.notify)                           │   │
│  │                                                           │   │
│  │          ┌──────────────────────────────────┐             │   │
│  │          │   Pool-Side External Miner       │  ← CHYBÍ!  │   │
│  │          │   (pool_external_miner.rs)       │             │   │
│  │          │                                  │             │   │
│  │          │   • Přebírá joby z revenue proxy │             │   │
│  │          │   • Hashuje na GPU serveru        │             │   │
│  │          │   • Submituje shares na 2miners   │             │   │
│  │          └──────────┬───────────────────────┘             │   │
│  │                     │                                     │   │
│  │     ┌───────────────┼───────────────┐                     │   │
│  │     │               │               │                     │   │
│  │  ┌──▼──┐        ┌───▼──┐        ┌──▼──┐                  │   │
│  │  │ ETC │        │ RVN  │        │ ERG │                   │   │
│  │  │2min.│        │2min. │        │2min.│                   │   │
│  │  │:1010│        │:6060 │        │:8888│                   │   │
│  │  └──┬──┘        └──┬───┘        └──┬──┘                   │   │
│  │     └───────────────┼──────────────┘                      │   │
│  │                     ▼                                     │   │
│  │           ┌─────────────────┐                             │   │
│  │           │   BTC Payouts   │                             │   │
│  │           │  bc1q...hd8mw   │                             │   │
│  │           └────────┬────────┘                             │   │
│  │                    ▼                                      │   │
│  │           ┌─────────────────┐                             │   │
│  │           │  BTC → ZION     │                             │   │
│  │           │  Buyback Engine │  ← CHYBÍ!                   │   │
│  │           │  (deflace)      │                             │   │
│  │           └─────────────────┘                             │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  3️⃣  NCL AI COMPUTE (25% — Neural Compute Layer)                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  NCL Manager                                              │   │
│  │  • Alokuje 30% NPU pro AI inference                       │   │
│  │  • Token odměny za compute                                │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔴 CO CHYBÍ K PLNÉ INTEGRACI

### KRITICKÉ — Bez tohoto to nefunguje

| # | Chybějící komponenta | Popis | Kde implementovat |
|---|---------------------|-------|-------------------|
| **K1** | **Pool-Side External Miner** | Pool musí mít vlastní mining proces co přijímá joby z revenue proxy a hashuje | Nový `pool_external_miner.rs` v pool kódu |
| **K2** | **Ethash DAG Engine** | Bez reálného Ethash DAG (2GB+) nelze vytvořit platný ETC share | `native-libs/ethash/` FFI nebo ethminer subprocess |
| **K3** | **GPU Hardware** | Hetzner VPS nemá GPU — CPU nikdy nevytvoří platný Ethash | Nový server s RTX 3060+ |
| **K4** | **Job Forwarding Pipeline** | Revenue proxy přijímá joby ale neforwarduje je na local miner | `revenue_proxy.rs` — TODO komentář v kódu |

### DŮLEŽITÉ — Pro produkční kvalitu

| # | Komponenta | Popis |
|---|-----------|-------|
| **D1** | Profit Switching | Auto-switch mezi ETC/RVN/ERG podle WhatToMine profitability |
| **D2** | BTC → ZION Buyback | Automatický nákup ZION za BTC výtěžek |
| **D3** | External Mining Stats API | `GET /api/v1/external/stats` — hashrate, shares, BTC earned |
| **D4** | Frontend Dashboard | Vizualizace externího miningu pro uživatele |

---

## 🗺️ IMPLEMENTAČNÍ PLÁN

### Fáze 1: Pool-Side External Worker (7-9 Feb)
```
Cíl: Pool sám těží na externích poolech z přijatých jobů

1. pool_external_miner.rs
   ├── Přijímá EthStratum joby z revenue_proxy
   ├── CPU hash (simplified) pro PoC
   ├── Submituje shares zpět na 2miners  
   └── Metriky: hashrate, shares, uptime

2. Integrace do pool main.rs
   ├── Automatický start pokud ch3_revenue_settings.enabled
   └── Graceful shutdown

3. API rozšíření
   └── GET /api/v1/external/stats → JSON
```

### Fáze 2: Reálný Ethash Mining (10-14 Feb)
```
Cíl: První ACCEPTED share na 2miners

1. GPU server
   ├── Hetzner GPU (EX44 s RTX 3060) nebo vlastní
   └── Docker ready

2. Ethash integrace
   ├── Varianta A: ethminer jako subprocess
   ├── Varianta B: FFI binding na ethash C lib  
   └── Varianta C: ethash-rs pure Rust crate

3. Test
   └── 🎯 Dashboard: etc.2miners.com/account/bc1q...hd8mw → ACCEPTED
```

### Fáze 3: Profit Switching + Buyback (Po TestNet)
```
1. WhatToMine API → auto coin selection
2. BTC → ZION automated buyback
3. Miner transparency dashboard
```

---

## 💰 EKONOMICKÝ MODEL CH3

### Revenue Split
```
                    100% Pool Hashpower
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼────┐  ┌───▼────┐  ┌───▼────┐
         │  50%    │  │  25%   │  │  25%   │
         │ ZION    │  │ Ext.   │  │ NCL    │
         │ Native  │  │ Mining │  │ AI     │
         │ CHv3    │  │ BTC    │  │ Compute│
         └────┬────┘  └───┬────┘  └───┬────┘
              │            │            │
              ▼            ▼            ▼
         50 ZION/blk   BTC payout   Token odměny
         + conscious.  → buyback    za inference
         bonus         → deflace
```

### Příklad — 10 minerů s celkovým 500 H/s CHv3
```
ZION Mining (50%):
  • Block time: 60s → ~1440 bloků/den
  • Odměna: 50 + 1569.63 × multiplier ZION/blok
  • Distribuce: 89% minerům, 10% humanitární, 1% pool

External Mining (25% — pool-side GPU):
  RTX 3090 @ 62 MH/s (ETC):
  • ~$2-3/den → ~$60-90/měsíc BTC
  • Buyback → ZION deflační tlak

NCL AI (25%):
  • AI inference úlohy na NPU
  • Token odměny za compute power
```

---

## 🖥️ INFRASTRUKTURA

| Server | IP | Role | HW | Docker |
|--------|-----|------|-----|--------|
| Helsinki | 77.42.31.72 | SEED + Pool + Revenue Proxy | ARM64 4GB | `zion-pool:2.9.5-btc` ✅ |
| USA | 5.78.145.234 | PEER + Test miner | AMD64 4GB | `zion-core:2.9.5` ✅ |
| Singapore | 5.223.56.124 | PEER + budoucí pool | AMD64 4GB | `zion-core:2.9.5` ✅ |
| **GPU Server** | **TBD** | **External mining HW** | **RTX 3060+** | **❌ POTŘEBA** |

### Aktivní porty (Helsinki)
```
:3333  — Stratum server (mineri → CHv3)
:3341  — ETC revenue proxy → etc.2miners.com:1010
:3342  — RVN revenue proxy → rvn.2miners.com:6060
:8080  — Pool stats API
:8444  — Core RPC (block templates, submit)
:8334  — P2P network (peer discovery)
:6379  — Redis (shares, cache)
```

---

## 📁 SOUBORY V PROJEKTU

### Nově vytvořené (6. Feb 2026)
| Soubor | Typ | Řádky | Popis |
|--------|-----|-------|-------|
| `zion-universal-miner/src/stratum/ethstratum.rs` | Rust | 514 | EthStratum V1 async klient |
| `zion-universal-miner/src/miner/external_pool.rs` | Rust | 387 | External pool mining modul |
| `mining/external_pool_miner.py` | Python | 672 | Standalone external miner |

### Existující klíčové soubory
| Soubor | Popis | Stav |
|--------|-------|------|
| `zion-native/pool/src/revenue_proxy.rs` | Pool-side revenue proxy | ✅ LIVE |
| `zion-native/pool/src/config.rs` | CH3 config loading | ✅ LIVE |
| `zion-native/pool/src/stratum/server_v2.rs` | Stratum server | ✅ Fixed |
| `zion-native/pool/src/main.rs` | Pool bootstrap + API | ✅ LIVE |
| `config/ch3_revenue_settings.json` | Revenue config | ✅ Deployed |

### Upravené (6. Feb 2026)
| Soubor | Změna |
|--------|-------|
| `zion-universal-miner/src/stratum/mod.rs` | + `pub mod ethstratum` |
| `zion-universal-miner/src/miner/mod.rs` | + `pub mod external_pool` |
| `zion-universal-miner/src/main.rs` | + CLI args + startup |
| `zion_native_miner_v2_9.py` | + external pool integration |

---

## 🧪 TESTOVACÍ PROTOKOL

### ✅ Test 1: Python Miner → 2miners ETC (USA server)
```
Příkaz: python3 external_pool_miner.py --coin etc --wallet bc1q...hd8mw --worker zion-usa
Výsledek: Connect ✅ | Subscribe ✅ | Authorize ✅ | Jobs ✅ | Submit ✅
Shares: "Invalid share" (sha3 ≠ Ethash — expected without DAG)
```

### ✅ Test 2: Revenue Proxy → 2miners (Helsinki pool)
```
Docker: zion-pool:2.9.5-btc na Helsinki
Výsledek: ETC connected ✅ | RVN connected ✅ | Joby přicházejí ✅
```

### ✅ Test 3: Miner → ZION Pool Share Accept
```
Fix: json!(true) v server_v2.rs
Výsledek: Shares se přijímají ✅
```

### ❌ Test 4: Platný Ethash share (PENDING)
```
Potřeba: GPU server + Ethash DAG
Cíl: ACCEPTED na etc.2miners.com/account/bc1q...hd8mw
Status: ČEKÁ NA GPU HARDWARE
```

---

## 🎉 ZÁVĚR

### Co máme:
✅ Kompletní EthStratum V1 klient (Rust + Python)
✅ Revenue proxy LIVE na poolu (ETC + RVN)
✅ Share acceptance opravena na ZION poolu
✅ CH3 revenue config systém
✅ Celá architektura navržena a zdokumentována

### Co potřebujeme:
🔴 Pool-side external miner (`pool_external_miner.rs`)
🔴 GPU hardware pro reálný Ethash
🔴 Ethash DAG integrace
🟡 Profit switching
🟡 BTC buyback engine

### Klíčový princip:
> **Miner těží CHv3 → Pool monetizuje → BTC → ZION buyback → Deflace**
>
> Miner nemusí nic vědět o externích poolech.
> Pool to řeší na pozadí. Win-win pro celý ekosystém.

---

**BTC Dashboard:** https://etc.2miners.com/account/bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw

**ZION TerraNova v2.9.5 — "Quantum Leap"**
*TestNet: 31.12.2025 → Mainnet: 31.12.2026*

🌟 *"Where technology meets spirit — and hashpower meets revenue."* 🌟
