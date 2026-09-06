# L4 — ZION Oasis Architecture

> Consciousness mining gamification — gamified economic ecosystem connected to
> the ZION blockchain. Target release: 2029.

---

## 1. Přehled vrstvy

```
┌─────────────────────────────────────────────────────────────────┐
│  L5/L6 — Free World / Issobella (budoucnost 2030–2040+)         │
├─────────────────────────────────────────────────────────────────┤
│  L4 / ZION Oasis  ◄── tato dokumentace                          │
│                                                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  zion-oasis                                              │   │
│   │  ───────────────────────────────────────────────────    │   │
│   │  XpSystem       ConsciousnessLevel   Guild               │   │
│   │  Player         Territory            RewardPool           │   │
│   │  Challenges     Tithe                Leaderboard         │   │
│   │  OasisDb (SQLite)  Axum REST API (port 8094)             │   │
│   └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  L3 — WARP, NCL, AI-Native                                       │
├─────────────────────────────────────────────────────────────────┤
│  L2 — Bridge (wZION), DAO                                        │
├─────────────────────────────────────────────────────────────────┤
│  L1 — Core, Miner, Pool (PoW, CHv3)                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Crate `zion-oasis`

### 2.1 Moduly

| Soubor | Účel |
|--------|------|
| `xp.rs` | `XpSystem` — výpočet XP odměny, denní cap, source multipliers |
| `player.rs` | `Player` struct — add_xp, achievements, guild_id |
| `consciousness.rs` | `ConsciousnessLevel` enum (9 úrovní), XP prahy, Sefiry |
| `guild.rs` | `Guild` struct — zakládání, správa členů (max 100), guild XP |
| `territory.rs` | `TerritoryMap` + `Territory` — 8 genesis regionů, claims/contests |
| `rewards.rs` | `RewardPool` + `RewardSlot` — 4.95B ZION distribuce (3 sloty; Slots 4 & 5 repurposed to L5 Free World Projects) |
| `challenges.rs` | Výzvy za XP odměny, genesis sada 8 výzev |
| `tithe.rs` | Humanitární tithe tracking, top tithers leaderboard |
| `leaderboard.rs` | `LeaderboardManager` — XP + guild + territory rankingy |
| `levels.rs` | `LevelReward` — odemykání abilities per level |
| `config.rs` | `OasisConfig` — port, DB path, denní XP cap |
| `api.rs` | `ApiResponse<T>` — unifikovaný JSON response wrapper |
| `db.rs` | `OasisDb` — SQLite persistence (rusqlite, players + guilds) |
| `server.rs` | Axum REST API — 9 endpointů, port 8094 |
| `main.rs` | Binary entry point — env overrides, start server |
| `error.rs` | `OasisError` — Database, Serialization, Internal, NotFound, Validation |
| `lib.rs` | Crate root — re-exportuje veřejné types |

### 2.2 Počty testů

| Modul | Testů |
|-------|-------|
| `consciousness` | 5 |
| `player` | 4 |
| `guild` | 4 |
| `territory` | 3 |
| `rewards` | 5 |
| `tithe` | 3 |
| `leaderboard` | 3 |
| `challenges` | 3 |
| `levels` | 4 |
| `config` | 1 |
| `xp` | 3 |
| `db` | 9 |
| `server` | 7 |
| **Celkem** | **56** |

---

## 3. Vědomostní systém (Consciousness Mining)

### 3.1 Devět úrovní vědomí

| Úroveň | Číslo | XP práh | Multiplier | Sefira (Kabbalah) |
|--------|-------|---------|------------|-------------------|
| Physical | 1 | 0 | 1.0× | Malkuth |
| Emotional | 2 | 1 000 | 1.2× | Yesod |
| Mental | 3 | 5 000 | 1.5× | Hod/Netzach |
| Intuitional | 4 | 15 000 | 2.0× | Tiferet |
| Spiritual | 5 | 50 000 | 2.5× | Gevurah/Chesed |
| Cosmic | 6 | 150 000 | 3.0× | Binah |
| Divine | 7 | 500 000 | 4.0× | Chokmah |
| Unity | 8 | 2 000 000 | 5.0× | Da'at |
| OnTheStar | 9 | 10 000 000 | 10.0× | Keter |

### 3.2 XP zdroje

| XpSource | Popis |
|----------|-------|
| `BlockMined` | Vytěžení bloku (hlavní zdroj) |
| `AiChallenge` | Průchod AI challenge |
| `Quiz` | Vědomostní kvíz |
| `Meditation` | Meditační seance |
| `Tithe` | Humanitární příspěvek |
| `GuildQuest` | Guild quest splnění |
| `Referral` | Přivedení nového hráče |

**Denní cap:** 10 000 XP (konfigurovatelné přes `OasisConfig.daily_xp_cap`)

---

## 4. Guild systém

```
Guild {
    id, name, founder,
    officers: Vec<String>,
    members: Vec<String>   ← max 100
    guild_xp, guild_level,
    created_at
}
```

**Podmínky:**

| Akce | Minimální XP | Minimální úroveň |
|------|-------------|-----------------|
| Vstup do guildy | 1 000 XP | Emotional (2) |
| Vytvoření guildy | 5 000 XP | Mental (3) |

**GuildError:** `GuildFull`, `AlreadyMember`, `NotMember`, `CannotRemoveFounder`, `AlreadyOfficer`

---

## 5. Reward Pool — 4.95B ZION

```
RewardSlot → RewardPool {
    slot: RewardSlot,
    total: 1_650_000_000,   // 1.65B ZION per slot
    distributed: u64,
    locked: bool
}
```

| Slot | Zkratka | Příjemci | Distribuce |
|------|---------|----------|------------|
| `GoldenEgg` | 🥇 | 1. místo celkového XP žebříčku | 1.65B |
| `Winners` | 🏆 | Top 100 hráči | 1.65B |
| `GuildPool` | 🏰 | Top 10 guild | 1.65B |
| **Celkem** | | | **4.95B ZION** |

> **Poznámka:** Slots 4 & 5 (`TerritoryPool`, `HumanitarianPool`) byly repurposed to L5 Free World Projects (3.3B ZION).

---

## 6. Territory systém

8 genesis teritorií, každé s bonusy pro těžbu a XP:

| Region | Typ | Mining bonus | XP bonus |
|--------|-----|-------------|---------|
| Mountains | `Mountains` | +10% | +5% |
| Cedar Forest | `Forest` | +10% | +5% |
| Negev Desert | `Desert` | +10% | +5% |
| Dead Sea | `Ocean` | +10% | +5% |
| Mount Hermon Volcano | `Volcano` | +10% | +5% |
| Jerusalem Crystal | `CrystalCaves` | +10% | +5% |
| Jordan Valley | `Forest` | +10% | +5% |
| Mediterranean | `Ocean` | +10% | +5% |

**Claim podmínky:** 10 000 ZION (`TERRITORY_CLAIM_COST`), defense perioda 24h

---

## 7. REST API (Axum, port 8094)

### Endpointy

| Metoda | Cesta | Popis |
|--------|-------|-------|
| `GET` | `/health` | Healthcheck — vrací `{ status: "ok", uptime_secs }` |
| `GET` | `/api/v1/oasis/player/:address` | Načte nebo vytvoří hráče |
| `POST` | `/api/v1/oasis/player/:address/xp` | Udělí XP hráči |
| `GET` | `/api/v1/oasis/leaderboard` | Top 50 hráčů + počty |
| `POST` | `/api/v1/oasis/guild` | Vytvoří novou guildu |
| `GET` | `/api/v1/oasis/guild/:id` | Detail guildy |
| `POST` | `/api/v1/oasis/guild/:id/join` | Vstup do guildy |
| `GET` | `/api/v1/oasis/map` | Genesis TerritoryMap |
| `GET` | `/api/v1/oasis/rewards/pools` | Stav všech 5 reward poolů |

### Request/Response formát

Vše JSON, obaleno v `ApiResponse<T>`:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

### Příklad — udělení XP

```bash
curl -X POST http://localhost:8094/api/v1/oasis/player/zion1abc123.../xp \
  -H 'Content-Type: application/json' \
  -d '{"source": "BlockMined", "amount": 500}'
```

```json
{
  "success": true,
  "data": {
    "player": { "address": "zion1abc123...", "total_xp": 500, "level": 1, ... },
    "xp_awarded": 500,
    "level_up": false
  }
}
```

---

## 8. SQLite persistence (`OasisDb`)

SQLite databáze pro player + guild state, mimo L1 blockchain (XP zůstává off-chain).

```
players   (address PK, total_xp, level, guild_id, data JSON, updated_at)
guilds    (id PK, name, guild_xp, guild_level, member_count, data JSON, updated_at)
oasis_state (key TEXT PK, value TEXT)
```

**API:**

```rust
OasisDb::open("oasis.db")           // Production
OasisDb::in_memory()                // Tests
db.save_player(&player)
db.get_player("zion1...")           // → Option<Player>
db.get_or_create_player("zion1...")
db.save_guild(&guild)
db.get_guild("guild-id")
db.list_guilds(50)
db.top_players(100)                 // → Vec<LeaderboardEntry>
db.player_rank("zion1...")          // → Option<u64>
db.player_count()
db.guild_count()
```

---

## 9. Konfigurace

```toml
# config/mainnet.toml (L4 sekce — plánováno)
[oasis]
port         = 8094
bind         = "0.0.0.0"
db_path      = "/var/lib/zion/oasis.db"
daily_xp_cap = 10000
```

**ENV overrides:**

| Proměnná | Default | Popis |
|----------|---------|-------|
| `OASIS_PORT` | `8094` | Listening port |
| `OASIS_BIND` | `0.0.0.0` | Bind address |
| `OASIS_DB` | `oasis.db` | SQLite path |

---

## 10. Build & testy

```bash
# Check
cargo check -p zion-oasis

# Testy (56 testů)
cargo test -p zion-oasis

# Spustit server
cargo run --bin zion-oasis
# nebo s env:
OASIS_PORT=9094 OASIS_DB=/tmp/oasis-dev.db cargo run --bin zion-oasis
```

---

## 11. Architektura závislostí

```
zion-oasis
├── axum 0.7          (REST API framework)
├── tower 0.4+util    (Middleware + ServiceExt v testech)
├── tower-http 0.5    (CORS, trace middleware)
├── tokio 1.x         (async runtime)
├── rusqlite (bundled) (SQLite persistence)
├── serde + serde_json (Serialize/Deserialize)
├── thiserror         (Error types)
├── tracing + tracing-subscriber (Logging)
└── anyhow            (main.rs error propagation)
```

---

## 12. Roadmap L4

| Etapa | Cíl | Stav |
|-------|-----|------|
| Core business logic | XP, guilds, territory, rewards | ✅ 40 testů |
| Persistence + REST API | SQLite + Axum 9 endpointů | ✅ 56 testů |
| L1 integrace | XP award při block mine (přes L1 event hook) | ⏳ 2027 |
| L2 integrace | Guild treasury v DAO, reward pool distribuce | ⏳ 2028 |
| UE5 client | Open-world game interface | ⏳ 2029 |
| Mainnet launch | Plná funkčnost + 10k hráčů | 🎯 2029 |
