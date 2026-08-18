# ZION Mainnet — v3.0.6 Trinity / Mainnet Beta

> **Genesis #0 spuštěn:** 11. června 2026
> **Aktuální veřejná linka:** v3.0.6 (Trinity)
> **Runtime:** v3.0.6 Ekam Deeksha — kanonický, 6-desetinné flowers
> **Stav:** Mainnet Beta — live, pool aktivní, mining v provozu
> **Oficiální veřejný launch:** 31. prosince 2026
> **Síť:** `zion-mainnet-1`
> **Genesis hash:** `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`

---

## Co je Mainnet Beta?

**Mainnet Beta** znamená, že ZION blockchain běží živě s reálným konsensem, reálným těžením, reálnými peněženkami a reálnými ekonomickými parametry — ale síť se stále zpevňuje a audituje před oficiálním veřejným spuštěním.

V praxi to znamená:

- ✅ Bloky se těží každých ~60 sekund na živém mainnetu.
- ✅ Mining je aktivní a generuje reálné block rewards.
- ✅ DeFi, bridge, DAO a WARP služby jsou nasazeny.
- ⚠️ Síť může stále obsahovat chyby. Těžte, bridgujte a participujte **na vlastní riziko**.
- 🗓️ **Oficiální veřejné spuštění** a širší exchange / marketingová kampaň zůstávají **31. prosince 2026**.

> **Proč Beta a ne finální spuštění?** Genesis v červnu 2026 byl čistý start, ale několik bezpečnostních incidentů (F1 padělané podpisy, F5 chyba neomezené inflace, kompromitace serveru) vynutilo hard reset a přestavbu. v3.0.5 je ověřený, all-green recovery stav. Nálepku „Beta“ držíme, dokud nebudou dokončeny milníky bezpečnostního auditu, rotace klíčů a externího validátor setu naplánované na Q4 2026.

---

## Přechod na v3.0.5 — od 3.0.1 k All Green

| Milník | Datum | Co se stalo |
|--------|-------|-------------|
| **v3.0.1 Genesis Launch** | 11. 6. 2026 | První veřejný mainnet blok (#0), dual-node Edge, pool a mining live. |
| **v3.0.3 Decimal fork** | 27. 6. 2026 | `1e12` → `1e6` flower scale. Všechny zůstatky a RPC volání přešly na šestidesetinné `flowers`. |
| **Bezpečnostní incidenty** | 2.–3. 7. 2026 | F1 exploit padělaných P2P account transakcí, F5 chybějící kontrola zůstatku v účetním modelu, kompromitace serveru. Rollback chainu a starý Edge server vyřazen z provozu. |
| **v3.0.4 Hard Genesis Reset** | 6.–7. 7. 2026 | Nový server zprovozněn, nový genesis hash, všechny klíče regenerovány, full stack redeployován. |
| **v3.0.5 All Green** | 9. 7. 2026 | Verze protokolu zvýšena na 3.0.5, L2 watchery uvedeny do provozu, 11/11 služeb aktivních, E2E memo testy potvrzeny v bloku 752. |

---

## Shrnutí bezpečnostních incidentů

### F1 — Padělaná account transakce přes P2P

Útočník z kompromitovaného externího peera injekoval padělanou account-model transakci obcházením ověření podpisu v peer-block cestě. Síť se vrátila zpět (rollback) na blok 22180 a podpisová kontrola byla zpřísněna v `validate_peer_block`.

### F5 — Neomezená inflace v account modelu

Během rotace escrow klíče byla přijata TX z adresy s **nulovým zůstatkem**, čímž vzniklo 100 002 ZION z ničeho (inflace). Příčina: account model nekontroloval `sender_balance >= amount + fee`. Inflační prostředky byly spáleny na prokazatelně neutratitelnou adresu a height-gated kontrola zůstatku byla přidána jak do RPC, tak do P2P validační cesty.

### F4.7 — Strop maximální částky transakce

Byl přidán height-gated cap rovný `TOTAL_SUPPLY` (144B ZION), který zabrání jakékoli jednotlivé transakci přesunout více než celkovou peněžní zásobu. Aktivní od genesis na novém chainu.

### Kompromitace serveru a hard reset

Původní Edge server a EVM deploy klíč byly kompromitovány. Výsledek:

- Všechny L1/L2 klíče byly regenerovány air-gapped.
- Byl zprovozněn nový server bez veřejného RPC/SSH exposure, pouze hardened web/DNS surface.
- Proveden **hard genesis reset** 6.–7. července 2026 s novým genesis hashem.
- Všechny služby byly postaveny z čistého stavu.

Plný kanonický runbook: [`docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md`](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md)

### Oprava memory leaku

Po resetu byl `zion-node` dvakrát ukončen z důvodu nedostatku paměti (OOM), protože `accepted_blocks` a `known_peers` rostly bez hranic. Retention cap (1000 bloků/peers), bounded channels a drain RPC handle redukovaly růst paměti o ~98 %.

---

## Živá infrastruktura

| Služba | Stav | Poznámka |
|--------|------|----------|
| **Edge Node 1** | ✅ Aktivní | Primary / mining, P2P 8333, RPC 8443 |
| **Edge Node 2** | ✅ Aktivní | Follower / P2P sync, RPC 8448 |
| **Local Backup Node** | ✅ Aktivní | Lokální stroj v Praze přes reverzní SSH tunel, RPC 8446 |
| **Pool Server** | ✅ Aktivní | `stratum+tcp://pool.zionterranova.com:8444` |
| **Web / Dashboard** | ✅ Aktivní | `https://zionterranova.com` + `https://dashboard.zionterranova.com` |
| **Bridge** | ✅ Aktivní | L2, L1 watcher skenuje od bloku 0 |
| **DAO** | ✅ Aktivní | L2, scanner běží |
| **WARP** | ✅ Aktivní | L3 univerzální bridge |
| **Atomic Swap** | ✅ Aktivní | L2, API na 8452 |
| **Oasis / Free World / Issobella** | ✅ Aktivní | L4–L6 démoni nasazeni |
| **Watchdog timer** | ✅ Aktivní | dvouminutové health checky |

**Topologie:** 3-node P2P mesh (Edge 1 + Edge 2 + Local Backup).

---

## v3.0.5 — Co se změnilo od 3.0.1

- **Jednotná CLI binárka** — `zion` nahrazuje předchozích osm samostatných balíčků.
- **Interaktivní menu** — navigace šipkami, vedený setup wallet → node → pool → miner.
- **Live monitor** — `zion monitor` zobrazuje stav nódu, minera a walletu.
- **Account-model `memo` pole** — L1 hard fork, potvrzeno end-to-end v bloku 752 s memos BRIDGE/DAO/SWAP.
- **Kontrola zůstatku (F5 fix)** — validace na konsenzuální úrovni v RPC i P2P cestě.
- **Max-TX cap (F4.7)** — zabraňuje transakci větší než celková peněžní zásoba.
- **3-node P2P mesh** — automatická failover seed topologie.
- **Opravy úniků paměti** — bounded cache a kanály.
- **Všech 11 služeb L1–L6 aktivních** a ověřeno zeleně.

---

## Download

| Platforma | Soubor | Velikost |
|-----------|--------|----------|
| Linux x86_64 | `zion-cli-linux-x86_64.tar.gz` | 2,3 MB |
| macOS Apple Silicon (M1–M4) | `zion-cli-macos-aarch64.tar.gz` | 2,1 MB |
| macOS Intel x86_64 | `zion-cli-macos-x86_64.tar.gz` | 2,3 MB |
| Windows x86_64 | `zion-cli-windows-x86_64.zip` | 4,7 MB |
| SHA256 Checksumy | `SHA256SUMS.txt` | — |

**Download URL:** https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.0.5-beta

---

## Mining — Ekam Deeksha

**Algoritmus:** Ekam Deeksha — dual-algo PoW: BLAKE3 + RandomNPU

| Backend | Platforma | Nejlepší pro |
|---------|-----------|--------------|
| `cpu` | Vše | Default, funguje všude |
| `opencl` | Linux/Windows | AMD + NVIDIA GPU |
| `cuda` | Linux/Windows | NVIDIA GPU |
| `metal` | macOS Apple Silicon | M1–M4 GPU |

**Pool připojení:** `stratum+tcp://pool.zionterranova.com:8444`

**Povinné:** `ZION_PAYOUT_ADDRESS=<platná zion1... adresa>`

---

## Rozdělení block reward

| Příjemce | Podíl |
|----------|-------|
| ⛏️ Mineři | 89 % |
| 🕊️ Humanitární desátek | 5 % |
| 🔭 L5/L6 Issobella Fund | 5 % |
| 🏊 Poplatek poolu | 1 % |

---

## Kanonické parametry

| Parametr | Hodnota |
|----------|---------|
| Chain ID | `zion-mainnet-1` |
| Block time | 60 s |
| Block reward | 5 400,067 ZION → Decade Decay (-20 %/10 let) |
| Tail emission | 724,784723787776 ZION/block (od ~2126) |
| Total supply | 144 000 000 000 ZION |
| Desetinná místa | 6 (1 ZION = 1 000 000 flowers) |
| Těžební horizont | 100+ let + tail ∞ |
| DAA | LWMA (60 bloků, ±25 %) |
| Poplatky | Split 89/5/5/1 |
| Genesis hash | `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb` |

---

## Další čtení

- [v3.0.1 Genesis Overview](../v3.0.1/README.md) — historický první launch
- [v3.0.5 All Green Report](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/3.0.5/REPORT_3.0.5_ALL_GREEN_CZ.md)
- [v3.0.5 All Green Runbook](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/3.0.5/ZION_3.0.5_ALL_GREEN_RUNBOOK.md)
- [SecurityFirst / F1 + F5 hardening](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/3.0.4/SecurityFirst.md)
- [F5 Security Incident Report](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/3.0.4/F5_SECURITY_INCIDENT_REPORT_2026-07-02.md)
- [Hard Genesis Reset runbook](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md)
- [Veřejný GitHub repozitář](https://github.com/Zion-TerraNova/v3-Mainnet)

---

*ZION TerraNova Mainnet • v3.0.6 Trinity / Mainnet Beta • aktualizováno 22. 7. 2026*
