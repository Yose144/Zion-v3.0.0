# ZION OASIS — V3 L4 Game Server

> **"Mining is not just computation — it's a journey of consciousness."**
>
> ZION OASIS is the L4 (Application / Game) layer of the ZION TerraNova blockchain ecosystem.
> It connects the L1 proof-of-work consensus, L2 DAO/Bridge services, and L3 AI-Native
> consciousness evaluation into a playable spiritual MMORPG experience.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Consciousness System](#consciousness-system)
4. [Golden Egg Treasure Hunt](#golden-egg-treasure-hunt)
5. [Avatar & Quest System](#avatar--quest-system)
6. [Guilds & Territories](#guilds--territories)
7. [Raid Teams](#raid-teams)
8. [Consciousness Combat](#consciousness-combat)
9. [REST API](#rest-api)
10. [UE5 Client Integration](#ue5-client-integration)
11. [Docker Deployment](#docker-deployment)
12. [Development](#development)
13. [Data Files](#data-files)

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                        UE5 Client                           │
│   ZionCharacter │ ZionPlayerController │ ZionBlockchainBridge│
│   ConsciousnessComponent │ GoldenEggManager │ TerritoryManager│
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP REST (port 8094)
┌────────────────────┴────────────────────────────────────────┐
│                    ZION OASIS (Rust)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Player / XP │  │ Golden Egg   │  │ Quest System    │   │
│  │ Guilds      │  │ Raid Teams   │  │ Combat Engine   │   │
│  │ Territory   │  │ Leaderboard  │  │ Prize Tiers     │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘   │
│         └─────────────────┴─────────────────────┘            │
│                           │                                  │
│                    ┌──────┴──────┐                           │
│                    │  SQLite DB  │                           │
│                    └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───┴────┐    ┌────┴─────┐   ┌─────┴──────┐
│ L1 Node│    │ L2 DAO   │   │ L3 AI      │
│ 8443   │    │ Bridge   │   │ Native     │
└────────┘    └──────────┘   └────────────┘
```

---

## Project Structure

```text
V3/L4/oasis/
├── Cargo.toml              # Workspace crate definition
├── data/
│   ├── avatars.json        # 199 sacred avatars + quest lines
│   ├── golden_egg.json     # 108 clues, 3 master keys
│   ├── prize_tiers.json    # 10 prize tiers (1B → 100K ZION)
│   └── world.json          # 7 genesis territories
├── scripts/
│   └── parse_avatars.py    # Markdown → JSON avatar pipeline
├── src/
│   ├── main.rs             # Server entrypoint
│   ├── lib.rs              # Module declarations
│   ├── server.rs           # Axum REST API router
│   ├── api.rs              # ApiResponse wrapper
│   ├── db.rs               # SQLite persistence layer
│   ├── config.rs           # OasisConfig defaults
│   ├── error.rs            # OasisError types
│   ├── player.rs           # Player profile struct
│   ├── xp.rs               # XP award system
│   ├── consciousness.rs    # 9 consciousness levels (CL1–CL9)
│   ├── levels.rs           # Feature unlock per level
│   ├── guild.rs            # Guild creation / membership
│   ├── territory.rs        # Territory claim / contest
│   ├── leaderboard.rs      # XP leaderboard engine
│   ├── challenges.rs       # AI challenge system
│   ├── rewards.rs          # Reward pool distribution
│   ├── tithe.rs            # Humanitarian tithe tracking
│   ├── golden_egg.rs       # Golden Egg progress tracker
│   ├── prize_tiers.rs      # Prize configuration
│   ├── raid_team.rs        # EKAM Dimension raid teams
│   ├── quests.rs           # Avatar quest system
│   ├── combat.rs           # Consciousness-based combat
│   └── ...
└── ue5/
    └── Source/ZionOasis/   # UE5 C++ client skeleton
        ├── Game/
        │   ├── ZionGameInstance.{h,cpp}
        │   └── ZionOasisGameMode.{h,cpp}
        ├── Player/
        │   ├── ZionCharacter.{h,cpp}
        │   └── ZionPlayerController.{h,cpp}
        ├── Blockchain/
        │   └── ZionBlockchainBridge.{h,cpp}
        ├── Consciousness/
        │   ├── ConsciousnessTypes.h
        │   └── ConsciousnessComponent.{h,cpp}
        ├── GoldenEgg/
        │   └── GoldenEggManager.{h,cpp}
        ├── Guild/
        │   ├── GuildTypes.h
        │   └── GuildComponent.{h,cpp}
        ├── Territory/
        │   └── TerritoryManager.{h,cpp}
        ├── Avatar/
        │   └── AvatarTypes.h
        └── UI/
            └── ZionHUD.{h,cpp}
```

---

## Consciousness System

9 levels inspired by the Kabbalah Tree of Life (Sefirot):

| CL | Name | Sefira | XP Threshold | Multiplier |
|---|---|---|---|---|
| 1 | Physical | Malkuth | 0 | 1.0× |
| 2 | Emotional | Yesod | 1,000 | 1.2× |
| 3 | Mental | Hod/Netzach | 5,000 | 1.5× |
| 4 | Intuitional | Tiferet | 15,000 | 2.0× |
| 5 | Spiritual | Gevurah/Chesed | 50,000 | 3.0× |
| 6 | Cosmic | Binah | 150,000 | 5.0× |
| 7 | Divine | Chokmah | 500,000 | 8.0× |
| 8 | Unity | Da'at | 2,000,000 | 12.0× |
| 9 | On The Star | Keter | 10,000,000 | 15.0× |

XP sources: BlockMined, AiChallenge, Quiz, Meditation, Tithe, GuildQuest, AvatarQuest, Referral.

Daily XP cap: **10,000** per player.

---

## Golden Egg Treasure Hunt

The **Hiranyagarbha** (Golden Womb) treasure hunt is the endgame of ZION OASIS.

### Requirements to Claim
- **Consciousness Level 9** (On The Star)
- **All 108 clues solved** (sacred mala number)
- **All 3 master keys unlocked**
- **255 avatar quests completed** (51 avatars × 5 quests)

### Prize Pool (on-chain)
| Place | Title | Prize | DAO Voting Boost |
|---|---|---|---|
| 1st | CEO | 1,000,000,000 ZION | +15% |
| 2nd | CCO | 500,000,000 ZION | +10% |
| 3rd | CAO | 250,000,000 ZION | +5% |

### 10 Prize Tiers
1. Hiranyagarbha Sovereign — 1B ZION
2. Cosmic Architect — 500M ZION
3. Divine Strategist — 250M ZION
4. Unity Keeper — 100M ZION
5. Star Navigator — 50M ZION
6. Celestial Sage — 25M ZION
7. Solar Guardian — 10M ZION
8. Lunar Mystic — 5M ZION
9. Astral Seeker — 2.5M ZION
10. Physical Initiate — 1M ZION

Plus 10 runner-up prizes (500K → 100K ZION).

### Karma System
- Earn karma by solving clues
- Spend karma on hints (100 / 500 / 1000 karma per hint level)

---

## Avatar & Quest System

**199 Sacred Avatars** parsed from `docs/docs2.9/ZION_OASIS/AVATAR_ROSTER.md` into `data/avatars.json`.

### Categories
- Hindu Deities (00–16)
- Ascended Masters (07–16)
- Buddhist Masters (17–20)
- Christian Saints (21–24)
- Historical Legends (25–30)
- Matrix Heroes (31–34)
- ZION Originals (35–40)
- First Nations Circle (41–50)
- Pacific / Tibet / India Extended / Japan / China / Indonesia / Australia / Aotearoa / Africa / Atlantis / Lemuria / Cosmic / Norse-Celtic / Ancient Egypt circles

Each avatar offers **5 quests** with titles, descriptions, and scaling XP rewards (2000 × quest_index).

### Quest Completion Flow
1. UE5 client triggers quest completion
2. `POST /api/v1/oasis/player/:address/quests/:quest_id/complete`
3. Backend marks quest completed in SQLite
4. Backend awards XP via `AvatarQuest` source
5. Progress synced back to client

---

## Guilds & Territories

### Guilds
- Max **100 members**
- Min XP to join: **1,000** (Emotional)
- Min XP to create: **5,000** (Mental)
- 8 spiritual orders (Blue, Yellow, Pink, White, Green, Ruby-Gold, Violet, All Rays)

### Territories (8 Genesis Regions)
| Territory | Region | Mining Bonus | XP Bonus |
|---|---|---|---|
| Mount Zion | Mountains | 15% | 5% |
| Cedar Forest | Forest | 10% | 5% |
| Negev Desert | Desert | 8% | 5% |
| Dead Sea | Ocean | 12% | 5% |
| Mount Hermon Volcano | Volcano | 20% | 5% |
| Jerusalem Crystal Caves | CrystalCaves | 13% | 5% |
| Jordan Valley | Forest | 10% | 5% |
| Mediterranean Shore | Ocean | 12% | 5% |

Claim cost: **10,000 ZION**
Defense window: **24 hours**

---

## Raid Teams

**EKAM Dimension Raids** — up to **50 members**, 5 roles:
- Tank, Healer, DPS, Support, Scout

- **108 pillars** (mini-bosses) to defeat
- Min members to start: **10**
- Leaderboards by time and total damage

---

## Consciousness Combat

Non-violent spiritual combat system where **consciousness level difference** determines damage multipliers.

| Action | Min CL | Description |
|---|---|---|
| Strike | 1 | Basic attack |
| Meditate | 1 | Heal + energy restore |
| Soul Shield | 4 | Defensive buff |
| Dharma Blast | 5 | Area attack (2× damage) |
| Cosmic Ray | 7 | High damage (3×) |
| Unity Pulse | 8 | Team heal |
| Keter Beam | 9 | Ultimate (5× damage) |

Damage formula: `base × (1 + level_delta × 0.2)`

---

## REST API

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Server health check |

### Players
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/oasis/player/:address` | Get or create player |
| POST | `/api/v1/oasis/player/:address/xp` | Award XP |

### Leaderboards
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/oasis/leaderboard` | Top players |
| GET | `/api/v1/oasis/leaderboard/top100` | Top 100 players |

### Guilds
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/oasis/guild` | Create guild |
| GET | `/api/v1/oasis/guild/:id` | Get guild |
| POST | `/api/v1/oasis/guild/:id/join` | Join guild |

### Territories
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/oasis/map` | Full territory map |

### Golden Egg
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/oasis/golden-egg/progress/:address` | Player progress |
| GET | `/api/v1/oasis/golden-egg/leaderboard` | Leaderboard |
| GET | `/api/v1/oasis/prize-tiers` | Prize configuration |

### Raid Teams
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/oasis/raid-team` | Create raid |
| GET | `/api/v1/oasis/raid-team/:id` | Get raid |
| POST | `/api/v1/oasis/raid-team/:id/join` | Join raid |
| GET | `/api/v1/oasis/raid-leaderboard` | Raid leaderboard |

### Quests
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/oasis/quests` | List all quest definitions |
| GET | `/api/v1/oasis/player/:address/quests` | Player quest progress |
| POST | `/api/v1/oasis/player/:address/quests/:quest_id/complete` | Complete quest |

### Combat
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/oasis/combat/resolve` | Resolve combat action |

### Rewards
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/oasis/rewards/pools` | Reward pool status |

---

## UE5 Client Integration

The UE5 skeleton in `V3/L4/oasis/ue5/` provides:

- **ZionGameInstance** — owns `UZionBlockchainBridge` singleton
- **ZionOasisGameMode** — server authority, `BroadcastBlockMined()`
- **ZionPlayerController** — wallet login, `ServerInteract()`, `SyncPlayerFromBackend()`
- **ZionCharacter** — `ConsciousnessComponent`, `GuildComponent`, enhanced input
- **ZionBlockchainBridge** — HTTP client to Rust REST API
  - Supports all new endpoints (Golden Egg, Raid, Quests, Combat)
- **ConsciousnessComponent** — CL1–CL9 with V3 multipliers (1.0× → 15.0×)
- **GoldenEggManager** — 108 clues, 3 master keys, karma system
- **TerritoryManager** — 8 genesis territories synced from backend
- **ZionHUD** — UMG widget stack (HUD overlay, consciousness bar, etc.)

### Build Requirements
- Unreal Engine 5.4+
- Modules: `GameplayAbilities`, `GameplayTags`, `EnhancedInput`, `HTTP`, `Json`, `UMG`

---

## Docker Deployment

### Quick Start
```bash
# Copy environment config
cp V3/docker/.env.example V3/docker/.env

# Start mainnet stack (node + pool + miner + oasis)
docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d

# View OASIS logs
docker compose -f V3/docker/docker-compose.yml logs -f oasis
```

### OASIS Service Details
| | |
|---|---|
| Image | `zion-v3-oasis:latest` |
| Port | `8094` |
| Healthcheck | `GET /health` |
| Volume | `zion-oasis-data:/data/oasis` |
| Env | `OASIS_BIND`, `OASIS_PORT`, `OASIS_DB` |

### Environment Variables
```env
OASIS_BIND=0.0.0.0
OASIS_PORT=8094
OASIS_DB=/data/oasis/oasis.db
OASIS_AVATARS_PATH=/data/oasis/data/avatars.json
RUST_LOG=info
```

### Manual Build
```bash
docker build -f V3/docker/Dockerfile.oasis -t zion-v3-oasis V3
docker run -d -p 8094:8094 -v zion-oasis-data:/data/oasis --name zion-oasis zion-v3-oasis
```

---

## Development

### Run Tests
```bash
# All tests (81 tests)
cargo test --manifest-path V3/Cargo.toml -p zion-oasis

# Check workspace
cargo check --manifest-path V3/Cargo.toml --workspace

# Format
cargo fmt --manifest-path V3/Cargo.toml --all
```

### Run Server Locally
```bash
cd V3/L4/oasis
cargo run --bin zion-oasis
# Server starts on http://localhost:8094
```

### Regenerate Avatar JSON
```bash
python3 V3/L4/oasis/scripts/parse_avatars.py
# Output: V3/L4/oasis/data/avatars.json
```

---

## Data Files

| File | Content | Size |
|---|---|---|
| `data/avatars.json` | 199 avatars + quest lines | ~3,440 lines |
| `data/golden_egg.json` | 108 clues, 3 master keys | 133 lines |
| `data/prize_tiers.json` | 10 tiers + runner-ups | 100 lines |
| `data/world.json` | 7 genesis territories | 216 lines |

---

## License & Attribution

© 2026 ZION TerraNova. All Rights Reserved.

Generated with [Devin](https://cli.devin.ai/docs)
