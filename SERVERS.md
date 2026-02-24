# 🖥️ ZION TerraNova — Seed Nodes

> **Aktualizace:** 24. února 2026 (Session 53 — po stability testu)  
> **Cíl:** 3 seed nody (mainnet topologie po stability testu)  
> **Stability test:** ✅ ~72h bez restartů na Asia nodu, stability window splněna


Asia
CPX12 | x86 | 40 GB | ap-southeast
5.223.43.93

Singapore
1 day ago


Usa
CPX11 | x86 | 40 GB | us-east
178.156.240.160

Ashburn, VA
1 day ago


TreeOfLife-Zion
CAX21 | arm | 80 GB | eu-central
77.42.31.72

Helsinki
27 days ago


> ~~Usa1 (5.78.178.227 — Hillsboro, OR)~~ — decommissioned po stability testu  
> ~~SeedDE (46.225.126.243 — Nuremberg)~~ — decommissioned (geografická diverzita)

## Aktivní servery

| # | Název | Lokace | IP | HW | SSH alias | Klíč | Stav |
|---|-------|--------|----|-----|-----------|------|------|
| 1 | TreeOfLife-Zion | 🇫🇮 Helsinki (Hetzner) | 77.42.31.72 | CAX21 arm 80 GB | `zion-helsinki` | `zion_hetzner_key` | ✅ Seed + Pool + Web + Monitoring |
| 2 | Usa | 🇺🇸 Ashburn, VA (Hetzner) | 178.156.240.160 | CPX11 x86 40 GB | `zion-usa` | `zion_servers_ed25519` | ✅ Seed node |
| 3 | Asia | 🌏 Singapore (Hetzner) | 5.223.43.93 | CPX12 x86 40 GB | `zion-asia` | `zion_servers_ed25519` | ✅ Seed node |

### ❌ Decommissioned servery

| Název | IP | Důvod |
|-------|----|-------|
| SeedDE (Nuremberg) | 46.225.126.243 | Decommissioned — geografická diverzita |
| Usa1 (Hillsboro, OR) | 5.78.178.227 | Decommissioned po stability testu |

### 💰 Revenue stack (snapshot 24. 2. 2026 — 3 servery)

| Server | Revenue kontejnery | Mysterium ID | Stav |
|---|---|---|---|
| Helsinki (`77.42.31.72`) | `zion-bridge`, `zion-website`, `zion-mysterium`, `zion-nkn`, `zion-pool` | `0xbf85983bf3ecc65791b2884e30a9c0e1636b757b` | ✅ Active |
| Usa (`178.156.240.160`) | `zion-mysterium`, `zion-xmr-x86` | `0xe4286963afec6dbef08c217779a032e72661d711` | ✅ Active |
| Asia (`5.223.43.93`) | `zion-mysterium`, `zion-xmr-x86` | `0x687c466b9068d89f3ddba98dab15bd591e2ab61d` | ✅ Active |

Poznámka: `nkn` je v produkci zatím vypnutý (wallet init flow ještě není idempotentně zautomatizovaný).
Poznámka 2: Usa1/Usa2/Asia3 spouštějí jen Mysterium (`docker-compose.mysterium-only.yml`) — miner není potřeba.

### ❌ Suspendované servery (Vultr — pozastaveny)

| Lokace | IP | Stav |
|--------|----|------|
| 🇺🇸 Los Angeles | 149.248.8.4 | ❌ Suspendován |
| 🇦🇺 Sydney | 108.61.184.118 | ❌ Suspendován |
| 🇮🇳 Delhi | 139.84.170.133 | ❌ Suspendován |
| 🇨🇱 Santiago | 64.176.13.76 | ❌ Suspendován |

## 🌐 Síť — 3 nody (mainnet topologie)

```
          ╔══════════════════════════════════════════════════╗
          ║   🌟 ZION TerraNova — TestNet P2P Network 🌟   ║
          ║   3 Seed Nodes · Port 8334 (testnet)           ║
          ╚══════════════════════════════════════════════════╝

          🇫🇮 Helsinki (TreeOfLife)
             77.42.31.72
               ╱       ╲
              ╱         ╲
     🇺🇸 Usa            Asia 🌏
  178.156.240.160     5.223.43.93
```

| # | Název | IP | Region |
|---|-------|----|--------|
| 1 | TreeOfLife-Zion | 77.42.31.72 | 🇫🇮 EU (Hetzner Helsinki) |
| 2 | Usa | 178.156.240.160 | 🇺🇸 US East (Ashburn, VA) |
| 3 | Asia | 5.223.43.93 | 🌏 AP (Singapore) |

## Připojení

```bash
ssh zion-helsinki   # 🇫🇮 Helsinki — TreeOfLife (seed + pool + monitoring)
ssh zion-usa        # 🇺🇸 Ashburn VA — Usa
ssh zion-asia       # 🌏 Singapore — Asia
```

## Deploy seed nodů

```bash
# Nasadit core node na seed servery:
ssh zion-usa   'bash -s' < scripts/deploy-testnet.sh
ssh zion-asia  'bash -s' < scripts/deploy-testnet.sh
```

## SEED_PEERS pro nody

```
77.42.31.72:8334,178.156.240.160:8334,5.223.43.93:8334
```

## 🔑 SSH klíče a přístupy

### Klíče (`~/.ssh/`)

| Klíč | Soubor | Použití |
|------|--------|---------|
| **Hetzner** | `~/.ssh/zion_hetzner_key` | Helsinki (77.42.31.72) |
| **Testnet servery** | `~/.ssh/zion_servers_ed25519` | SeedDE, Usa1, Usa2, Asia3 |
| **Deploy (starý)** | `~/.ssh/zion_deployment_key` | Starý server 91.98.122.165 — nepoužívat |
| **Server key** | `~/.ssh/zion_server_key` | Záloha |

- **Typ:** Ed25519
- **Hlavní klíč:** `~/.ssh/zion_servers_ed25519`
- **Fingerprint:** `SHA256:inS+3Zmbn3ewfRb5AGwfcfbuXmh0Y0tR3riPl/GtOYo`

### SSH Config (`~/.ssh/config`)

Přidat/aktualizovat `~/.ssh/config`:

```
Host zion-helsinki
    HostName 77.42.31.72
    User root
    IdentityFile ~/.ssh/zion_hetzner_key

Host zion-usa
    HostName 178.156.240.160
    User root
    IdentityFile ~/.ssh/zion_servers_ed25519

Host zion-asia
    HostName 5.223.43.93
    User root
    IdentityFile ~/.ssh/zion_servers_ed25519
```

### Přímé připojení (s explicitním klíčem)

```bash
ssh -i ~/.ssh/zion_hetzner_key     root@77.42.31.72     # Helsinki (TreeOfLife)
ssh -i ~/.ssh/zion_servers_ed25519 root@178.156.240.160 # Usa (Ashburn)
ssh -i ~/.ssh/zion_servers_ed25519 root@5.223.43.93     # Asia (Singapore)
```

## 🌐 Porty (Testnet)

| Port | Služba | Popis | Kde |
|------|--------|-------|-----|
| **8334** | P2P | Testnet peer-to-peer | Všechny nody |
| **8444** | RPC | Testnet JSON-RPC (`/jsonrpc`) | Všechny nody |
| **3333** | Stratum | Mining pool | Helsinki |
| **8080** | Pool API | Pool statistiky | Helsinki |
| **3000** | Web | Dashboard / Website | Helsinki |
| **3001** | Grafana | Monitoring | Helsinki |
| **9090** | Prometheus | Metriky | Helsinki |

