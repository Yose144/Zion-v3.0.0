# ZION v3 Mainnet Roadmap

> **Aktualizováno:** 11. 6. 2026
> **Status:** Genesis #0 spuštěn, další milníky v průběhu roku 2026

---

## Doplňek — 11. 6. 2026 (MainNet Genesis + červnové hot fixy)

### MainNet Genesis

- **TestNet genesis:** 4. prosince 2025 — první blok, záměr, architektura, zárodek sítě
- **MainNet Genesis TerraNova:** 11. června 2026 — kontrolovaný Core + Edge mainnet launch
- **Veřejný launch pro všechny:** 31. prosince 2026 (Silvestr)

### Červnové hot fixy 2026 (hardening mineru)

- **Odstranění DCR backdooru:** Stealth Decred worker těžící pro cizí BTC peněženku odstraněn z miner kódu
- **Oddělení GPU/CPU cest:** GPU kandidát již není blokován CPU re-verifikací; algorithm-aware pool validace opravuje 0 akceptovaných shares
- **RDNA1 detekce fix:** RX 5700 XT správně detekován jako RDNA1 (ne GCN), obnova plného work_size
- **Sezónní přepínání Fire ↔ Lite:** Miner se automaticky restartuje s příhodným algoritmem pro léto (Lite = 256 KiB, 2 passy, 64 čtení, žádné teplo) vs zimu (Fire = 128 KiB, 16 passů, 512 čtení, teplotní výstup)
- **Edge auto-backup:** Systemd timer + off-site snapshoty pro Edge server

### L1 konsenzus dodán na `main` (nový chain)

- **TX hash v2** + **F2 BLAKE3 body Merkle (BODY_ROOT_V2)** aktivní od výšky **0**
- **F1** UTXO input existence + value conservation na **peer-imported a lokálně odeslaných** blocích
- Volitelný **testnet fork rehearsal** přes Cargo feature

---

## Konstituční reference (Mainnet parametry)

### Emise a supply

| Parametr | Hodnota |
|----------|---------|
| Celková emise (max, neměnná) | 144 000 000 000 ZION |
| Mining supply | 127 720 000 000 ZION (88,69 %) |
| Genesis premine | 16 280 000 000 ZION (11,31 %) |
| Atomická jednotka | 1 ZION = 1 000 000 000 000 flowers (u64) |
| Počáteční block reward | 5 400,067 ZION |
| Model emise | Decade Decay: ×(4/5) každých 5 256 000 bloků |
| Tail emission (perpetuum) | ~724,785 ZION/blok |
| Bloky za rok | 525 600 (60 s target) |
| Fee policy | 100 % burn (deflační) |

### Konsenzus a obtížnost

| Parametr | Hodnota |
|----------|---------|
| Konsenzus | Cosmic Harmony v3 — Ekam Deeksha PoW |
| Chain ID | `zion-mainnet-1` |
| Block time target | 60 sekund |
| DAA | LWMA (Linearly Weighted Moving Average) |
| DAA okno | 60 bloků |
| DAA max změna | ±25 % |
| Max reorg depth | 10 bloků |
| Soft finality | 60 bloků |
| Fork choice | Největší accumulated work |
| Coinbase maturity | 100 bloků |

---

## Milníky — Přehled

| Fáze | Cíl | Status |
|------|-----|--------|
| Genesis Launch | Červen 2026 | ✅ Dokončeno |
| Pool hardening | Q3 2026 | 🔄 Probíhá |
| Externí audit | Q3 2026 | 📋 Naplánováno |
| Bridge 3/5 validátorů | Q4 2026 | 📋 Naplánováno |
| CoinGecko / CMC listing | Q4 2026 | 📋 Naplánováno |
| GPU optimalizace | Q4 2026 | 🔄 Probíhá |
| L2 DeFi launch | 2027 | 📋 Naplánováno |
| L3 AI Native | 2027 | 📋 Naplánováno |
| L4 ZION Oasis | 2029+ | 📋 Naplánováno |
| L5 Free World | 2030+ | 📋 Naplánováno |
| L6 Issobella | 2040+ | 📋 Naplánováno |

---

## Document lineage

Tento soubor je aktivním zdrojem pravdy pro čistou `V3/` mainnet linii.
`V3/` je záměrně oddělen od legacy root workspace. Legacy root zůstává migračním zdrojem a auditním důkazem, ale nová mainnet-track runtime práce by měla směřovat do `V3/`.

---

*ZION v3 Mainnet Roadmap • Veřejný přehled • aktualizováno 11. 6. 2026*
