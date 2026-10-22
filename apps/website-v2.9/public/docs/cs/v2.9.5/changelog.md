# Changelog — v2.9.5 „Native Awakening“

> Vydání: leden 2026  
> Předchozí vydání: v2.9 „Quantum Leap“ (prosinec 2025)

---

## Shrnutí

v2.9.5 je **kompletní přepis od základů** blockchainu ZION v nativním Rustu. Stack Python/FastAPI z éry v2.9 byl celý nahrazen. Nejde o feature release — jde o korektnost a zakládání základů.

---

## Velké změny

### Úplný přepis do Rustu

Předchozí kódová základna v2.9 byla Python (119 zdrojových souborů, 56k+ LOC) s FastAPI serverem, Python mining smyčkou a TypeScript pool komponentami. Čestný interní závěr z prosince 2025 ukázal:

- 76+ pahýlů `NotImplementedError` napříč kódem
- rozbitou konfiguraci pytestu (vyžaduje pytest-cov, nebyl nainstalován)
- blockchain na genesis bloku — v produkci nebyly těženy skutečné bloky
- pool neběžel na produkčním serveru

Rozhodnutí: přepsat od nuly v Rustu.

**Výsledek po přepisu:**

| Crate | Řádků Rustu | Stav |
|-------|-------------|------|
| `core` (blockchain, P2P, UTXO, LMDB) | ~6 550 | ✅ produkce |
| `pool` (Stratum v2, PPLNS) | ~6 861 | ✅ produkce |
| `miner` (CHv3, CPU/GPU) | ~1 834 | ✅ produkce |
| **Celkem** | **~15 245** | ✅ TestNet live |

108 unit testů prošlo. 0 pahýlů. 0 NotImplementedErrors.

### Zrušená presale → Fair Launch

Plánovaná alokace presale 500M ZION byla 15. ledna 2026 zrušena kvůli obavám z compliance EU MiCA (Markets in Crypto-Assets) a AML. Alokace se vrátila do pokladny DAO.

**Dopad:**
- žádní držitelé tokenů nedostali zvýhodněnou cenu
- veškeré ZION lze koupit na sekundárním trhu nebo vytěžit
- skutečně férové rozložení od genesis

### Cosmic Harmony v3 — implementace v Rustu

První produkční Rust implementace PoW algoritmu CHv3. Předchozí prototypy TypeScript/Python dosahovaly ~500 KH/s. Rust implementace dosahuje **~2 MH/s** na běžném CPU s instrukcemi AVX2.

### NCL — Neural Compute Layer (prototyp)

První představení konceptu NCL — volitelné vrstvy protokolu, kde těžaři přispívají AI inference výpočtem výměnou za bonusové odměny v ZION. Ve v2.9.5 šlo jen o prototypový design. Formální architektura vyšla až ve v2.9.6.

### Vrstva soukromí CryptoNote

v2.9.5 obsahovalo ranou implementaci ring signatures CryptoNote (stealth adresy, ring CT). Byla experimentální. Vrstva soukromí byla ve v2.9.6 upřednostněna nižší prioritou, projekt se soustředil na 6vrstvou architekturu a připravenost k MainNetu.

### LMDB — perzistentní úložiště

Blockchain nyní používá LMDB (Lightning Memory-Mapped Database) pro perzistentní uložení bloků a UTXO. Předchozí Python verze používaly SQLite nebo in-memory úložiště.

### Podpisy Ed25519

Přechod z ECDSA/secp256k1 na Ed25519 pro všechny transakční podpisy. Rychlejší, jednodušší, lepší bezpečnostní vlastnosti.

### Dual mining

Podpora současné těžby CHv3 (ZION) + VerusHash (VRSC) v jednom průchodu hardwaru.

---

## Stav TestNetu při vydání v2.9.5

| Metrika | Hodnota |
|---------|--------|
| Seed uzly | 3 (Helsinki, USA, Asie) |
| Unit testy | 108 úspěšných |
| E2E mining | ✅ ověřeno |
| P2P sync | ✅ IBD funguje |
| Pool PPLNS | ✅ výplaty ověřeny |
| Čas bloku | cíl 60 s (LWMA stabilizováno) |
| Hashrate | ~10–15 MH/s agregát TestNetu |

---

## Co v2.9.5 nezměnilo

Tyto parametry jsou shodné s původním designem a zůstávají neměnné ve všech pozdějších verzích:

- celková emise: 144 000 000 000 ZION
- čas bloku: 60 sekund
- LWMA DAA: okno 60 bloků
- 100% burn poplatků
- transakční model UTXO
- genesis premine: 16,78B ZION (11,65 %)
- žádná presale — Fair Launch
