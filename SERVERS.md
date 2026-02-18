# 🖥️ ZION TerraNova — Seed Nodes

> **Aktualizace:** 17. února 2026
> **Cíl:** 5 seed nodů v 5 regionech pro MainNet

## Aktivní servery

| # | Lokace | IP | SSH alias | RAM | Disk | CPU | OS | Stav |
|---|--------|----|-----------|-----|------|-----|----|------|
| 1 | 🇫🇮 Helsinki | 77.42.31.72 | `zion-helsinki` | — | — | — | — | ✅ Běží (seed + pool) |
| 2 | �🇸 Los Angeles | 149.248.8.4 | `zion-losangeles` | 4 GB | 75 GB | 2 vCPU | Ubuntu 22.04 | ✅ Deployed |
| 3 | 🇦🇺 Sydney | 108.61.184.118 | `zion-sydney` | 4 GB | 75 GB | 2 vCPU | Ubuntu 22.04 | ✅ Deployed |
| 4 | 🇮🇳 Delhi | 139.84.170.133 | `zion-delhi` | 4 GB | 75 GB | 2 vCPU | Ubuntu 22.04 | ✅ Deployed |
| 5 | 🇨🇱 Santiago | 64.176.13.76 | `zion-santiago` | 4 GB | 75 GB | 2 vCPU | Ubuntu 22.04 | ✅ Deployed |

## 🏅 Olympijské kruhy — 5 kontinentů, 5 nodů

```
                    🔵                ⚫                🔴
               ╭─────────╮       ╭─────────╮       ╭─────────╮
              ( 🇫🇮 EVROPA )─────( 🇺🇸 AMERIKA)─────( 🇮🇳  ASIE  )
              ( Helsinki )     ( L.Angeles)     (  Delhi   )
               ╰────┬────╯       ╰────┬────╯       ╰────┬────╯
                    │    🟡            │          🟢     │
                    │ ╭─────────╮      │      ╭─────────╮│
                    └─( 🇨🇱 JIŽ.AM)────┴──────( 🇦🇺 OCEÁN.)┘
                      ( Santiago)             ( Sydney  )
                       ╰─────────╯             ╰─────────╯

          ╔═══════════════════════════════════════════════════╗
          ║    🌟 ZION TerraNova — Global P2P Network 🌟     ║
          ║    5 Seed Nodes · 5 Continents · Port 8333       ║
          ╚═══════════════════════════════════════════════════╝
```

```
              ZION GLOBAL SEED NETWORK — Olympic Rings

                          🇫🇮 Helsinki
                            ╱   ╲
                           ╱     ╲
            🇺🇸 Los Angeles ───⛏️─── 🇮🇳 Delhi
                           ╲     ╱
                            ╲   ╱
              🇨🇱 Santiago ───┴─── 🇦🇺 Sydney

                   ◯     ◯     ◯
                     ◯     ◯
            5 rings · 5 continents · 1 network
```

| Kontinent | Nod | Barva kruhu |
|-----------|-----|-------------|
| 🔵 **Evropa** | Helsinki | Modrý |
| ⚫ **Severní Amerika** | Los Angeles | Černý |
| 🔴 **Asie** | Delhi | Červený |
| 🟡 **Jižní Amerika** | Santiago | Žlutý |
| 🟢 **Oceánie** | Sydney | Zelený |

## Připojení

```bash
ssh zion-helsinki     # 🇫🇮 Evropa
ssh zion-losangeles   # 🇺🇸 Severní Amerika
ssh zion-sydney       # 🇦🇺 Oceánie
ssh zion-delhi        # 🇮🇳 Asie
ssh zion-santiago     # 🇨🇱 Jižní Amerika
```

## Deploy nového nodu

```bash
ssh zion-losangeles 'bash -s' < scripts/deploy-new-node.sh
ssh zion-sydney     'bash -s' < scripts/deploy-new-node.sh
ssh zion-delhi      'bash -s' < scripts/deploy-new-node.sh
ssh zion-santiago   'bash -s' < scripts/deploy-new-node.sh
```

## 🔑 SSH klíče a přístupy

### Klíče (`~/.ssh/`)

| Klíč | Soubor | Použití |
|------|--------|---------|
| **Vultr servery** | `~/.ssh/zion_servers_ed25519` | LA, Sydney, Delhi, Santiago, Helsinki |
| **Hetzner** | `~/.ssh/zion_hetzner_key` | Helsinki (77.42.31.72), Germany (195.201.31.201) |
| **Deploy (starý)** | `~/.ssh/zion_deployment_key` | Starý server 91.98.122.165 |
| **Server key** | `~/.ssh/zion_server_key` | Záloha |

- **Typ:** Ed25519
- **Hlavní klíč:** `~/.ssh/zion_servers_ed25519`
- **Fingerprint:** `SHA256:inS+3Zmbn3ewfRb5AGwfcfbuXmh0Y0tR3riPl/GtOYo`

### SSH Config (`~/.ssh/config`)

```
Host zion-helsinki       → 77.42.31.72    (klíč: zion_servers_ed25519)
Host zion-losangeles     → 149.248.8.4    (klíč: zion_servers_ed25519)
Host zion-sydney         → 108.61.184.118 (klíč: zion_servers_ed25519)
Host zion-delhi          → 139.84.170.133 (klíč: zion_servers_ed25519)
Host zion-santiago       → 64.176.13.76   (klíč: zion_servers_ed25519)
Host zion-germany        → 195.201.31.201 (klíč: zion_servers_ed25519)
```

### Přímé připojení (alternativně s explicitním klíčem)

```bash
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72       # Helsinki (Hetzner klíč)
ssh -i ~/.ssh/zion_servers_ed25519 root@149.248.8.4    # LA
ssh -i ~/.ssh/zion_servers_ed25519 root@108.61.184.118 # Sydney
ssh -i ~/.ssh/zion_servers_ed25519 root@139.84.170.133 # Delhi
ssh -i ~/.ssh/zion_servers_ed25519 root@64.176.13.76   # Santiago
```

## 🌐 Porty (Testnet)

| Port | Služba | Popis |
|------|--------|-------|
| **8334** | P2P | Testnet peer-to-peer |
| **8444** | RPC | Testnet JSON-RPC (`/jsonrpc`) |
| **3333** | Stratum | Mining pool (pouze Helsinki) |
| **8080** | Pool API | Pool statistiky (pouze Helsinki) |
| **3000** | Web | Dashboard / Website (pouze Helsinki) |
| **3001** | Grafana | Monitoring (pouze Helsinki) |
| **9090** | Prometheus | Metriky (pouze Helsinki) |

