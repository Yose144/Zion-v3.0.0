# ZION OASIS — Unreal Engine 5 Project

> **Engine:** Unreal Engine 5.4  
> **Module:** `ZionOasis`  
> **Backend:** Rust/Axum oasis API on port `8094` + L1 chain RPC on `8444`  
> **Target:** AAA MMORPG — 10 000 players/realm, 7 sacred continents, 51 avatar NFTs  
> **Budget:** $50 000 000 USD  |  **Timeline:** 2026–2029

---

## System Requirements

### Minimum (Development)
| Component | Spec |
|-----------|------|
| OS | Windows 10/11 64-bit |
| CPU | Intel i7-10700K / AMD Ryzen 7 3700X |
| RAM | 32 GB |
| GPU | NVIDIA RTX 3070 / AMD RX 6700 XT (8 GB VRAM) |
| Storage | 500 GB NVMe SSD |
| UE version | 5.4.x (120 GB install) |

### Recommended (AAA)
| Component | Spec |
|-----------|------|
| OS | Windows 11 64-bit |
| CPU | Intel i9-13900K / AMD Ryzen 9 7950X |
| RAM | 64–128 GB DDR5 |
| GPU | NVIDIA RTX 4090 (24 GB VRAM) |
| Storage | 2 TB NVMe SSD (PCIe 4.0) |
| Network | 1 Gbps |

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

### Step-by-step (first time)

1. Ensure **Unreal Engine 5.4** is installed via Epic Games Launcher.
2. Right-click `ZionOasis.uproject` → **Generate Visual Studio project files**.  
   *(This requires UE5 to be the default handler for `.uproject` files — set it in Epic Launcher → Library → right-click engine → "Set as default".)*
3. Open `ZionOasis.sln` in **Visual Studio 2022** (C++ Desktop workload required).
4. Set build configuration: **Development Editor | Win64**.
5. Build solution: **Ctrl+Shift+B** (first build takes 5–15 min, ~1 600 files).
6. When the build succeeds, double-click `ZionOasis.uproject` to open in UE5 Editor.

### Create the startup map (required on first launch)

The file `Content/Maps/L_Startup.umap` is a binary UE5 asset — it must be created inside the Editor:

1. In the UE5 Editor: **File → New Level → Empty Level**.
2. **File → Save Current Level As…** → navigate to `Content/Maps/` → name it `L_Startup`.
3. Open **Edit → Project Settings → Maps & Modes**:
   - Set **Game Default Map** = `L_Startup`
   - Set **Transition Map** = `L_Startup`
4. Save project settings (**Ctrl+S**).

After saving `L_Startup.umap` you can reload the project and it will start correctly.

### Subsequent launches

Simply double-click `ZionOasis.uproject` — no Visual Studio needed unless C++ files changed.

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

## Version Control — Git LFS

Binary UE5 assets (`.uasset`, `.umap`) should use Git LFS in production:

```bash
git lfs install

# Add to .gitattributes at repo root
*.uasset filter=lfs diff=lfs merge=lfs -text
*.umap   filter=lfs diff=lfs merge=lfs -text
*.ubulk  filter=lfs diff=lfs merge=lfs -text
*.uplugin filter=lfs diff=lfs merge=lfs -text
```

For a team of 50+ people switch to **Perforce Helix Core** — UE5 has native Perforce integration and it handles large binary files without LFS limits.

---

## Recommended Third-Party Plugins

| Plugin | Cost | Purpose |
|--------|------|---------|
| MetaHuman Creator | Free | Photorealistic character faces |
| Quixel Bridge | Free (UE5) | Megascans environment assets |
| Water | Free (built-in) | Ocean, rivers, lakes |
| Landmass | Free (built-in) | Procedural landscape |
| Niagara | Free (built-in) | VFX particle system |
| Vivox Voice | Free ≤10k users | In-game voice chat |
| Easy Anti-Cheat | Free (Epic) | Anti-cheat |
| Houdini Engine | Free (indie) | Procedural world generation |
| Substance 3D | ~$20/month | PBR material authoring |

Vivox marketplace URL: `com.epicgames.launcher://ue/marketplace/product/d71f5abfa65f4de6830a017dd0c0b9ff`

---

## Troubleshooting

**"Out of Video Memory" crash**  
Lower shader quality: *Project Settings → Engine → Rendering → Shader Quality: Medium*. Close other GPU-heavy apps.

**"Compiling Shaders" > 30 min**  
Normal on first launch (10 000+ shaders). Use SSD, close background apps, increase Windows virtual memory to 32 GB page file.

**"Missing Modules" error**  
Right-click `ZionOasis.uproject` → *Generate Visual Studio Project Files* → open `ZionOasis.sln` → *Build Solution* (Ctrl+Shift+B).

**Multiplayer port blocked**  
Ensure firewall allows Unreal Editor on **port 7777**. For remote play use Steam lobbies (OnlineSubsystemSteam is already configured).

**Backend unreachable in PIE**  
Start the Rust oasis server first (`cargo run -p zion-oasis -- --port 8094`). The GameInstance logs `[ZionGameInstance] BlockchainBridge initialised` on success.

---

## Related Documentation

- [L4/oasis Rust API](../README.md)
- [AAA MMORPG Plan](../../../docs/v2.9.6/L4_OASIS_ARCHITECTURE.md)
- [Consciousness System](../../../L1/core/src/consciousness.rs)
