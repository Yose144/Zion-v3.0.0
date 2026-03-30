# ZION Miner 1.4.0 – Release Notes

Release Date: 2025-09-29

## Overview
Tato verze přináší plnou podporu CryptoNote stylu připojení (login/submit), přesnější výpočet difficulty (256-bit division), extranonce integraci, debug nástroje a vylepšené ovládání za běhu.

## Hlavní změny
### 1. CryptoNote Protocol Support
- `--protocol=cryptonote` (nebo `--protocol cryptonote`) aktivuje login flow (metoda `login`) a submit formát (`submit` s objektem `{id,job_id,nonce,result}`).
- Pending share map pro korelaci odpovědí (accepted / invalid).

### 2. 256-bit Target & Difficulty
- Přidán unified header `include/zion-big256.h`.
- Přesná integer-like difficulty: `difficulty = floor((2^256 - 1)/target)` (truncated na 64b).
- Zobrazení `diff` a případně `diff24` (pro 24-bit baseline) ve statistikách.

### 3. Extranonce Integration
- Parsování `extranonce` a vložení do blob před nonce region (heuristický offset – lze vyladit dle spec).

### 4. Runtime Controls & Debug
- Nové klávesy: `g` (GPU on/off), `o` (cyklus algoritmů cosmic→blake3→keccak), `?` (help alias), `v` (verbose RAW log toggle).
- Debug algoritmy (blake3 / keccak) neodesílají shares (bezpečný test výkonu).
- `--force-low-target <hex>` pro lokální vynucení snazšího (vyššího) targetu → rychlé generování kandidátních shares.
- Indikátor `FORCED-TARGET` ve stats při aktivním debug targetu.

### 5. Performance & Cleanups
- Odstraněn periodický ad-hoc přepočet difficulty, vše při parsování jobu.
- Sloučení 256-bit helper kódu do jedné hlavičky (eliminace duplicit).

### 6. Documentation
- Přidán `MINER_RUN_GUIDE_CZ.md` – řešení problému `noexec` (exit code 126) přes běh z `/tmp`.

## Klávesové zkratky (v1.4.0)
| Key | Action |
|-----|--------|
| q | Quit |
| s | Toggle stats |
| d | Toggle detailed view |
| b | Brief mode on/off |
| g | GPU on/off |
| o | Cycle algorithm (cosmic/blake3/keccak) – debug módy neposílají shares |
| r | Reset counters |
| c | Clear screen |
| v | Stratum RAW verbose toggle |
| h / ? | Help |

## Parametry CLI
```
--pool <host:port>
--wallet <address>
--cpu-only | --gpu-only
--cpu-threads <n>
--cpu-batch <n>
--protocol <stratum|cryptonote>
--force-low-target <hex>
```

## Známá omezení / TODO
- GPU cesta zatím používá jen 64-bit fallback target (ignoruje 256-bit masku); plná 256-bit validace na GPU TODO.
- Extranonce pozice je heuristická; doporučeno potvrdit dle finálního specifického formátu block blobu.
- Difficulty truncation na 64 bitů – pro extrémně malé targety lze rozšířit na 128b reprezentaci.

## Upgrade pokyny
1. Build: `cmake -S zion-miner-1.4.0 -B zion-miner-1.4.0/build && cmake --build zion-miner-1.4.0/build -j`.
2. Spusť z exec FS: `cp zion-miner-1.4.0/build/zion-miner /tmp/ && /tmp/zion-miner --protocol=cryptonote --pool HOST:PORT --wallet YOUR_ADDRESS`.
3. Volitelně test shares: `--force-low-target ffffffffffffffff`.

## Changelog (kratká forma)
- Added: CryptoNote login/submit, extranonce, precise difficulty, runtime algo toggles.
- Added: Forced low target debug, unified Big256, Czech run guide.
- Fixed: Endianness compare for CryptoNote target vs hash.
- Improved: Stats diff accuracy, keyboard help, protocol arg parsing.
- Removed: Legacy diff smoothing code & duplicate Big256 logic.

## Checksums (doplnit po CI build)
```
# Example (placeholder)
sha256(zion-miner-linux-x86_64) = TBD
```

---
Happy mining ✨
