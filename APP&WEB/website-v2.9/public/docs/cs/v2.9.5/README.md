# ZION TerraNova v2.9.5 — „Native Awakening“

> **Vydání: leden 2026 · Stav: Archivováno**

v2.9.5 „Native Awakening“ bylo klíčové základové vydání — úplný přepis blockchainu ZION z Pythonu/C++ do **100% nativního Rust stacku**. Ustanovilo základní protokolová primitiva, která přetrvávají ve všech následujících verzích.

---

## Co bylo v2.9.5

v2.9.5 je první plně Rust-native verze ZION. Předchozí Python/FastAPI stack (éra v2.9) byl zcela nahrazen. Nešlo o inkrementální úpravu — šlo o přepis od základů s výrazně silnějšími zárukami správnosti.

### Klíčové údaje

| Parametr | Hodnota |
|-----------|--------|
| **Kódové jméno** | Native Awakening |
| **Vydání** | leden 2026 |
| **Celková emise** | 144 000 000 000 ZION (tvrdý strop) |
| **Čas bloku** | 60 sekund |
| **Odměna za blok** | 5 400,067 ZION (konstantní — zatím bez decay) |
| **Horizont těžby** | ~45 let (2026–2071) |
| **Konsenzus** | Cosmic Harmony v3 (CPU-friendly PoW) |
| **Model transakcí** | UTXO + Ed25519 |
| **Úložiště** | LMDB |
| **DAA** | LWMA — okno 60 bloků |
| **Poplatky** | 100% burn |
| **Soukromí** | protokol CryptoNote (ring signatures) |
| **Presale** | ❌ žádný — Fair Launch (presale zrušena led 2026) |
| **Síť** | TestNet — 3 seed uzly online |

---

## Co se změnilo oproti v2.9

### 1. Úplný přepis do Rustu

v2.9 byl Python/FastAPI. v2.9.5 nahradil celý stack nativním Rustem:

| Crate | LOC | Účel |
|-------|-----|------|
| `core` | ~6 550 | blockchain, LMDB, P2P, UTXO engine |
| `pool` | ~6 861 | mining pool, Stratum v2, PPLNS |
| `miner` | ~1 834 | CPU miner, algoritmus CHv3 |

Celkem: **~15 245 řádků Rustu** ve v2.9.5. (Do v2.9.6 narostlo na 52 590.)

**Proč přepis?**  
Python stack měl 76+ pahýlů `NotImplementedError`, rozbitou konfiguraci pytestu a fundamentální limity výkonu pro produkční PoW řetězec. Rozhodnutí znělo začít v Rustu znovu a udělat to správně.

### 2. Zrušená presale → Fair Launch

V lednu 2026 byla plánovaná tokenová presale (alokace 500M ZION) zrušena kvůli obavám z compliance v EU (MiCA/AML). Alokace presale se vrátila do pokladny DAO. ZION startoval jako **čistý fair launch** — jediný způsob získání ZION je Proof-of-Work těžba (nebo sekundární trh po spuštění).

### 3. CHv3 v Rustu

Algoritmus Cosmic Harmony v3 byl dříve prototyp v TypeScriptu/Pythonu. v2.9.5 je první vydání s produkční Rust implementací s **~2 MH/s** na CPU hardwaru.

### 4. NCL — Neural Compute Layer (prototyp)

v2.9.5 zavedlo první prototyp NCL — volitelné rozšíření protokolu, kde těžaři mohou získat dodatečné odměny v ZION za příspěvek AI inference výpočtu. Design byl ve v2.9.5 experimentální; formální architektura přišla až ve v2.9.6.

### 5. Stabilita TestNetu

- **108 unit testů prošlo** (oproti rozbitému pytestu ve v2.9)
- ověřený E2E mining loop
- hardening P2P — ochrana proti replay, banování peerů
- 3 seed uzly v provozu

---

## Tokenomika

Úplný ekonomický model včetně matematické odvodnění je v [tokenomics.md](tokenomics.md).

**Stručně:**  
- celková emise: 144B ZION (tvrdý strop, neměnný)  
- genesis premine: 16,78B ZION (11,65 %) — všechny kategorie transparentní  
- těžební emise: 127,22B ZION přes ~45 let při 5 400,067 ZION/blok  
- burn poplatků: 100 % transakčních poplatků zničeno  
- bez developer fee, bez „foundation pre-tax“  

> **Pozn.:** v2.9.6 prodloužilo horizont těžby z 45 na 100+ let zavedením Decade Decay (−20 % / dekáda, tail 725 ZION) — celková emise zůstala stejná.

---

## Konsenzus: Cosmic Harmony v3

Detaily algoritmu v [consensus.md](consensus.md).

CHv3 je sekvenční 4-fázový PoW algoritmus:
1. **Quantum Seed** — trojitý hash Blake3 + Keccak + SHA3
2. **Galactic Matrix** — 2MB paměťová matice se spirálou Fibonacciho
3. **Stellar Harmony** — míchání se zlatým řezem
4. **Cosmic Proof** — finální Merkle ověření

Odolný vůči ASIC díky memory-hard designu. Přívětivý k CPU, konkurenční na GPU.

---

## Soukromí CryptoNote

v2.9.5 zahrnovalo podporu ring signatures CryptoNote (stealth adresy, ring CT). Šlo o raný návrh soukromí, který byl ve v2.9.6 upřednostněn nižší prioritou ve prospěch 6vrstvé architektury a cesty k MainNetu.

---

## Co v2.9.5 ještě nemělo

- žádný Decade Decay (konstantní odměna 5 400,067, horizont 45 let)
- žádnou 6vrstvou architekturu „On the Star“ (přišla ve v2.9.6)
- žádný ERC-20 bridge wZION
- žádný formalizovaný design Warp Corridorů
- NCL jen jako prototyp

To vše přišlo ve v2.9.6 „On the Star“ (únor 2026).

---

## Shrnutí changelogu

Detailní changelog z v2.9 na v2.9.5 je v [changelog.md](changelog.md).
