# 🎮 L4 — ZION Oasis Game World

> Závisí na L1 + L2 + L3. Poslední vrstva ekosystému. Target: 2029+.

L4 je consciousness mining gamifikace — UE5 open-world propojený s ZION blockchainem.

## Crates

| Crate | Package | LOC | Testů | Popis |
|-------|---------|-----|-------|-------|
| `oasis/` | `zion-oasis` | ~3,400 | **56** | XP systém, guildy, territory, challenges, 8.25B reward pool, SQLite DB, Axum REST API |

## Build

```bash
cargo check -p zion-oasis
cargo test -p zion-oasis

# Spustit server (port 8094)
cargo run --bin zion-oasis
OASIS_PORT=9094 OASIS_DB=/tmp/oasis.db cargo run --bin zion-oasis
```

## REST API — 9 endpointů (port 8094)

| Metoda | Cesta | Popis |
|--------|-------|-------|
| `GET` | `/health` | Healthcheck |
| `GET` | `/api/v1/oasis/player/:address` | Načte/vytvoří hráče |
| `POST` | `/api/v1/oasis/player/:address/xp` | Udělí XP |
| `GET` | `/api/v1/oasis/leaderboard` | Top 50 hráčů |
| `POST` | `/api/v1/oasis/guild` | Vytvoří guildu |
| `GET` | `/api/v1/oasis/guild/:id` | Detail guildy |
| `POST` | `/api/v1/oasis/guild/:id/join` | Vstup do guildy |
| `GET` | `/api/v1/oasis/map` | Genesis TerritoryMap |
| `GET` | `/api/v1/oasis/rewards/pools` | Stav 5 reward poolů |

## Klíčové koncepty

- **9 Consciousness Levels** (Kabbalah Sefira: Malkuth → Keter)
- **8 Genesis Territories** (Mount Zion, Cedar Forest, ...)
- **8.25B ZION reward pool** (5 slotů × 1.65B, 10-letá distribuce)
- **XP je offchain** — SQLite (`oasis.db`), L1 zůstává čistý
- **Binary** — `zion-oasis` server (env: `OASIS_PORT`, `OASIS_BIND`, `OASIS_DB`)

> 📋 Plná architektura: [docs/v2.9.6/L4_OASIS_ARCHITECTURE.md](../../docs/v2.9.6/L4_OASIS_ARCHITECTURE.md)
