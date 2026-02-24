# 🖥️ ZION TerraNova — Seed Nodes

> **Aktualizace:** 24. února 2026 (Session 50 — live server check)  
> **Cíl:** 5 seed nodů pro TestNet → MainNet  
> **Poznámka:** Původní Vultr servery (LA, Sydney, Delhi, Santiago) suspendovány → nahrazeny testovacími nody



Asia3
CPX12 | x86 | 40 GB | ap-southeast
5.223.43.93

Singapore
about 4 hours ago


Usa2
CPX11 | x86 | 40 GB | us-east
178.156.240.160

Ashburn, VA
about 4 hours ago


Usa1
CPX11 | x86 | 40 GB | us-west
5.78.178.227

Hillsboro, OR
about 4 hours ago


SeedDE
CAX11 | arm | 40 GB | eu-central
46.225.126.243

Nuremberg
about 4 hours ago


TreeOfLife-Zion
CAX21 | arm | 80 GB | eu-central
77.42.31.72

Helsinki
25 days ago

## Aktivní servery

| # | Název | Lokace | IP | SSH alias | Klíč | Stav |
|---|-------|--------|----|-----------|------|------|
| 1 | TreeofLife | 🇫🇮 Helsinki (Hetzner) | 77.42.31.72 | `zion-helsinki` | `zion_hetzner_key` | ✅ Běží (seed + bridge + website + monitoring) |
| 2 | Seed | 🇩🇪 Germany | 46.225.126.243 | `zion-seedde` | `zion_server_key` | ✅ Běží (seed + mysterium) |
| 3 | Seed2 | 🇺🇸 USA 1 | 5.78.178.227 | `zion-usa1` | `zion_hetzner_key` | ✅ Běží (seed + mysterium) |
| 4 | Seed3 | 🇺🇸 USA 2 | 178.156.240.160 | `zion-usa2` | `zion_hetzner_key` | ✅ Běží (seed + mysterium) |
| 5 | Seed4 | 🌏 Asia | 5.223.43.93 | `zion-asia3` | `zion_hetzner_key` | ✅ Běží (seed + mysterium) |

### 💰 Revenue stack (snapshot 23. 2. 2026)

| Server | Revenue kontejnery | Mysterium ID | Stav |
|---|---|---|---|
| Helsinki (`77.42.31.72`) | `zion-bridge`, `zion-website`, `zion-mysterium`, `zion-nkn` | `0xbf85983bf3ecc65791b2884e30a9c0e1636b757b` | ✅ Registered (minery odstaveny 24.2.2026 — RAM cleanup) |
| Germany (`46.225.126.243`) | `zion-dero-miner`, `zion-epic-miner`, `zion-mysterium` | `0x1a9bcc8298a4cd214a90fb63e1eb5effa8fd8969` | ✅ Registered |
| Usa1 (`5.78.178.227`) | `zion-mysterium`, `zion-xmr-x86` | `0xbfce8102af31342a22bdf217c7fd446d1476d2f7` | ✅ Registered |
| Usa2 (`178.156.240.160`) | `zion-mysterium`, `zion-xmr-x86` | `0xe4286963afec6dbef08c217779a032e72661d711` | ✅ Registered |
| Asia3 (`5.223.43.93`) | `zion-mysterium`, `zion-xmr-x86` | `0x687c466b9068d89f3ddba98dab15bd591e2ab61d` | ✅ Registered |

Poznámka: `nkn` je v produkci zatím vypnutý (wallet init flow ještě není idempotentně zautomatizovaný).
Poznámka 2: Usa1/Usa2/Asia3 spouštějí jen Mysterium (`docker-compose.mysterium-only.yml`) — miner není potřeba.

### ❌ Suspendované servery (Vultr — pozastaveny)

| Lokace | IP | Stav |
|--------|----|------|
| 🇺🇸 Los Angeles | 149.248.8.4 | ❌ Suspendován |
| 🇦🇺 Sydney | 108.61.184.118 | ❌ Suspendován |
| 🇮🇳 Delhi | 139.84.170.133 | ❌ Suspendován |
| 🇨🇱 Santiago | 64.176.13.76 | ❌ Suspendován |

## � Testovací síť — 5 nodů

```
          ╔═══════════════════════════════════════════════════╗
          ║    🌟 ZION TerraNova — TestNet P2P Network 🌟    ║
          ║    5 Seed Nodes · Port 8334 (testnet)            ║
          ╚═══════════════════════════════════════════════════╝

              🇫🇮 Helsinki (TreeofLife)
                 77.42.31.72
               ╱     |      ╲
              ╱      |       ╲
    🇩🇪 SeedDE     Seed2 🇺🇸    Seed3 🇺🇸
  46.225.126.243  5.78.178.227  178.156.240.160
              ╲      |       ╱
               ╲     |      ╱
             Seed4 🌏 Asia
             5.223.43.93
```

| # | Název | IP | Region |
|---|-------|----|--------|
| 1 | TreeofLife | 77.42.31.72 | 🇫🇮 Evropa (Hetzner Helsinki) |
| 2 | Seed | 46.225.126.243 | 🇩🇪 Evropa (Germany) |
| 3 | Seed2 | 5.78.178.227 | 🇺🇸 USA 1 |
| 4 | Seed3 | 178.156.240.160 | 🇺🇸 USA 2 |
| 5 | Seed4 | 5.223.43.93 | 🌏 Asie |

## Připojení

```bash
ssh zion-helsinki   # 🇫🇮 Helsinki — TreeofLife (seed + pool + monitoring)
ssh zion-seedde     # 🇩🇪 Germany — Seed
ssh zion-usa1       # 🇺🇸 USA 1 — Seed2
ssh zion-usa2       # 🇺🇸 USA 2 — Seed3
ssh zion-asia3      # 🌏 Asia — Seed4
```

## Deploy seed nodů

```bash
# Nasadit core node na všechny seed servery:
ssh zion-seedde  'bash -s' < scripts/deploy-testnet.sh
ssh zion-usa1    'bash -s' < scripts/deploy-testnet.sh
ssh zion-usa2    'bash -s' < scripts/deploy-testnet.sh
ssh zion-asia3   'bash -s' < scripts/deploy-testnet.sh
```

## SEED_PEERS pro nody

```
77.42.31.72:8334,46.225.126.243:8334,5.78.178.227:8334,178.156.240.160:8334,5.223.43.93:8334
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

Host zion-seedde
    HostName 46.225.126.243
    User root
    IdentityFile ~/.ssh/zion_servers_ed25519

Host zion-usa1
    HostName 5.78.178.227
    User root
    IdentityFile ~/.ssh/zion_servers_ed25519

Host zion-usa2
    HostName 178.156.240.160
    User root
    IdentityFile ~/.ssh/zion_servers_ed25519

Host zion-asia3
    HostName 5.223.43.93
    User root
    IdentityFile ~/.ssh/zion_servers_ed25519
```

### Přímé připojení (s explicitním klíčem)

```bash
ssh -i ~/.ssh/zion_hetzner_key     root@77.42.31.72     # Helsinki (TreeofLife)
ssh -i ~/.ssh/zion_servers_ed25519 root@46.225.126.243  # SeedDE (Seed)
ssh -i ~/.ssh/zion_servers_ed25519 root@5.78.178.227    # Usa1 (Seed2)
ssh -i ~/.ssh/zion_servers_ed25519 root@178.156.240.160 # Usa2 (Seed3)
ssh -i ~/.ssh/zion_servers_ed25519 root@5.223.43.93     # Asia3 (Seed4)
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

