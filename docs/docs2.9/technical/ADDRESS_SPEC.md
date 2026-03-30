# Zion Address Specification

Status: Draft v0.1 (2025-09-26)

## Overview
Zion používá Base58 (Monero-like styl) pro lidsky čitelné adresy začínající prefixem `Z3`. Adresa reprezentuje:
- Síťový prefix (1–2 bytes)
- Public spend key
- Public view key
- (Volitelné) Payment ID / integrated data (future)
- Checksum (4 bytes) – TODO implementace ověření

## Current Observations
| Typ | Příklad | Délka | Stav |
|-----|---------|-------|------|
| Canonical Wallet | `Z3222ywic7fGUZHv9EfFwEKf1VJRrEqPbLrHgRiBb43LWaS1Cz2gVwgdF2kvUPsGb9jSvUUf31oNCSZgNEtUiGDT4sBLtXmGzc` | ~110 | Používáno v poolu |
| Legacy / Hex-like | `Z3AF4599EC3FB11...` | >120 (hex heavy) | Deprecated |

## Encoding (Planned Alignment)
1. Raw structure: `[PREFIX || PUB_SPEND (32B) || PUB_VIEW (32B) || (OPTIONAL EXTRA) || CHECKSUM (4B)]`
2. Base58 encoding s odstraněním ambiguitních znaků: `0 O I l`
3. Checksum = prvních 4 bajty z keccak-256(payload)

## Validation Rules (v1)
- Začíná `Z3`
- Délka 90–120 znaků (provizorní tolerance)
- Base58 charset bez `0 O I l`
- (TODO) Při zavedení checksum: dekódovat, ověřit závěr

## Future Extensions
| Feature | Popis | Stav |
|---------|-------|------|
| Integrated Addresses | Extra 8B tag | TODO |
| Subaddresses | Derivace view key | TODO |
| Encoding Version Byte | Distinguish testnet/mainnet | Zvažováno |

## Migration Plan
1. Dokumentovat přesné length boundaries po auditu keypair kódu.
2. Implementovat `tools/address_decode.py` pro Base58 decode & checksum.
3. Zavést CI hook, který validuje adresy v konfiguračních souborech.
4. Oznámit deprecaci legacy hex variant v release notes.

## Tooling
Aktuální jednoduchý validátor: `tools/validate_wallet_format.py` (pattern only).

## Open Questions
- Je prefix `Z3` pevný i pro testnet? (Doporučeno mít odlišný.)
- Bude potřeba distingovat integrated vs standard form vizuálně? (Např. delší prefix.)
- Multi-sig / view-only adresy roadmap?

---
Aktualizuj tento dokument po každé změně formátu, prefixu nebo checksum logiky.
