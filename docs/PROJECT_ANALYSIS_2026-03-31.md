# ZION TerraNova — Kompletní analýza projektu

> **Datum:** 31. března 2026  
> **Verze:** v2.9.6-main / V3 controlled rehearsal  
> **Živý stav:** 3 uzly synced na výšce 5 095, tip `0000f291...49236`

---

## 1. Přehled architektury

Projekt je **multi-layer monorepo** — kryptoměna ZION s vlastním PoW konsenzem, L2 DeFi vrstvou, AI/cross-chain L3 vrstvou a multi-platform klientskými aplikacemi.

### Dvě paralelní kódové linie

| Linie | Umístění | Verze | Účel |
|-------|----------|-------|------|
| **Legacy** | `L1/` – `L4/` (root) | v2.9.6 | Historický kód, audit reference, 12 workspace crate |
| **V3 Mainnet** | `V3/` | v3.0.0 | Clean-room mainnet, 11 crate, aktivní deployment |

---

## 2. Metriky kódu

| Oblast | Soubory | LoC (Rust) | Disk |
|--------|---------|------------|------|
| **V3/** (aktivní mainnet) | 157 `.rs` souborů | **86 694** | 2.1 GB (vč. target/) |
| **L1/** (legacy) | 187 `.rs` souborů | **76 601** | 6.0 MB |
| **APP&WEB/website** | 6 458 `.ts/.tsx` | — | 3.8 GB (vč. node_modules) |
| **APP&WEB/desktop-agent** | 25 `.js` + 143 `.py` | — | (obsaženo v APP&WEB) |
| **docs/** | 3 076 `.md` souborů | — | 38 MB |
| **docker/** | 10 compose + 6 Dockerfiles | — | 112 KB |
| **scripts/** | ~20 deploy/ops skriptů | — | 3.5 MB |

**Celkem Rust: ~163 000 LoC** ve dvou paralelních stromech.

---

## 3. V3 Mainnet — Stav a zdraví

### Build status: ✅ Kompiluje bez chyb

- Pouze warnings: 19× `dead_code` ve `zion-warp`, 4× ve `zion-miner`, 3× ve `zion-ai-native`
- Žádné compile errors

### 11 production crate

| Vrstva | Crate | Testy | Popis |
|--------|-------|-------|-------|
| **L1** | `zion-core` | 432 | Blockchain engine, UTXO, konsenzus, P2P, RPC, LMDB |
| **L1** | `zion-cosmic-harmony` | 95 | Ekam Deeksha v2 PoW (256 KiB scratchpad, NPU epoch) |
| **L1** | `zion-pool` | 29 | Stratum server, PPLNS, share validace |
| **L1** | `zion-miner` | 59 | CPU/GPU miner (Metal, CUDA, OpenCL) + DCR stealth |
| **L1** | `zion-native-ffi` | 4 | FFI scaffold pro 8+ nativních algoritmů |
| **L2** | `zion-bridge` | 157 | wZION relay (L1↔EVM), 3-of-5 validátor quorum |
| **L2** | `zion-dao` | 65 | Governance, treasury, humanitární fond |
| **L2** | `zion-atomic-swap` | 15 | HTLC cross-chain swapy |
| **L3** | `zion-ncl` | 43 | Neural Compute Layer, AI task marketplace |
| **L3** | `zion-warp` | 252 | Universal bridge (7 chainů: EVM/BTC/SOL/TRX/XLM/ADA/ATOM) |
| **L3** | `zion-ai-native` | 89 | Agent orchestrator, consciousness engine |

**Celkem: ~1 240 testů** (0 failures)

---

## 4. Legacy L1 — Stav

| Crate | LoC | Testy | Popis |
|-------|-----|-------|-------|
| `zion-core` | 16 202 | 419 | Plný blockchain node |
| `zion-pool` | 14 441 | 31 | Multi-algo pool (Stratum v2, 12+ algoritmů) |
| `zion-cosmic-harmony-v3` | 12 421 | 46 | PoW engine + GPU backendy |
| `zion-miner` | 10 233 | 20 | Univerzální miner |
| `verushash-native` | — | — | FFI wrapper pro VerusHash |

**Status**: 🔒 LOCKED — žádné změny bez hard-fork governance vote. Slouží jako referenční materiál a audit evidence.

---

## 5. APP&WEB — Klientské aplikace

### Desktop Agent (Electron, v2.9.9)

- **Entry**: `src/main.js` (Electron main process)
- **Mining**: Rust miner jako primární, Python Deeksha fallback
- **GPU**: Metal shader (`ekam_deeksha.metal`), OpenCL
- **Build targets**: Windows (NSIS), macOS (DMG), Linux (AppImage, deb)
- **AI**: `zion_ai_afterburner.py`, AI native client
- **Bench**: Rust Metal M1 ~28.2 kH/s, Python Metal ~9.6 kH/s

### Website (Next.js 16, v2.9.9)

- **Stack**: React 19, TypeScript 5, Tailwind CSS, Three.js/Spline 3D
- **Stránky**: Dashboard, Explorer, Mining, Pool, DAO, Bridge, Warp, AI-Native, docs...
- **Deploy**: Docker standalone build (ne static export), `scripts/deploy.sh`
- **3D vizualizace**: Tree of Life (Spline/Three.js), Starfield

### Mobile App (React Native 0.73, v2.9.6)

- **Stack**: Expo 54, biometrie, QR/kamera, keychain
- **Funkce**: Wallet, mining manager, background fetch

---

## 6. Infrastruktura a deployment

### Docker stacks

- `docker-compose.v3-mainnet.yml` — **Production** (core + seed + pool + miner + redis)
- `docker-compose.mainnet.yml` — Legacy 2.9.6 reference
- `docker-compose.monitoring.yml` — Prometheus + Grafana
- `docker-compose.website.yml` — Next.js web

### Bezpečnostní hardening

- `read_only: true` kontejnery
- `no-new-privileges` security opt
- Resource limits (CPU/RAM) na každém kontejneru
- REDIS_PASSWORD z `.env` (žádný hardcode)

### Monitoring

- Prometheus scraping (9090), Grafana dashboardy (3001)
- `scripts/stability_monitor.sh` — 72h regresní detektor
- `scripts/mainnet_stability_collector.mjs` — realtime metriky

---

## 7. Konsenzuální parametry (Mainnet)

| Parametr | Hodnota |
|----------|---------|
| **Algoritmus** | Cosmic Harmony Ekam Deeksha v2 |
| **Block time** | 60 sekund |
| **Block reward** | 5 400.067 ZION (Dekáda 1) |
| **Celková nabídka** | 144 miliard ZION |
| **Atomová jednotka** | 1 ZION = 10⁶ flowers *(updated to 6-decimal in 3.0.3 fork)* |
| **DAA** | LWMA (60 bloků, ±25% clamp) |
| **Max reorg** | 10 bloků |
| **Soft finality** | 60 bloků |
| **Coinbase maturity** | 100 bloků |
| **Fee policy** | 100% burn |
| **ASIC hardening** | 256 KiB scratchpad, 4 passes, 256 random reads + NPU epoch mixing |

---

## 8. Živý stav serverů — 31. března 2026, 11:28 UTC

### Konsenzus: ✅ Všechny 3 nody na stejném tip

| Server | Node ID | Chain Height | Tip Hash | Accepted Blocks | Kontejnery |
|--------|---------|-------------|----------|-----------------|-------------|
| **Praha** (91.98.122.165) | `v3-mainnet-prague` | **5 095** | `0000f291...49236` | 5 096 | 15 kontejnerů |
| **USA** (5.78.194.94) | `v3-mainnet-usa` | **5 095** | `0000f291...49236` | 5 096 | 2 kontejnery |
| **Singapur** (5.223.84.191) | `v3-mainnet-singapore` | **5 095** | `0000f291...49236` | 5 096 | 2 kontejnery |

**Tip hash shodný na všech 3 uzlech** — full mesh P2P relay funguje.

### P2P Mesh: ✅ 6/6 směrů aktivních

- Praha ↔ USA (hello/welcome/get_status/ping/pong)
- Praha ↔ Singapur (hello/welcome/get_status/ping/pong)
- USA ↔ Singapur (hello/welcome/get_status/ping/pong)

Seed nody (`zion-seed-1`) na USA i SG fungují — relay OK, synchro bloků probíhá.

### Hardware stav

| Server | Uptime | Load | Disk | RAM | Swap |
|--------|--------|------|------|-----|------|
| **Praha** | 20d 22h | 3.04 | 41G/75G (57%) | 5.0G/7.6G (66%) | 0 |
| **USA** | 3d 21h | 0.00 | 8.7G/38G (25%) | 1.8G/1.9G (95%) | 0 |
| **Singapur** | 3d 21h | 0.05 | 8.7G/38G (25%) | 1.8G/1.9G (95%) | 0 |

### Mining (jen Praha)

| Metrika | Hodnota |
|---------|---------|
| Iterace | 182 / ∞ |
| Accepted | **182** (100% accept rate) |
| Rejected | **0** |
| Hashrate 60s | ~7 550 H/s |
| Hashrate overall | ~2 401 H/s |
| Submit latency avg | 138 ms |
| Aktuální job | #5096 (height 5096) |

### Pool (Praha)

- Bloky nalezeny: **4 754**
- Fee split: 89% miner / 5% humanitarian / 5% issobella / 1% pool fee
- Humanitarian accumulated: ~1.28M ZION (v flowers)

### Služby na Praze (rozšířený stack)

| Služba | Status |
|--------|--------|
| `zion-core` | ✅ Up 47h, healthy |
| `zion-pool` | ✅ Up 3d, healthy |
| `zion-miner` | ✅ Up 3d |
| `zion-redis` | ✅ Up 3d, healthy |
| `zion-website` | ✅ Up 50min, healthy (port 3000) |
| `zion-grafana` | ✅ Up 9d, healthy (port 3001) |
| `zion-prometheus` | ✅ Up 9d, healthy (port 9090) |
| `zion-v3-bridge` | ✅ Up 16h |
| `zion-v3-dao` | ✅ Up 16h |
| `zion-v3-swap` | ✅ Up 16h |
| `zion-mainnet-stability-collector` | ✅ Up 12h |
| `zion-alertmanager` | ✅ Up 9d, healthy |
| `zion-node-exporter` | ✅ Up 9d |
| `zion-redis-exporter` | ✅ Up 9d |
| `zion-seed-1` | ✅ Up 47h |

---

## 9. Silné stránky

1. **Zralá architektura** — čistá separace L1/L2/L3, dva nezávislé Rust workspace stromy
2. **Rozsáhlé testování** — 1 240+ testů ve V3, 500+ v legacy; fuzz targets pro core i pool
3. **Multi-platform GPU** — Metal (Apple), CUDA (NVIDIA), OpenCL (AMD/cross-platform)
4. **ASIC-rezistence** — memory-hard scratchpad + NPU epoch rotace = vysoká náročnost pro ASIC
5. **Production hardening** — read-only containers, resource limits, healthchecks, monitoring stack
6. **Dokumentace** — 3 000+ markdown souborů; runbook, audit checklists, whitepaper
7. **Dual mining** — DCR stealth worker = příjem z Blake3 hashování paralelně se ZION
8. **Live konsenzus** — 3 geo-distribuované nody (EU/US/APAC) udržují shodný chain tip

---

## 10. Kritické blokátory pro veřejný launch

| # | Blokátor | Závažnost | Stav |
|---|----------|-----------|------|
| 1 | **BFG repo-cleaner** — privátní klíče v git historii | 🔴 CRITICAL | ❌ Nevyřešen |
| 2 | **Exit criteria sign-off** — dokument stále draft | 🔴 CRITICAL | ❌ Nepodepsán |
| 3 | **Genesis artifacts + checksums** — offline genesis nedokončen | 🔴 HIGH | ❌ Chybí |
| 4 | **72h closure report** — rehearsal vyžaduje finalizaci | 🟡 HIGH | 🔄 Probíhá |

---

## 11. Rizika a varování

| Oblast | Riziko | Doporučení |
|--------|--------|------------|
| **Git historie** | Privátní klíče v commits | BFG repo-cleaner ihned, pak force push + rotate klíče |
| **RAM na USA+SG** | 95% obsazení (1.8G/1.9G), žádný swap | Přidat swap nebo upgrade na CPX21 (4 GB) |
| **Disk Praha** | 57% a roste (z 37% dne 18. 3.) | Monitorovat, plánovat cleanup starých images |
| **P2P ephemeral** | Spojení se zavírají po každém handshake | Implementovat persistent connections (plánováno) |
| **L2 Bridge** | `submitBridgeUnlock` je scaffold | Doplnit core-side validaci před produkčním bridge |
| **Docs drift** | Root vs V3 dokumenty si odporují (5 vs 3 nodes) | Sjednotit source-of-truth v V3/docs |
| **Warning debt** | 26 compiler warnings v V3 | `cargo fix` pro dead_code warnings |
| **Mobile app** | Verze 2.9.6 zaostává za desktop/web 2.9.9 | Synchronizovat verze při dalším releasu |
| **USA+SG nemají pool/miner** | Single point of mining na Praze | Zvážit pool deploy na min. 2 nody |

---

## 12. Env konfigurace (live ověřeno)

Všechny 3 nody sdílí:

```
ZION_NETWORK=mainnet
ZION_MINER_ADDRESS=zion1q893q6c5j7y0e3r062g4m7c240t5g294k7z6729
ZION_HUMANITARIAN_WALLET=zion1m4v5z8z850u480c5c208z274e334369275n5y20
ZION_ISSOBELLA_WALLET=zion170a374s6h390k7w244m5c4f354v8n4678844655
ZION_POOL_FEE_WALLET=zion1y5u653y3w4z7p5r3l034y0q6u06542a426z77j7
ZION_P2P_BIND=0.0.0.0:8333
ZION_RPC_BIND=0.0.0.0:8443
ZION_POOL_BIND=0.0.0.0:8444
ZION_METRICS_BIND=0.0.0.0:9115
```

SEED_PEERS (per-node, excluding self):

| Node | SEED_PEERS |
|------|------------|
| Praha | `5.78.194.94:8333,5.223.84.191:8333` |
| USA | `91.98.122.165:8333,5.223.84.191:8333` |
| Singapur | `91.98.122.165:8333,5.78.194.94:8333` |

---

## 13. Shrnutí

Projekt je technicky pokročilá kryptoměna s vlastním PoW, DeFi, a AI vrstvou. V3 mainnet je funkční a synchronizovaný na 3 uzlech (výška 5 095, 100% share acceptance, zero rejects). Kódová základna je solidní (~163K LoC Rust, 1 240+ testů, build čistý). Hlavním blokátorem veřejného launche je bezpečnostní sanitizace git historie (privátní klíče) a formální sign-off exit kritérií. Operačně je třeba řešit RAM na USA/SG serverech (95%) a rozšířit mining na víc než jeden node.
