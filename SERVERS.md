# 🖥️ ZION TerraNova — Active Servers

> **Aktualizace:** 10. března 2026  
> **Aktuální topologie:** 1 nový primární server po resetu infrastruktury  
> **Chain status:** přechod na nový host `91.98.122.165` jako aktuální source of truth pro deploy a web

> Původní servery `77.42.31.72`, `178.156.240.160`, `5.223.43.93` a starší historické uzly jsou brané jako decommissioned. Nejsou už zdrojem pravdy pro operace ani dokumentaci.

## Aktivní server

| # | Název | Lokace | IP | HW | SSH alias | Klíč | Stav |
|---|-------|--------|----|-----|-----------|------|------|
| 1 | Zion2 | primární produkční host | 91.98.122.165 | aktivní produkční VM | `zion-primary` | `zion_hetzner_key` | ✅ Core + Pool + Redis + Website deploy target |

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
| Zion2 (`91.98.122.165`) | `zion-core`, `zion-pool`, `zion-redis`, `zion-seed-1`, `zion-seed-2` | n/a | ✅ Active |

### Docker image verze (live 2026-03-10)

| Komponenta | Zion2 |
|-----------|-------|
| Core | `zion-core` |
| Pool | `zion-pool` |
| Redis | `zion-redis` |
| Seeds | `zion-seed-1`, `zion-seed-2` |

> **Poznámka:** Dokumentace od 10. 3. 2026 používá jako aktivní deploy target jen `91.98.122.165`. Staré IP adresy zůstávají pouze v historických reportech a archivech.

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
```

| # | Název | IP | Role |
|---|-------|----|------|
| 1 | Zion2 | 91.98.122.165 | primární host pro chain + pool + web |

## Připojení

```bash
ssh zion-primary    # 91.98.122.165 — current primary host
```

## Deploy seed nodů

```bash
# Preferovaný orchestrátor pro chain stack zůstává 2.9.8 autopilot,
# ale website deploy se provádí samostatně na 91.98.122.165.
bash scripts/autopilot-2.9.8.sh --remote --network testnet
```

## SEED_PEERS

```
91.98.122.165:8334
```

## 🔑 SSH klíče a přístupy

### Klíče (`~/.ssh/`)

| Klíč | Soubor | Použití |
|------|--------|---------|
| **Hetzner** | `~/.ssh/zion_hetzner_key` | Zion2 / current primary |
| **Testnet servery** | `~/.ssh/zion_server_key` | historický klíč, nepoužívat pro 2.9.8 rollout |
| **Deploy (starý)** | `~/.ssh/zion_deployment_key` | historický klíč, nepoužívat |

- **Typ:** Ed25519
- **Hlavní klíč pro všechny 3 aktivní servery:** `~/.ssh/zion_hetzner_key`
- **Fingerprint:** `SHA256:inS+3Zmbn3ewfRb5AGwfcfbuXmh0Y0tR3riPl/GtOYo`

### SSH Config (`~/.ssh/config`)

Přidat/aktualizovat `~/.ssh/config`:

```
Host zion-primary
    HostName 91.98.122.165
    User root
    IdentityFile ~/.ssh/zion_hetzner_key
```

### Přímé připojení (s explicitním klíčem)

```bash
ssh -i ~/.ssh/zion_hetzner_key     root@91.98.122.165   # Zion2 / current primary
```

## 🌐 Porty (Testnet)

| Port | Služba | Popis | Kde |
|------|--------|-------|-----|
| **8334** | P2P | Testnet peer-to-peer | Zion2 |
| **8444** | RPC | Testnet JSON-RPC (`/jsonrpc`) | Zion2 |
| **3333** | Stratum | Mining pool | Zion2 |
| **8080** | Pool API | Pool statistiky | Zion2 |
| **3000** | Web | Dashboard / Website | Zion2 |
| **3001** | Grafana | Monitoring | Zion2 |
| **9090** | Prometheus | Metriky | Zion2 |

