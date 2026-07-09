# ZION TerraNova v2.9.7 — Pre-MainNet Gate

> **„On the Star“ — od blockchainu ke hvězdám.**

[![Network](https://img.shields.io/badge/Network-TestNet-blue)](https://zionterranova.com)
[![Build](https://img.shields.io/badge/Build-Passing-green)](https://github.com/Zion-TerraNova)
[![Tests](https://img.shields.io/badge/Tests-780%2B-brightgreen)](https://github.com/Zion-TerraNova)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Co je ZION?

ZION je **Layer 1 Proof-of-Work blockchain** postavený od nuly v Rustu. Používá vlastní těžební algoritmus **Cosmic Harmony v3** — šetrný k CPU, akcelerovatelný na GPU, odolný vůči ASIC. Veškeré transakční poplatky jsou trvale pálěny (burn).

v2.9.7 je release **Pre-MainNet Gate** — iterace stability a dokumentace nad v2.9.6. Nebyly změněny pravidla konsenzu, emisní plán ani kryptografické primitivy. Síť běží na TestNetu se třemi seed uzly nepřetržitě.

---

## Protokol ve stručnosti

| Parametr | Hodnota |
|----------|---------|
| **Celková nabídka** | 144 000 000 000 ZION (tvrdý strop) |
| **Počáteční odměna za blok** | 5 400,067 ZION |
| **Útlum emise** | −20 % každých 10 let (Decade Decay) |
| **Tail emise** | 725 ZION/blok (trvalá, po útlumu) |
| **Horizont těžby** | 100+ let |
| **Čas bloku** | 60 sekund |
| **Konsenzus** | Cosmic Harmony v3 (PoW) |
| **Transakční model** | UTXO — podpisy Ed25519 |
| **Úložiště** | LMDB |
| **DAA** | LWMA — okno 60 bloků, ±25 % |
| **Poplatky** | 100 % burn |
| **Presale / ICO** | Žádné — Fair Launch |
| **Síť** | TestNet — Helsinki · USA · Asie |

---

## Genesis premine

11,31 % celkové nabídky (16,28 mld. ZION) vzniklo v genesis bloku.  
Zbývajících **88,69 %** (127,72 mld. ZION) se emituje výhradně těžbou PoW.

| Kategorie | ZION | % nabídky |
|-----------|------|-----------|
| ZION OASIS + Winners | 8 250 000 000 | 5,73 % |
| DAO Treasury | 4 000 000 000 | 2,78 % |
| Infrastruktura | 2 590 000 000 | 1,80 % |
| Humanitární rezerva | 1 440 000 000 | 1,00 % |
| **Celkem** | **16 280 000 000** | **11,31 %** |

Všechny premine adresy jsou veřejně uvedeny v `/PREMINE_ADDRESSES_PUBLIC.txt` a ověřitelné on-chain z genesis bloku.  
Žádné skryté alokace. Správa DAO Treasury je komunitně řízená.

---

## Architektura 6 vrstev „On the Star“

ZION je navržen jako vícevrstvá civilizační infrastruktura — od PoW blockchainu po orbitální stanici u Země.

```
                   ╭─────────────────────────────╮
              L6   │  🔭  ZION Issobella          │  2040+
                   ╰─────────────┬───────────────╯
                   ╭─────────────┴───────────────╮
              L5   │  🌍  ZION Free World         │  2030
                   ╰─────────────┬───────────────╯
                   ╭─────────────┴───────────────╮
              L4   │  🎮  ZION Oasis              │  2029
                   ╰─────────────┬───────────────╯
                   ╭─────────────┴───────────────╮
              L3   │  🏛️  ZION DAO + Warp         │  2027–2028
                   ╰─────────────┬───────────────╯
                   ╭─────────────┴───────────────╮
              L2   │  🧠  NCL Neural Layer        │  2027
                   ╰─────────────┬───────────────╯
              ╭────────────────────────────────────╮
         L1   │  ⛏️  ZION TerraNova               │  2026
              ╰────────────────────────────────────╯
```

| Vrstva | Název | Cíl | Stav |
|--------|-------|-----|------|
| **L1** | ZION TerraNova — PoW blockchain | 2026 | ✅ TestNet v provozu |
| **L2** | NCL — Neural Conscious Layer (AI) | 2027 | 🔄 Fáze návrhu |
| **L2** | wZION Bridge (Base EVM) | 2026 | 🔄 Kontrakty na testnetu |
| **L3** | ZION DAO — Governance + Warp Corridors | 2027–2028 | 📐 Architektura |
| **L4** | ZION Oasis — Hra + ekonomická vrstva | 2029 | 📋 Plánováno |
| **L5** | ZION Free World — Energie + humanitární | 2030 | 📋 Plánováno |
| **L6** | ZION Issobella — Orbitální observatoř | 2040+ | 📋 Plánováno |

---

## Síťové koncové body

| Region | RPC | P2P | Pool (Stratum) |
|--------|-----|-----|----------------|
| Zion2 | `seed.zionterranova.com:8444` | `seed.zionterranova.com:8334` | `seed.zionterranova.com:3333` |
| DNS seed 1 | — | `seed1.zionterranova.com:8334` | — |
| DNS seed 2 | — | `seed2.zionterranova.com:8334` | — |

RPC: `POST /jsonrpc` — standard JSON-RPC 2.0.

---

## Rychlý start

```bash
# Těžba ZION na veřejném poolu
zion-miner --pool stratum+tcp://seed.zionterranova.com:3333 --wallet YOUR_ZION_ADDRESS

# Nová peněženka
zion-wallet gen-mnemonic --out my-wallet.json --print

# Plný uzel
zion-node --network testnet --rpc-port 8444 --p2p-port 8334
```

Stažení CLI binárek: [zionterranova.com/download](https://zionterranova.com/download)

---

## Rozdělení odměny za blok

Protokol automaticky rozdělí každou odměnu za blok:

| Příjemce | Podíl | Účel |
|----------|-------|------|
| **Těžaři** | 89 % | Odměna za PoW |
| Humanitární fond | 5 % | Voda, zdraví, vzdělávání |
| Nadace Issobella | 5 % | L6 — orbitální výzkum |
| Těžební pool | 1 % | Provoz infrastruktury poolu |

Veškeré transakční poplatky se **pálí** (100 %). Žádný dev fee, žádný předem stanovený foundation podíl z poplatků.

---

## MainNet Gate

Před spuštěním MainNetu musí být splněna tři blokující kritéria:

- [ ] **B-CRIT-01** — Dokončený bezpečnostní audit (nulové kritické nálezy)
- [ ] **B-CRIT-02** — 3týdenní TestNet stabilita (bez splitů konsenzu)
- [ ] **B-CRIT-03** — Hlasování komunity (dosažen kvórum)

Další cíle: 50+ distribuovaných seed uzlů, pool testovaný na 100+ MH/s, audit bridge.

Historické cílové okno v tomto snapshotu: **31. prosince 2026**

---

## Odkazy

- Web: [zionterranova.com](https://zionterranova.com)
- Explorer: [zionterranova.com/explorer](https://zionterranova.com/explorer)
- Pool: [zionterranova.com/pool](https://zionterranova.com/pool)
- GitHub: [github.com/Zion-TerraNova](https://github.com/Zion-TerraNova)
- Download: [zionterranova.com/download](https://zionterranova.com/download)
