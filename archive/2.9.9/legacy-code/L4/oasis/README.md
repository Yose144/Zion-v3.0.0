# 🎮 L4 — ZION OASIS (Consciousness Mining Game)

> **Crate:** `zion-oasis`  
> **Vrstva:** L4 — Game / Consciousness  
> **Stack:** Rust · Tokio · SQLite  
> **Status:** 🟡 Skeleton (~2 300 LOC)

---

## Co to je?

*"Mining is not just computation — it's a journey of consciousness."*

OASIS je herní vrstva nad ZION mining — gamifikuje těžbu přes XP systém, 9 consciousness levelů, guildy, teritoria, AI challenges a humanitární desátek. Mineři sbírají XP za mining, plní výzvy a postupují na vyšší úrovně vědomí.

```
┌──────────────────────────────────────────┐
│            🎮 ZION OASIS                 │
│                                          │
│  ┌────────────┐    ┌─────────────────┐  │
│  │ 9 Conscious│    │    Players      │  │
│  │ ness Levels│    │    Profiles     │  │
│  └─────┬──────┘    └───────┬─────────┘  │
│        │                    │            │
│  ┌─────┴──────┐    ┌───────┴─────────┐  │
│  │  XP System │    │   Guilds &      │  │
│  │  + Awards  │    │   Territories   │  │
│  └─────┬──────┘    └───────┬─────────┘  │
│        │                    │            │
│  ┌─────┴──────┐    ┌───────┴─────────┐  │
│  │ AI Challen-│    │  Leaderboard    │  │
│  │ ges + Quiz │    │  + Rewards      │  │
│  └─────┬──────┘    └───────┬─────────┘  │
│        │                    │            │
│  ┌─────┴────────────────────┴─────────┐ │
│  │   Humanitarian Tithe (7 kategorií) │ │
│  │   💧🍞🏠🌍🏥📚🚨                  │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

---

## 9 Consciousness Levels

| Lvl | Název | XP potřeba | Odměna |
|-----|-------|-----------|--------|
| 1 | **Physical** | 0 | Základní mining |
| 2 | **Emotional** | 1 000 | +5% XP boost |
| 3 | **Mental** | 5 000 | Přístup ke guildám |
| 4 | **Intuitive** | 25 000 | +10% mining reward |
| 5 | **Creative** | 100 000 | Přístup k teritoriím |
| 6 | **Visionary** | 500 000 | AI challenges unlock |
| 7 | **Universal** | 2 000 000 | Governance voting |
| 8 | **Transcendent** | 10 000 000 | Premine slot unlock |
| 9 | **On The Star** | 50 000 000 | Maximum consciousness |

---

## Premine alokace

```
8,250,000,000 ZION (8.25B) — rozloženo na 10+ let

Slot 1: 1,650,000,000 ZION — unlock při Level 3 community dosažení
Slot 2: 1,650,000,000 ZION — unlock při Level 5 community dosažení
Slot 3: 1,650,000,000 ZION — unlock při Level 7 community dosažení
Slot 4: 1,650,000,000 ZION — unlock při Level 8 community dosažení
Slot 5: 1,650,000,000 ZION — unlock při Level 9 community dosažení

Řízeno: OASIS game engine + DAO governance
```

---

## Moduly

| Modul | Popis |
|-------|-------|
| **consciousness** | 9 consciousness levels + progression |
| **xp** | XP systém — mining, challenges, community |
| **levels** | Level definitions + unlock podmínky |
| **player** | Player profily + statistiky |
| **guild** | Guildy — vytváření, členství, guild wars |
| **territory** | Teritoria — claim, defend, expand |
| **challenges** | AI challenges + quizy (powered by L3 AI Native) |
| **rewards** | Mining rewards + level bonusy |
| **leaderboard** | Globální + guild leaderboardy |
| **tithe** | Humanitární desátek (7 kategorií) |
| **api** | REST API pro klienty |
| **config** | OasisConfig |

---

## Humanitární desátek

Každý miner automaticky přispívá 10% mining rewards do humanitárního fondu:

| # | Kategorie | Alokace |
|---|-----------|---------|
| 💧 | Čistá voda | 20% |
| 🍞 | Jídlo | 20% |
| 🏠 | Bydlení | 15% |
| 🌍 | Životní prostředí | 15% |
| 🏥 | Zdravotnictví | 15% |
| 📚 | Vzdělávání | 10% |
| 🚨 | Krizová pomoc | 5% |

---

## Rychlý start

```bash
# Build
cargo build -p zion-oasis

# Testy
cargo test -p zion-oasis
```

---

## ⚠️ Layer Boundary

OASIS je **L4 crate** — nejvyšší implementovaná vrstva:
- Čte mining data z **L1** přes API
- Používá **L3 AI Native** pro consciousness evaluation
- Používá **L3 NCL** pro compute challenges
- **NIKDY nemodifikuje L1 přímo**
- Žádná Cargo dependency na L1 (komunikace výhradně přes API)

---

## Struktura

```
oasis/
├── Cargo.toml
└── src/
    ├── lib.rs             # Module exports + architektura doc
    ├── error.rs           # OasisError types
    ├── consciousness.rs   # 9 consciousness levels
    ├── xp.rs              # XP system
    ├── levels.rs          # Level definitions
    ├── player.rs          # Player profiles
    ├── guild.rs           # Guilds
    ├── territory.rs       # Territories
    ├── challenges.rs      # AI challenges + quizy
    ├── rewards.rs         # Mining rewards + bonusy
    ├── leaderboard.rs     # Global + guild leaderboards
    ├── tithe.rs           # Humanitarian tithe (7 categories)
    ├── api.rs             # REST API
    └── config.rs          # OasisConfig
```

---

## Souvislosti

- **AI Native (L3)** → `../ai-native/` (consciousness evaluation engine)
- **NCL (L3)** → `../ncl/` (compute pro AI challenges)
- **DAO (L2)** → `../dao/` (governance pro premine unlock)
- **Desktop Agent** → `../desktop-agent/` (UI pro OASIS gamification)
- **UE5 Prototyp** → `../2.9-History/ZionOasis_UE5/` (Unreal Engine 5 vizuál)
