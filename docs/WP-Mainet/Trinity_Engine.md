# Trinity Engine — Tři proudy jedné řeky

> **Status:** ŽIVÉ v `V31/L1/miner/` · 33 externích mincí · autonomous profit router
> **Licence:** MIT (jádro + pool) · Trinity engine je bonusová vrstva nad otevřeným jádrem
> **Verze:** 3.0.6-beta → 3.1.0-alpha.2

---

## Co je Trinity

Trinity je těžební engine zabudovaný v oficiálním ZION mineru. Dělá jednu věc: **vytěží z tvého hardware víc hodnoty, než dokáže samotný ZION canonical mining, a vyplatí ti ji.**

Jak? Tím, že tvůj počítač nečeká. Každý takt procesoru, každý cyklus GPU se využije — buď na ZION bloky, nebo na externí mince, které se pak promění v ZION.

**Tři streamy. Jedna řeka. Jeden výstup.**

---

## Architektura — tři proudy

```
                    ┌─────────────────────────────────┐
                    │        ZION Miner (V31)         │
                    │                                 │
                    │  Stream 1: ZION canonical       │
                    │  ├─ Deeksha Lite Fire PoW       │
                    │  ├─ Solo nebo pool              │
                    │  └─ Vždy zapnutý (primární)     │
                    │                                 │
                    │  Stream 2: GPU AuxPoW           │
                    │  ├─ Externí GPU mince           │
                    │  ├─ Autonomous profit switch    │
                    │  └─ Volitelný (lze vypnout)     │
                    │                                 │
                    │  Stream 3: CPU AuxPoW           │
                    │  ├─ Externí CPU mince           │
                    │  ├─ Autonomous profit switch    │
                    │  └─ Volitelný (lze vypnout)     │
                    │                                 │
                    │  → Výstup: ZION na tvé adrese   │
                    └─────────────────────────────────┘
```

### Stream 1 — ZION canonical (vždy hlavní)

- **Algoritmus:** `deeksha_lite_fire` (height ≥ 5000, 65 536 thermal iterací)
- **Režim:** Solo mining (přes node RPC) nebo pool mining (Stratum v1)
- **Odměna:** 5 400,067 ZION/blok (dekáda 1), split 89/5/5/1
- **Nelze vypnout** — je to kořen. Bez Stream 1 není Trinity.

### Stream 2 — GPU AuxPoW (volitelný)

- **Hardware:** GPU (NVIDIA CUDA, AMD OpenCL, Apple Metal)
- **Mince:** 30+ GPU-kompatibilních mincí (KAS, ALPH, DCR, RVN, ERG, ETC, BEAM, ZEC, ...)
- **Výběr:** Autonomous profit router (WhatToMine API) nebo manuální (`--auxpow-pool`)
- **Účel:** Vytěžit externí minci → pool konvertuje na ZION → tvůj balance roste

### Stream 3 — CPU AuxPoW (volitelný)

- **Hardware:** CPU (x86, ARM, Apple Silicon)
- **Mince:** CPU-kompatibilní (XMR RandomX, VRSC VerushHash, RTM GhostRider)
- **Výběr:** Stejný autonomous router nebo manuální (`ZION_STREAM3_FORCE_COIN`)
- **Účel:** Utilizovat CPU, které by jinak stálo nečinně

---

## 33 externích mincí

Kompletní seznam mincí podporovaných Trinity engine. Každá má vlastní algoritmus, pool preference a VRAM požadavky.

| Mince | Ticker | Algoritmus | Typ | GPU kernel |
|-------|--------|------------|-----|------------|
| Kaspa | KAS | kheavyhash | GPU | ✅ CUDA + OpenCL |
| Alephium | ALPH | blake3_alph | GPU | ✅ |
| Decred | DCR | blake3_dcr | GPU | ✅ |
| Vertcoin | VTC | verthash | GPU | ✅ |
| Ravencoin | RVN | kawpow | GPU | ✅ |
| Monero | XMR | randomx | CPU | — |
| EpicCash | EPIC | progpow | GPU | ✅ |
| Zano | ZANO | progpowz | GPU | ✅ |
| Meowcoin | MEWC | meowpow | GPU | ✅ |
| Clore | CLORE | kawpow | GPU | ✅ |
| Flux | FLUX | zelhash | GPU | ✅ |
| Neoxa | NEOX | kawpow | GPU | ✅ |
| Ethereum Classic | ETC | etchash | GPU | ✅ |
| Bitcoin | BTC | sha256d | GPU | ✅ |
| Verus | VRSC | verushash | CPU | — |
| Ergo | ERG | autolykos | GPU | ✅ |
| Evrmore | EVR | evrprogpow | GPU | ✅ |
| Pearl | PRL | pearlhash | GPU | ⚠️ disabled |
| Quai | QUAI | kawpow | GPU | ✅ |
| Beam | BEAM | beamhash | GPU | ✅ |
| Karlsen | KLS | karlsenhash | GPU | ✅ |
| Zclassic | ZCL | equihashzero | GPU | ✅ |
| Qubitcoin | QTC | qhash | GPU | ✅ |
| IronFish | IRON | fishhash | GPU | ✅ |
| Nexa | NEXA | nexapow | GPU | ✅ |
| Raptoreum | RTM | ghostrider | CPU | — |
| Dynex | DNX | dynexsolve | GPU | ✅ |
| Nervos | CKB | eaglesong | GPU | ✅ |
| Conflux | CFX | octopus | GPU | ✅ |
| Zcash | ZEC | equihash | GPU | ✅ |
| PhoenixCoin | PHX | neoscrypt | GPU | ✅ |
| Keryx | KRX | keryxhash | GPU | ✅ |

> **Zdroj:** `V31/L1/cosmic-harmony/src/profit.rs:47-81` — `enum ExternalCoin`, `algorithm()`, `gpu_kernel_available()`

---

## Autonomous profit router

Trinity se sám rozhoduje, kterou minci těžit na Stream 2 a 3. Nepotřebuješ nic nastavovat.

**Jak funguje:**
1. Fetchuje profit data z WhatToMine API (co `profit_per_unit_usd` pro každou minci)
2. Spočítá `profit_usd_per_day` pro tvůj konkrétní hashrate
3. Vybere nejvýnosnější minci pro GPU (Stream 2) a CPU (Stream 3)
4. **Hysteresis:** přepne jen pokud je nová mince o **15 % ziskovější** (zabraňuje fluktuaci)
5. Opakuje každých `ZION_PROFIT_INTERVAL` sekund (default 300s)

**Env vars:**
```bash
ZION_AUTONOMOUS=true          # zapne autonomous router (default: true)
ZION_PROFIT_INTERVAL=300      # interval přepočtu (sekundy)
ZION_PROFIT_HYSTERESIS=0.15   # 15% hysteresis
ZION_STREAM3_FORCE_COIN=XMR   # vynutit konkrétní CPU minci
```

> **Zdroj:** `V31/L1/miner/src/autonomous.rs` — `AutonomousProfitRouter`, `select_stream2()`, `select_stream3()`

---

## Boost Streams — veřejný branding

Veřejný repozitář (`public/`) a free CLI build používají **`public_build` feature flag**. Ten skrývá názvy externích mincí z TUI, logů a status obrazovek. Uživatel vidí jen:

```
Stream 1: ZION         [ACTIVE]   2.4 MH/s
Stream 2: Boost GPU    [ACTIVE]   21 MH/s
Stream 3: Boost CPU    [ACTIVE]   450 H/s
```

Ne:
```
Stream 2: ERG (autolykos)   21 MH/s
Stream 3: XMR (randomx)     450 H/s
```

**Proč?**
1. **ZION je hlavní produkt.** Uživatel má vidět, že těží ZION — ne 33 různých mincí, které nezná.
2. **ZION má mít hodnotu a likviditu.** Pokud uživatel vidí "těžím ERG", může ho prodat. Pokud vidí "Boost", ví že výsledek je ZION.
3. **Jednoduchost.** Začátečník nechce vybírat z 33 mincí. Chce zapnout a těžit.

**Co `public_build` skrývá:**
- Názvy externích mincí v TUI/logu
- Manuální výběr mincí (`--auxpow-pool` s konkrétním coin)
- Profit data per mince

**Co `public_build` neskrývá:**
- Mining core běží stejně — 3 streamy, autonomous router, 33 mincí
- Pool přijímá shares a forwarduje na externí pooly
- Odměna přichází (koncept: v ZION; dnes: v externí minci na poolu)

> **Zdroj:** `AGENTS.md` řádky 124-135 — feature flags pro public build

---

## Příkazy

### Free CLI (public_build — Boost Streams)

```bash
# ZION + Boost (vše automaticky, výstup v ZION)
zion miner start --reward-address zion1TVOJEADRESA --pool-url pool.zionterranova.com:8444

# Vypnout GPU Boost
zion miner start --reward-address zion1... --pool-url pool.zionterranova.com:8444 --no-gpu

# Vypnout CPU Boost
zion miner start --reward-address zion1... --pool-url pool.zionterranova.com:8444 --no-cpu

# Jen ZION, bez Boost (čistý canonical mining)
zion miner start --reward-address zion1... --pool-url pool.zionterranova.com:8444 --no-gpu --no-cpu
```

### Plná verze (premium unlock — odemčené streamy)

```bash
# ZION + ERG na GPU + XMR na CPU (manuální volba)
zion miner start --reward-address zion1... \
  --pool-url pool.zionterranova.com:8444 \
  --auxpow-pool erg.herominers.com:1180 \
  --worker tvuj_worker

# Vynutit konkrétní CPU minci
ZION_STREAM3_FORCE_COIN=RTM zion miner start --reward-address zion1... --pool-url pool.zionterranova.com:8444

# Jen externí mince (bez ZION streamu)
zion miner start --reward-address zion1... --no-zion --auxpow-pool erg.herominers.com:1180
```

---

## Co je implementováno a co je koncept

| Funkce | Stav | Zdroj |
|--------|------|-------|
| Stream 1 (ZION canonical) | ✅ ŽIVÉ | `runtime.rs:309-360` |
| Stream 2 (GPU AuxPoW) | ✅ ŽIVÉ | `runtime.rs:362-400` |
| Stream 3 (CPU AuxPoW) | ✅ ŽIVÉ | `runtime.rs:402-430` |
| 33 externích mincí | ✅ ŽIVÉ | `profit.rs:47-81` |
| Autonomous profit router | ✅ ŽIVÉ | `autonomous.rs` |
| `public_build` flag (Boost branding) | ✅ ŽIVÉ | `AGENTS.md:124-135` |
| Pool-side konverze na ZION | ⏳ KONCEPT | `docs/3.0.6/TRIPLE_STREAM_ZION_LIQUIDITY.md` |
| True AuxPoW consensus | ⏳ FUTURE | `StatusV3.md:223` |
| Zion Grow dashboard | ⏳ PLÁN (v3.0.7) | `WpStory6.md:146` |
| Zion Liquidity metrics | ⏳ PLÁN (v3.0.8) | `WpStory6.md:148` |

> **Pool-side konverze:** Dnes pool forwarduje shares na externí pooly (2miners, zpool, HeroMiners). Těžař dostává odměnu v externí minci na svém účtu u toho poolu. Plán: pool konvertuje externí odměnu na ZION a vyplácí těžaři přímo ZION. To je Zion Liquidity — viz [`Zion_Grow_Liquidity.md`](./Zion_Grow_Liquidity.md).

---

## Architektura — kde co žije

```
V31/L1/miner/src/
├── config.rs          — Triple Stream config (stream1/2/3_enabled, force_coin)
├── runtime.rs         — MinerRuntime: spawn 3 streamů, stats, share recording
├── autonomous.rs      — AutonomousProfitRouter: WhatToMine API, hysteresis
├── stream.rs          — StreamId, StreamStats
└── auxpow/
    ├── client.rs      — Stratum klient pro externí pooly (6 protokolů)
    ├── native.rs      — Native hash funkce per mince
    ├── pure.rs        — Pure Rust hash funkce (fallback)
    └── types.rs       — ExternalJob, Share, ShareResult

V31/L1/cosmic-harmony/src/
└── profit.rs          — ExternalCoin enum (33 mincí), algorithm(), ProfitRouter
```

---

*→ Pokračování: [Zion Grow & Liquidity — ekonomický model](./Zion_Grow_Liquidity.md)*

*→ Zpět na [Paluba](./SulZeme/Paluba.md) · [Sůl této země](./SulZeme/00-README.md)*

*Gate, Gate, Paragate, Parasamgate, Bodhi Svaha.*
