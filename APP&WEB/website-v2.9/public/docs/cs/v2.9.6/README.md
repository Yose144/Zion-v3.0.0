# 🚀 ZION TerraNova v2.9.6 — fork před mainnetem

> **„On the Star“ — kde technologie potkává ducha, od blockchainu ke hvězdám.**

[![Build](https://github.com/Zion-TerraNova/2.9.6/actions/workflows/ci.yml/badge.svg)](https://github.com/Zion-TerraNova/2.9.6/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Co je ZION v2.9.6?

ZION je decentralizovaný Layer 1 blockchain postavený od základu v **Rustu**. Používá konsenzus Proof-of-Work s vlastním těžebním algoritmem **Cosmic Harmony v3** — navrženým jako šetrný k CPU s podporou GPU akcelerace.

**v2.9.6 je hard fork** rozšiřující v2.9.5 o 6vrstvou architekturu „On the Star“, nový emisní plán počítající s **100+ lety** a vyhrazené financování projektů civilizačního měřítka.

### Klíčové vlastnosti

| Parametr | v2.9.5 | v2.9.6 |
|----------|--------|--------|
| **Celková nabídka** | 144 000 000 000 ZION | 144 000 000 000 ZION (beze změny) |
| **Odměna za blok** | 5 400,067 ZION (konstantní) | 5 400,067 → Decade Decay (−20 %/10 let), tail 725 |
| **Čas bloku** | 60 s | 60 s (beze změny) |
| **Horizont těžby** | ~45 let (2026–2071) | **100+ let + tail emise (725 ZION/blok)** |
| **Konsenzus** | Cosmic Harmony v3 | Cosmic Harmony v3 (beze změny) |
| **Transakční model** | UTXO s Ed25519 | UTXO s Ed25519 (beze změny) |
| **Úložiště** | LMDB | LMDB (beze změny) |
| **DAA** | LWMA (60 bloků, ±25 %) | LWMA (beze změny) |
| **Poplatky** | 100 % burn | 100 % burn (beze změny) |
| **Presale** | ❌ žádný — Fair Launch | ❌ beze změny |
| **Architektura** | L1 blockchain | **6 vrstev „On the Star“** |

### Genesis premine (beze změny oproti v2.9.5)

11,65 % celkové nabídky (16,78 mld. ZION) vzniká v genesis bloku:

| Kategorie | Částka | Zámek |
|----------|--------|-------|
| ZION OASIS + Winners Golden Egg/Xp | 4,95 mld. | Okamžitě |
| L5 Free World Projects | 3,30 mld. | Okamžitě |
| DAO Treasury | 4,0 mld. | Okamžitě |
| Infrastruktura | 2,59 mld. | Okamžitě |
| Humanitární | 1,44 mld. | Okamžitě |

Veškerý premine je ověřitelný on-chain a od genesis odemčen. Správu řídí DAO.

---

## Architektura 6 vrstev „On the Star“

v2.9.6 zavádí vrstvenou civilizační infrastrukturu — od blockchainu po orbitu Země.

```
                   ╭──────────────────────────╮
              L6   │  🔭  ZION Issobella        │  2040+
                   ╰────────────┬─────────────╯
                   ╭────────────┴─────────────╮
              L5   │  🌍  ZION Free World     │  2030
                   ╰────────────┬─────────────╯
                   ╭────────────┴─────────────╮
              L4   │  🎮  ZION Oasis          │  2029
                   ╰────────────┬─────────────╯
                   ╭────────────┴─────────────╮
              L3   │  🏛️  ZION DAO            │  2028
                   ╰────────────┬─────────────╯
                   ╭────────────┴─────────────╮
              L2   │  🧠  NCL                 │  2027
                   ╰────────────┬─────────────╯
              ╭─────────────────┴─────────────────╮
         L1   │  ⛏️  ZION TerraNova               │  2026
              ╰───────────────────────────────────╯
```

| Vrstva | Název | Rok | Účel |
|--------|-------|-----|------|
| **L1** | **ZION TerraNova** | 2026 | PoW blockchain — Cosmic Harmony v3, UTXO, burn poplatků, LWMA DAA |
| **L2** | **NCL** (Neural Conscious Layer) | 2028 | AI-nativní protokol, registr modelů on-chain |
| **L3** | **ZION DAO** | 2027 | Decentralizovaná správa, Treasury (4 mld. ZION) |
| **L4** | **ZION Oasis** | 2029 | Ekonomický ekosystém — Golden Egg, Winners, NFT, hra |
| **L5** | **ZION Free World** 🌍 | 2030 | Kvantová volná energie, humanitární mise, komunity |
| **L6** | **ZION Issobella** 🔭 | 2040+ | Orbitální observatoř a výzkumná stanice |

### Co je nového ve v2.9.6 (L5 a L6)

**L5 — ZION Free World** (2030): výzkum kvantového motoru, decentralizovaná čistá energie, humanitární programy, energeticky nezávislé komunity; financováno mimo jiné humanitárním příspěvkem (10 %) + granty DAO + fond L5/L6.

**L6 — ZION Issobella** (2040+): orbitální observatoř, testy kvantového motoru v mikrogravitaci, monitoring klimatu pro L5, komunitou financovaný vesmírný program.

> 🏗️ Plná specifikace: [layer-architecture.md](layer-architecture.md)

---

## Tokenomika — pod diskusí

Emisní plán podléhá hlasování DAO. Pět návrhů: A Decade Decay, B Golden Ratio, C Century Constant, D Dual Phase, E Harmony Curve — viz [tokenomics.md](tokenomics.md).

### Neměnné parametry (jako ve v2.9.5)

| Parametr | Hodnota |
|----------|---------|
| Celková nabídka | 144 000 000 000 ZION |
| Genesis premine | 16 780 000 000 ZION (11,65 %) |
| Čas bloku | 60 s |
| Politika poplatků | 100 % burn |
| Humanitární příspěvek | 5 % z odměny za blok (po přechodu z 10 %) |
| Fond L5/L6 Issobella | 5 % z odměny za blok |

> 📋 Analýza: [tokenomics.md](tokenomics.md)

---

## Konsenzus — Cosmic Harmony v3

Jediný PoW algoritmus: **Cosmic Harmony v3 (CHv3)**. Detaily: [consensus.md](consensus.md).

---

## Těžba — dual mining ZION + VRSC

| Parametr | ZION | VRSC |
|----------|------|------|
| Vlákna | 3T (default) | 1T |
| Algoritmus | Cosmic Harmony v3 | VerusHash v2.2 |
| Skupina poolu | `g=zion` | `g=vrsc` |

> 📋 Migrace: [migration.md](migration.md)

---

## Síť

| Uzel | IP | Role | Porty |
|------|-----|------|-------|
| Zion2 (Primary) | seed.zionterranova.com | Veřejný host + pool + web | P2P 8334, RPC 8444 |
| Interní seedy | — | Kontejnery za primárním hostem | P2P 8334 |

> 📋 P2P: [p2p.md](p2p.md)

---

## Rychlý start

### Plný uzel

```bash
docker compose -f docker/docker-compose.mainnet.yml up -d
# nebo ze zdroje
cargo build --release
./target/release/zion-core --config config/mainnet.toml
```

### Těžba (dual)

```bash
./target/release/zion-miner --pool seed.zionterranova.com:3333 --wallet YOUR_ZION_ADDRESS \
  --worker my-miner --threads 3 --group zion
./target/release/zion-miner --pool seed.zionterranova.com:3333 --wallet YOUR_VRSC_ADDRESS \
  --worker vrsc --threads 1 --algo verushash --group vrsc
```

### Peněženka

```bash
cargo run --bin wallet-generator
```

---

## Struktura projektu *(orientační)*

```
2.9.6/
├── core/
├── pool/
├── miner/
├── cosmic-harmony/
├── config/
├── docker/
└── ...
```

---

## Dokumentace v2.9.6

- [Konsenzus](consensus.md) · [P2P](p2p.md) · [Tokenomika](tokenomics.md)
- [Architektura vrstev](layer-architecture.md) · [Launch plán](launch-plan.md)
- [Migrace](migration.md) · [Audit](audit.md) · [Changelog](changelog.md)

---

## Status v2.9.6

> 🎯 **Historické cílové okno: konec 2026** (viz aktuální launch gate linii).

### Hotovo ✅

CHv3 unifikace, pool validator, dual-mining, dokumentace 6 vrstev, návrhy tokenomiky, rozšířená dokumentace ve v2.9.6.

### V přípravě ⏳

Podle roadmapy: L5/L6 distribuce v coinbase, TestNet fork, audit třetí strany, listing, mainnet fork.

---

## Odkazy a právo

- Web: https://zionterranova.com · Docs: https://zionterranova.com/docs  
- GitHub: https://github.com/Zion-TerraNova/2.9.6  

Experimentální open-source software; není investiční produkt. Viz [legal/](legal/).

Licence: MIT.

🌟 *„On the Star — stavíme na 100 let, ne na hype cyklus.“*
