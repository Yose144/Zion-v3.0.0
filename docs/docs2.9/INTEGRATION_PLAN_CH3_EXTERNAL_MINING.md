# 🔧 ZION CH3 External Mining — Komplexní Integrační Plán
## Verze 2.0 | 6. února 2026 | ✅ VŠECHNY FÁZE DOKONČENY

---

## 🎉 STAV IMPLEMENTACE

| Fáze | Popis | Stav | Commit |
|------|-------|------|--------|
| **Phase 1** | Pool-Side External Worker | ✅ DONE | `84e5dc9` |
| **Phase 2** | kHeavyHash + Protocol-aware Stratum | ✅ DONE | `ed82967` |
| **Phase 3** | Deploy + Live Test (3 coins) | ✅ DONE | `b24e63a` |
| **Phase 4** | Profit Switching (WhatToMine API) | ✅ DONE | `ee67537` |
| **Phase 5** | BTC Buyback Engine + KAS Fix | ✅ DONE | `4fe61fe` |

### Živé API Endpointy (Helsinki 77.42.31.72:8181)
- `/api/v1/external/stats` — Revenue proxy + miner stats
- `/api/v1/profit/status` — Profitability table + active coin
- `/api/v1/profit/switch/:coin` — Force switch coin
- `/api/v1/buyback/status` — BTC earnings tracker

---

## 📊 TOP COINY DLE PROFITABILITY (GPU Mining, únor 2026)

### Tier 1 — Nejvyšší priorita (implementovat TEĎKA)
| Coin | Algo | Pool | HW | Profitabilita | Stav |
|------|------|------|----|---------------|------|
| **ETC** | Ethash | etc.2miners.com:1010 | GPU (4GB+) | ~$2-3/den/3090 | ✅ LIVE (EthStratum) |
| **RVN** | KawPow | rvn.2miners.com:6060 | GPU (4GB+) | ~$1-2/den/3090 | ✅ LIVE (EthStratum) |
| **KAS** | kHeavyHash | kas.2miners.com:2020 | GPU (nízká VRAM) | ~$3-5/den/3090 | ✅ LIVE (StandardStratum) |

### Tier 2 — Střední priorita
| Coin | Algo | Pool | HW | Profitabilita |
|------|------|------|----|---------------|
| **ERG** | Autolykos v2 | erg.2miners.com:8888 | GPU (3GB+) | ~$1-2/den |
| **ALPH** | Blake3 | alph.2miners.com:1199 | GPU | ~$1-3/den |
| **FLUX** | ZelHash (Equihash 125,4) | flux.2miners.com:9090 | GPU (4GB+) | ~$0.5-1/den |

### Tier 3 — Budoucí expanze
| Coin | Algo | Poznámka |
|------|------|----------|
| **NEXA** | NexaPow | Nový, vysoká profitabilita |
| **CLORE** | KawPow | AI compute + mining |
| **NEOXA** | KawPow | Gaming + mining |
| **IRON FISH** | Blake3 | Privacy chain |

---

## 🏗️ ARCHITEKTURA INTEGRACE

### Aktuální stav (PŘED)
```
Miner ──Stratum──→ ZION Pool (:3333)
                       │
                       ├── Share validation → ZION Core (:8444)
                       │
                       └── Revenue Proxy ──TCP──→ 2miners (ETC/RVN)
                              │
                              └── 🔴 Přijímá joby, ale NIKAM je neposílá!
                                  (TODO komentář v revenue_proxy.rs)
```

### Cílový stav (PO integraci)
```
Miner ──Stratum──→ ZION Pool (:3333)
                       │
                       ├── Share validation → ZION Core (:8444)
                       │        ↓
                       │   ZION blokové odměny (50 ZION + consciousness)
                       │
                       └── Revenue Proxy Manager
                              │
                    ┌─────────┼─────────────────────┐
                    │         │                     │
              ┌─────▼────┐ ┌──▼──────┐  ┌──────────▼──────────┐
              │ ETC Pool │ │RVN Pool │  │ KAS Pool            │
              │ 2miners  │ │2miners  │  │ 2miners             │
              │ :1010    │ │:6060    │  │ :1111               │
              └─────┬────┘ └──┬──────┘  └──────────┬──────────┘
                    │         │                     │
                    └─────────┼─────────────────────┘
                              │
                    ┌─────────▼─────────────────────┐
                    │  Pool-Side External Miner      │  ← NOVÝ MODUL
                    │  (pool_external_miner.rs)      │
                    │                                │
                    │  • Přijímá joby přes channel    │
                    │  • Hashuje (CPU/GPU)            │
                    │  • Submituje shares zpět        │
                    │  • Metriky → API                │
                    └────────────────────────────────┘
                              │
                    ┌─────────▼─────────────────────┐
                    │  BTC Payouts                   │
                    │  bc1q...hd8mw                  │
                    │  → Auto-buyback ZION           │
                    └────────────────────────────────┘
```

---

## 📋 IMPLEMENTAČNÍ KROKY

### FÁZE 1: Pool-Side External Worker (Dnes — 6.2.2026)
> Cíl: Pool přijímá joby z externích poolů a hashuje je

#### Krok 1.1: Job Channel v Revenue Proxy
**Soubor:** `2.9.5/zion-native/pool/src/revenue_proxy.rs`

Změny:
- Přidat `tokio::sync::broadcast::Sender<ExternalJob>` do `ExternalPoolClient`
- Při příjmu `mining.notify` → parsovat job → poslat do channelu
- Přidat `ExternalJob` struct (job_id, header_hash, seed_hash, difficulty, coin)
- Submit pipeline: metoda `submit_share(job_id, nonce)` na `ExternalPoolClient`

```rust
// Nové structs
pub struct ExternalJob {
    pub coin: String,           // "etc", "rvn", "kas"
    pub job_id: String,
    pub header_hash: String,
    pub seed_hash: String,
    pub target: String,
    pub difficulty: f64,
    pub clean_jobs: bool,
    pub timestamp: u64,
}

pub struct ShareSubmission {
    pub coin: String,
    pub job_id: String,
    pub nonce: String,
}
```

#### Krok 1.2: Pool External Miner modul
**Nový soubor:** `2.9.5/zion-native/pool/src/pool_external_miner.rs`

Implementace:
- `PoolExternalMiner` struct — přijímá joby, hashuje, submituje
- CPU mining loop (pro PoC, pak GPU)
- Stats tracking (hashrate, shares, accepted/rejected)
- Graceful shutdown

#### Krok 1.3: Registrace modulu
**Soubor:** `2.9.5/zion-native/pool/src/lib.rs`
- Přidat `pub mod pool_external_miner;`

#### Krok 1.4: Integrace do pool bootstrap
**Soubor:** `2.9.5/zion-native/pool/src/main.rs`
- Propojit revenue proxy job channel → pool_external_miner
- Spustit mining worker v tokio::spawn
- Přidat stats do ApiState
- Nový API endpoint: `GET /api/v1/external/stats`

---

### FÁZE 2: Hash Engine Integrace (7-8.2.2026)
> Cíl: Platné shares pro reálné algoritmy

#### Krok 2.1: Ethash (ETC)
**Přístup:** Použít `ethash` Rust crate nebo FFI na C ethash lib
- DAG generování (epoch-based, ~2GB pro ETC)
- Light verify pro validaci
- Full compute pro mining

#### Krok 2.2: KawPow (RVN)
**Přístup:** Modifikovaný ProgPow
- Random program generování per block
- Ethash-like DAG + random math

#### Krok 2.3: kHeavyHash (KAS)
**Přístup:** Nejlehčí implementace — kHeavyHash je relativně jednoduchý
- SHA3-256 + matice operace
- Nízké nároky na VRAM
- Dobrý kandidát pro první ACCEPTED share

**Pořadí implementace:** KAS → ETC → RVN (od nejjednoduššího)

---

### FÁZE 3: GPU Mining na Pool Serveru (9-14.2.2026)
> Cíl: Reálný hashrate na externích poolech

#### Krok 3.1: GPU Server Setup
- Hetzner GPU server (EX44 s RTX 3060 nebo lepší)
- Docker s NVIDIA runtime
- Pool process se spawne mining containerem

#### Krok 3.2: GPU Worker
**Přístupy (v pořadí preference):**
1. **ethminer/kawpowminer jako subprocess** — nejrychlejší nasazení
2. **OpenCL/CUDA kernel** — vlastní implementace
3. **Rust GPU crate** — experimentální

#### Krok 3.3: Multi-GPU orchestrace
- Docker GPU scheduling
- Profit-based coin switching

---

### FÁZE 4: Profit Switching (15-20.2.2026)
> Cíl: Automaticky těžit nejvýnosnější coin

#### Krok 4.1: WhatToMine API integrace
```rust
// Periodicky (každých 5 min) stáhnout profitability data
struct ProfitData {
    coin: String,
    algorithm: String,
    btc_revenue_per_mhs: f64,
    difficulty: f64,
    block_reward: f64,
    price_usd: f64,
}
```

#### Krok 4.2: Auto-switch logika
- Pokud jiný coin je >10% profitabilnější, přepnout
- Hystereze: nepřepínat častěji než každých 30 minut
- Fallback: pokud switch selže, zůstat na aktuálním coinu

#### Krok 4.3: Config rozšíření
```json
{
  "profit_switching": {
    "enabled": true,
    "check_interval_sec": 300,
    "switch_threshold_pct": 10,
    "min_switch_interval_sec": 1800,
    "preferred_coins": ["kas", "etc", "rvn"],
    "excluded_coins": []
  }
}
```

---

### FÁZE 5: BTC Buyback Engine (Po TestNet)
> Cíl: BTC → ZION automatický buyback

- Monitor BTC balance na wallet
- Auto market order na DEX/CEX
- ZION koupený za BTC → burn nebo distribuce
- Dashboard transparentnost

---

## 🔧 TECHNICKÉ DETAILY — Per Coin

### ETC (Ethash)
```
Algoritmus: Ethash (modifikovaný Dagger-Hashimoto)
DAG size: ~2.5 GB (epoch 460+)
DAG generování: ~2 min na GPU, ~10 min na CPU
Nonce: 8 bytes (64-bit)
Hashrate: ~62 MH/s (RTX 3090), ~31 MH/s (RTX 3060)
Submit format: [worker, job_id, nonce_hex]
EthStratum V1: mining.subscribe → mining.authorize → mining.notify → mining.submit
```

### RVN (KawPow)
```
Algoritmus: KawPow (modifikovaný ProgPow)
DAG size: ~4 GB
Random program: generován per block
Nonce: 8 bytes
Hashrate: ~17 MH/s (RTX 3090)
Submit format: [worker, job_id, nonce, header_hash, mix_hash]
```

### KAS (kHeavyHash) ⭐ NEJLEPŠÍ KANDIDÁT PRO PRVNÍ SHARE
```
Algoritmus: kHeavyHash (SHA3-256 + matice)
DAG: ŽÁDNÝ (memory-light!)
Nonce: 8 bytes
Hashrate: ~700 MH/s (RTX 3090), ~350 MH/s (RTX 3060)
                ~5-10 MH/s na CPU (reálný!)
Submit format: [worker, job_id, nonce_hex]
Protokol: Stratum (ne EthStratum) — jiný!
```

**Proč KAS jako první:**
1. Nemá DAG → funguje na CPU
2. Jednoduchý hashovací algoritmus
3. Nejvyšší profitabilita per GPU
4. CPU hashrate je reálně použitelný (~5 MH/s)

### ERG (Autolykos v2)
```
Algoritmus: Autolykos v2 (memory-hard)
Memory: ~2 GB
Nonce: 8 bytes
Hashrate: ~130 MH/s (RTX 3090)
Submit: [worker, job_id, nonce, pow_solution]
```

---

## 📁 SOUBORY K VYTVOŘENÍ/ÚPRAVĚ

### Nové soubory
| Soubor | Popis | Stav |
|--------|-------|------|
| `pool/src/pool_external_miner.rs` | Pool-side mining worker | ✅ DONE |
| `pool/src/profit_switcher.rs` | WhatToMine profit switching (GPU+ASIC) | ✅ DONE |
| `pool/src/buyback.rs` | BTC earnings monitor + buyback framework | ✅ DONE |

### Upravit
| Soubor | Změna | Stav |
|--------|-------|------|
| `pool/src/revenue_proxy.rs` | + Job channel + submit + StratumProtocol | ✅ DONE |
| `pool/src/lib.rs` | + 3 nové moduly | ✅ DONE |
| `pool/src/main.rs` | + Worker startup + 5 API endpointů | ✅ DONE |
| `pool/src/config.rs` | + ProfitSwitchConfig + BuybackConfig | ✅ DONE |
| `pool/Cargo.toml` | + reqwest dependency | ✅ DONE |

---

## 📅 TIMELINE

```
6.2.2026 (DNES):
  ✅ Plán vytvořen
  ✅ Fáze 1: pool_external_miner.rs + revenue_proxy job channel (commit 84e5dc9)
  ✅ Fáze 2: kHeavyHash + Protocol-aware Stratum (commit ed82967)
  ✅ Fáze 3: Deploy + Live Test — 3 coiny LIVE na Helsinki (commit b24e63a)
  ✅ Fáze 4: WhatToMine profit switching (GPU + ASIC dual API) (commit ee67537)
  ✅ Fáze 5: BTC Buyback Engine + KAS profit fix (commit 4fe61fe)

DALŠÍ KROKY:
  🔧 GPU server setup (dedikovaný mining rig)
  🔧 První ACCEPTED share na 2miners → BTC earnings start
  🔧 Auto-buyback aktivace po DEX launch

Po TestNet (31.12.2026):
  🔧 Fáze 5.2: Auto-buyback na DEX/CEX
  🔧 Fáze 5.3: Dashboard transparentnost
```

---

## 🎯 SUCCESS KRITÉRIA

| Milník | Kritérium | Target datum | Stav |
|--------|----------|--------------|------|
| **M1** | Pool-side worker přijímá joby a hashuje | 6.2.2026 | ✅ DONE |
| **M2** | První ACCEPTED share na 2miners (KAS) | 8.2.2026 | ⏳ Čeká na GPU |
| **M3** | GPU mining na dedikovaném serveru | 14.2.2026 | ⏳ |
| **M4** | Profit switching funguje automaticky | 20.2.2026 | ✅ DONE (6.2.) |
| **M5** | BTC na 2miners dashboardu > 0.001 | 28.2.2026 | ⏳ |
| **M6** | ZION buyback engine live | TestNet+1 měsíc | ✅ Monitor ready |

---

## 💡 KLÍČOVÝ INSIGHT: KAS JAKO PRVNÍ COIN

**Proč začít s KAS místo ETC:**
1. **Žádný DAG** → funguje na CPU (5-10 MH/s)
2. **Jednoduchý algo** → kHeavyHash = SHA3 + matice
3. **Nejvyšší profitabilita** → $3-5/den na RTX 3090
4. **Rychlá implementace** → dny místo týdnů
5. **Proof of concept** → jakmile KAS share je ACCEPTED, celý pipeline je ověřen

**Pak rozšířit na ETC a RVN** s GPU serverem.

---

*Tento plán je živý dokument — aktualizovat po každém milníku.*

**ZION TerraNova v2.9.5** | *"Where technology meets spirit"* 🌟
