# ZION OASIS — Unreal Engine 5 Project

> **Engine:** Unreal Engine 5.4  
> **Module:** `ZionOasis`  
> **Backend:** Rust/Axum oasis API on port `8094` + L1 chain RPC on `8444`  
> **Target:** AAA MMORPG — 10 000 players/realm, 7 sacred continents, 51 avatar NFTs

---

## Directory Layout

```
L4/oasis/ue5/
├── ZionOasis.uproject           # UE5.4 project descriptor
├── Config/
│   ├── DefaultEngine.ini        # Nanite, Lumen, TSR, VSM
│   └── DefaultGame.ini          # GameMode, GameInstance, Steam
├── Source/ZionOasis/
│   ├── ZionOasis.Build.cs       # Module dependencies
│   ├── Consciousness/           # ConsciousnessComponent (9 levels, XP, daily cap)
│   ├── Avatar/                  # AvatarTypes — 51 sacred avatars DataTable schema
│   ├── Blockchain/              # ZionBlockchainBridge — HTTP client to Rust backend
│   ├── Player/                  # ZionCharacter + ZionPlayerController
│   ├── Game/                    # ZionOasisGameMode + ZionGameInstance
│   ├── GoldenEgg/               # GoldenEggManager — 1B ZION Brahmanda prize
│   ├── Guild/                   # GuildComponent + GuildTypes (8 orders)
│   ├── Territory/               # TerritoryManager — 8 genesis territories
│   └── UI/                      # ZionHUD — UMG widget stack
└── Content/
    ├── Maps/                    # World Partition levels per continent
    ├── Blueprints/              # BP_ZionCharacter, BP_ZionHUD, etc.
    ├── DataTables/              # DT_Avatars, DT_GoldenEggClues, DT_Territories
    ├── Characters/              # MetaHuman-compatible avatar meshes
    ├── UI/                      # WBP_* widget blueprints
    ├── Audio/                   # 432 Hz sacred soundscapes
    ├── VFX/                     # Niagara particle systems
    ├── Materials/               # Nanite-ready physically-based materials
    └── Textures/                # Albedo, normal, arm maps
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Unreal Engine | 5.4.x |
| Visual Studio | 2022 (C++17 workload) |
| .NET SDK | 8.x |
| Steam SDK | included via OnlineSubsystem |

---

## Opening the Project

1. Ensure UE 5.4 is installed via Epic Games Launcher.
2. Right-click `ZionOasis.uproject` → **Generate Visual Studio project files**.
3. Open `ZionOasis.sln` in Visual Studio 2022.
4. Build configuration: **Development Editor | Win64**.
5. Press **F5** or launch from the UE Editor toolbar.

---

## Key C++ Systems

### ConsciousnessComponent
Mirrors the Rust `consciousness.rs` exactly — 9 levels, identical XP thresholds (`[0, 1 000, 5 000, 15 000, 50 000, 150 000, 500 000, 2 000 000, 10 000 000]`), daily cap 50 000 XP, 10 XP sources.

### ZionBlockchainBridge
Singleton (`UZionBlockchainBridge::Get(World)`) that proxies all 9 oasis REST endpoints. All calls are async `FHttpRequest`; results delivered via `TFunction<void(bool,FString)>` callbacks.

```
GET  /api/players/{wallet}
POST /api/players/{wallet}/xp
GET  /api/leaderboard
POST /api/guilds
GET  /api/guilds/{id}
POST /api/guilds/{id}/join
GET  /api/territories
GET  /api/reward-pools
GET  /health
```

### GoldenEggManager
- Prize: **1 000 000 000 ZION** (Brahmanda egg)
- Requires: Consciousness Level 9 + **255** avatar quests (51 avatars × 5 quests each)
- 9 progressive clues unlocked one per consciousness level
- Server-authoritative; replicated `bEggFound` + `WinnerWallet`

### TerritoryManager
8 genesis territories loaded at server `BeginPlay`, synced from backend:

| ID | Name | Region |
|----|------|--------|
| `mount-zion` | Mount Zion | Mountains |
| `cedar-forest` | Cedar Forest | Forest |
| `negev-desert` | Negev Desert | Desert |
| `dead-sea` | Dead Sea | Ocean |
| `hermon-volcano` | Mount Hermon Volcano | Volcano |
| `jerusalem-crystal` | Jerusalem Crystal Caves | CrystalCaves |
| `jordan-valley` | Jordan Valley | Forest |
| `mediterranean` | Mediterranean Shore | Ocean |

---

## Connecting to the Rust Backend

Start the L4 oasis server before launching PIE:

```powershell
cd C:\Users\anaha\Desktop\ZION\2.9.6-main
cargo run -p zion-oasis -- --port 8094
```

The GameInstance reads `OasisApiHost` (default `http://localhost:8094`) which can be overridden via `-OasisApiHost=https://api.zionoasis.com` on the command line.

---

## Avatars DataTable

Create `Content/DataTables/DT_Avatars` in-editor using `FAvatarRow` as the row struct.
Columns: `AvatarID`, `DisplayName`, `Title`, `Teaching`, `SpecialAbilityName`,
`MinConsciousnessLevel`, `Ray`, `Rarity`, `RegionName`, `QuestCount`, `NftMetadataUri`,
`CharacterClass`, `PortraitTexture`.

---

## Related Documentation

- [L4/oasis Rust API](../README.md)
- [AAA MMORPG Plan](../../../docs/v2.9.6/L4_OASIS_ARCHITECTURE.md)
- [Consciousness System](../../../L1/core/src/consciousness.rs)
