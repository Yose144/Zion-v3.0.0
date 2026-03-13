# 🖥️ ZION TerraNova — Active Servers

> **Aktualizace:** 13. března 2026  
> **Aktuální topologie:** 2 servery (1 testnet/produkce, 1 mainnet V3)  
> **Chain status:** Ekam Deeksha testnet běží od genesis na hostu `91.98.122.165`, mainnet V3 server `157.180.41.213` připraven k provisioningu

> Původní servery `77.42.31.72`, `178.156.240.160`, `5.223.43.93` a starší historické uzly jsou brané jako decommissioned. Nejsou už zdrojem pravdy pro operace ani dokumentaci.

## Aktivní server

| # | Název | Lokace | IP | HW | SSH alias | Klíč | Stav |
|---|-------|--------|----|-----|-----------|------|------|
| 1 | Zion2 | primární produkční host | 91.98.122.165 | aktivní produkční VM | `zion-primary` | `zion_hetzner_key` | ✅ Core + Pool + Redis + Website deploy target |
| 2 | Zion-MainetV3 | Helsinki, FI (Hetzner) | 157.180.41.213 | 8 vCPU AMD EPYC, 16 GB RAM, 150 GB SSD, Ubuntu 24.04 | `zion-mainnet` | `zion_hetzner_key` | 🟡 Mainnet V3 node, připraven k provisioningu |

### ❌ Decommissioned servery

| Název | IP | Důvod |
|-------|----|-------|
| TreeOfLife-Zion | 77.42.31.72 | Nahrazeno novým primárním serverem |
| Usa | 178.156.240.160 | Původní multi-node topologie zrušena |
| Asia | 5.223.43.93 | Původní multi-node topologie zrušena |
| SeedDE (Nuremberg) | 46.225.126.243 | Decommissioned — geografická diverzita |
| Usa1 (Hillsboro, OR) | 5.78.178.227 | Decommissioned po stability testu |

### Runtime snapshot

| Server | Revenue kontejnery | Mysterium ID | Stav |
|---|---|---|---|
| Zion2 (`91.98.122.165`) | `zion-core`, `zion-pool`, `zion-miner`, `zion-redis`, `zion-seed-1`, `zion-seed-2`, `zion-website` | n/a | ✅ Active |
| Zion-MainetV3 (`157.180.41.213`) | — | n/a | 🟡 Čistý — Docker a chain stack ještě nenainstalován |

### Docker image verze (live 2026-03-11)

| Komponenta | Zion2 |
|-----------|-------|
| Core | `zion-core:2.9.8` |
| Pool | `zion-pool:2.9.8` |
| Miner | `zion-miner:2.9.8` |
| Redis | `redis:7-alpine` |
| Website | `zion-website:2.9.6` |
| Seeds | `zion-seed-1`, `zion-seed-2` (`zion-core:2.9.8`) |

> **Poznámka:** Dokumentace od 10. 3. 2026 používá jako aktivní deploy target jen `91.98.122.165`. Dne 11. 3. 2026 byl na tomto hostu proveden clean reset chain volume a plný rebuild `core + pool + miner` pro Ekam Deeksha od výšky 0. Staré IP adresy zůstávají pouze v historických reportech a archivech.

### ❌ Suspendované servery (Vultr — pozastaveny)

| Lokace | IP | Stav |
|--------|----|------|
| 🇺🇸 Los Angeles | 149.248.8.4 | ❌ Suspendován |
| 🇦🇺 Sydney | 108.61.184.118 | ❌ Suspendován |
| 🇮🇳 Delhi | 139.84.170.133 | ❌ Suspendován |
| 🇨🇱 Santiago | 64.176.13.76 | ❌ Suspendován |

## 🌐 Síť — aktuální stav

```
                    ╔══════════════════════════════════════════════╗
                    ║   🌟 ZION TerraNova — Current Infra 🌟      ║
                    ║   Single primary host during rebuild        ║
                    ╚══════════════════════════════════════════════╝

                                 Zion2 / primary
                                 91.98.122.165

                                 Zion-MainetV3
                                 157.180.41.213
```

| # | Název | IP | Role |
|---|-------|----|------|
| 1 | Zion2 | 91.98.122.165 | primární host pro chain + pool + web |
| 2 | Zion-MainetV3 | 157.180.41.213 | mainnet V3 node (provisioning) |

## Připojení

```bash
ssh zion-primary    # 91.98.122.165 — current primary host
ssh zion-mainnet    # 157.180.41.213 — mainnet V3 node
```

## Deploy seed nodů

```bash
# Preferovaný orchestrátor pro chain stack zůstává 2.9.8 autopilot,
# ale compose příkazy musí používat explicitní .env, jinak Redis naběhne bez hesla.
bash scripts/autopilot-2.9.8.sh --remote --network testnet
```

Při ručním restartu stacku:

```bash
cd /root/zion-2.9.6
docker compose -f docker/docker-compose.testnet.yml --env-file .env up -d
```

## SEED_PEERS

```
91.98.122.165:8334
```

> **Poznámka:** `157.180.41.213` je mainnet V3 node (Helsinki), není seed peer. Bude přidán jako seed až po provisioningu a spustění V3 chain stacku.

## 🔑 SSH klíče a přístupy

### Klíče (`~/.ssh/`)

| Klíč | Soubor | Použití |
|------|--------|---------|
| **Hetzner** | `~/.ssh/zion_hetzner_key` | Zion2 + Zion-MainetV3 / current hosts |
| **Testnet servery** | `~/.ssh/zion_server_key` | historický klíč, nepoužívat pro 2.9.8 rollout |
| **Deploy (starý)** | `~/.ssh/zion_deployment_key` | historický klíč, nepoužívat |

- **Typ:** Ed25519
- **Hlavní klíč pro current primary:** `~/.ssh/zion_hetzner_key`
- **Fingerprint:** `SHA256:inS+3Zmbn3ewfRb5AGwfcfbuXmh0Y0tR3riPl/GtOYo`

### SSH Config (`~/.ssh/config`)

Přidat/aktualizovat `~/.ssh/config`:

```
Host zion-primary
    HostName 91.98.122.165
    User root
    IdentityFile ~/.ssh/zion_hetzner_key

Host zion-mainnet
    HostName 157.180.41.213
    User root
    IdentityFile ~/.ssh/zion_hetzner_key
```

### Přímé připojení (s explicitním klíčem)

```bash
ssh -i ~/.ssh/zion_hetzner_key     root@91.98.122.165   # Zion2 / current primary
ssh -i ~/.ssh/zion_hetzner_key     root@157.180.41.213  # Zion-MainetV3 / mainnet V3
```

## 🌐 Porty (Testnet)

| Port | Služba | Popis | Kde |
|------|--------|-------|-----|
| **8334** | P2P | Testnet peer-to-peer | Zion2 |
| **8444** | RPC | Testnet JSON-RPC (`/jsonrpc`) | Zion2 |
| **3333** | Stratum | Mining pool | Zion2 |
| **8080** | Pool API | Pool statistiky | Zion2 |
| **3000** | Web | Dashboard / Website | Zion2 |

## 🌐 Porty (Mainnet V3 — plánováno)

| Port | Služba | Popis | Kde |
|------|--------|-------|-----|
| **8334** | P2P | Mainnet peer-to-peer | Zion-MainetV3 |
| **8444** | RPC | Mainnet JSON-RPC | Zion-MainetV3 |
| **3333** | Stratum | Mining pool | Zion-MainetV3 |
| **9090** | Metrics | Prometheus export | Zion-MainetV3 |

