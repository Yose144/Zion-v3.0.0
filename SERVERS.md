# 🖥️ ZION TerraNova — Active Servers

> **Aktualizace:** 27. března 2026  
> **Aktuální topologie:** 3 servery, 3 regiony, V3 mainnet full mesh  
> **Chain status:** V3 mainnet synced fleet: Prague `91.98.122.165` + USA `5.78.194.94` + Singapur `5.223.84.191` (chain height ~193, P2P relay_ok, full mesh 6/6 directions). Helsinki `157.180.41.213` decommissioned.

> Původní servery `77.42.31.72`, `178.156.240.160`, `5.223.43.93` a starší historické uzly jsou brané jako decommissioned. Nejsou už zdrojem pravdy pro operace ani dokumentaci.

## Aktivní server

| # | Název | Lokace | IP | HW | SSH alias | Klíč | Stav |
|---|-------|--------|----|-----|-----------|------|------|
| 1 | Zion-Prague | Praha / Norimberk (Hetzner) | 91.98.122.165 | CX33, 4 vCPU, 8 GB RAM, 80 GB SSD | `zion-primary` | `zion_hetzner_key` | ✅ V3 mainnet active — synced |
| 2 | Zion-US | Hillsboro, OR (Hetzner) | 5.78.194.94 | CPX11, 2 vCPU, 2 GB RAM, 40 GB SSD | `zion-us` | `zion_hetzner_key` | ✅ V3 mainnet active — synced |
| 3 | Zion-SG | Singapur (Hetzner) | 5.223.84.191 | CPX12, 2 vCPU, 2 GB RAM, 40 GB SSD | `zion-sg` | `zion_hetzner_key` | ✅ V3 mainnet active — synced |

### ❌ Decommissioned servery

| Název | IP | Důvod |
|-------|----|-------|
| Zion-MainetV3 (Helsinki) | 157.180.41.213 | Decommissioned — server odebrán |
| TreeOfLife-Zion | 77.42.31.72 | Nahrazeno novým primárním serverem |
| Usa | 178.156.240.160 | Původní multi-node topologie zrušena |
| Asia | 5.223.43.93 | Původní multi-node topologie zrušena |
| SeedDE (Nuremberg) | 46.225.126.243 | Decommissioned — geografická diverzita |
| Usa1 (Hillsboro, OR) | 5.78.178.227 | Decommissioned po stability testu |

### Runtime snapshot

| Server | Revenue kontejnery | Mysterium ID | Stav |
|---|---|---|---|
| Zion-Prague (`91.98.122.165`) | `zion-core`, `zion-pool`, `zion-miner`, `zion-redis`, `zion-seed-1`, `zion-website` | n/a | ✅ V3 mainnet synced |
| Zion-US (`5.78.194.94`) | `zion-core`, `zion-pool`, `zion-miner`, `zion-redis`, `zion-seed-1` | n/a | ✅ V3 mainnet synced |
| Zion-SG (`5.223.84.191`) | `zion-core`, `zion-pool`, `zion-miner`, `zion-redis`, `zion-seed-1` | n/a | ✅ V3 mainnet synced |

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
                    ║   3 servers, 3 regions, V3 mainnet mesh     ║
                    ╚══════════════════════════════════════════════╝

              Zion-Prague (EU)  ◄──────►  Zion-US (USA)
              91.98.122.165              5.78.194.94
                     ▲                        ▲
                     │    ╲              ╱     │
                     │      ╲          ╱       │
                     ▼        ╲      ╱         ▼
                         Zion-SG (Singapur)
                           5.223.84.191
```

| # | Název | IP | Role |
|---|-------|----|------|
| 1 | Zion-Prague | 91.98.122.165 | V3 mainnet node EU + website |
| 2 | Zion-US | 5.78.194.94 | V3 mainnet node USA |
| 3 | Zion-SG | 5.223.84.191 | V3 mainnet node Singapur |

## Připojení

```bash
ssh zion-primary    # 91.98.122.165 — Zion-Prague (EU)
ssh zion-us         # 5.78.194.94   — Zion-US (USA)
ssh zion-sg         # 5.223.84.191  — Zion-SG (Singapur)
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
91.98.122.165:8333
5.78.194.94:8333
5.223.84.191:8333
```

> **Poznámka:** Všechny 3 nody jsou V3 mainnet seed peers. Port 8333 (mainnet). Helsinki decommissioned.

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

Host zion-us
    HostName 5.78.194.94
    User root
    IdentityFile ~/.ssh/zion_hetzner_key

Host zion-sg
    HostName 5.223.84.191
    User root
    IdentityFile ~/.ssh/zion_hetzner_key
```

### Přímé připojení (s explicitním klíčem)

```bash
ssh -i ~/.ssh/zion_hetzner_key     root@91.98.122.165   # Zion-Prague / EU
ssh -i ~/.ssh/zion_hetzner_key     root@5.78.194.94     # Zion-US / USA
ssh -i ~/.ssh/zion_hetzner_key     root@5.223.84.191    # Zion-SG / Singapur
```

## 🌐 Porty (Testnet)

| Port | Služba | Popis | Kde |
|------|--------|-------|-----|
| **8334** | P2P | Testnet peer-to-peer | Zion2 |
| **8444** | RPC | Testnet JSON-RPC (`/jsonrpc`) | Zion2 |
| **3333** | Stratum | Mining pool | Zion2 |
| **8080** | Pool API | Pool statistiky | Zion2 |
| **3000** | Web | Dashboard / Website | Zion2 |

## 🌐 Porty (Mainnet V3 — aktivní)

| Port | Služba | Popis | Kde |
|------|--------|-------|-----|
| **8333** | P2P | Mainnet peer-to-peer (host networking) | Prague, USA, SG |
| **8443** | RPC | Mainnet JSON-RPC | Prague, USA, SG |
| **8444** | Pool | Stratum pool bind | Prague, USA, SG |
| **3333** | Stratum | Mining pool (Docker bridge) | Prague, USA, SG |
| **8080** | Pool API | Pool statistiky | Prague, USA, SG |
| **9115** | Metrics | Prometheus export | Prague, USA, SG |

