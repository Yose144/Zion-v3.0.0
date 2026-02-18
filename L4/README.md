# 🎮 L4 — ZION Oasis Game World

> Závisí na L1 + L2 + L3. Poslední vrstva ekosystému. Target: 2029+.

L4 je consciousness mining gamifikace — UE5 open-world propojený s ZION blockchainem.

## Crates

| Crate | Package | LOC | Testů | Popis |
|-------|---------|-----|-------|-------|
| `oasis/` | `zion-oasis` | 2,335 | 39 | XP systém, guildy, territory, challenges, 8.25B reward pool |

## Build

```bash
cargo check -p zion-oasis
cargo test -p zion-oasis
```

## Klíčové koncepty

- **9 Consciousness Levels** (Kabbalah Sefira: Malkuth → Keter)
- **8 Genesis Territories** (Mount Zion, Cedar Forest, ...)
- **8.25B ZION reward pool** (5 slotů × 1.65B, 10-letá distribuce)
- **XP je offchain** — pool-level DB, L1 zůstává čistý
