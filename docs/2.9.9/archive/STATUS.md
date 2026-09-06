# ZION TerraNova — Project Status

> **Datum:** 2026-03-30  
> **Verze:** v2.9.6-main / V3 controlled rehearsal  
> **Síť:** V3 Test Mainnet Rehearsal — Prague / USA / Singapore  
> **Poznámka:** Aktivní launch-gating source of truth je `docs/mainnet/MAINNET_CHECKLIST.md`, `docs/mainnet/MAINNET_EXIT_CRITERIA.md` a veřejný dashboard. Nižší sekce tohoto souboru obsahují i starší implementační snapshoty, které nemusí přesně odrážet živý rehearsal stav.

---

## Rychlý přehled

| Oblast | Stav |
|--------|------|
| V3 consensus / blockchain | ✅ Controlled runtime drží tip agreement na 3 nodech |
| V3 rehearsal deployment | 🔄 72h stability run běží — public launch zatím NO-GO |
| V3 miner | ✅ Buildí, GPU/CPU backendy funkční |
| Legacy desktop-agent (2.9.6) | ✅ Stabilní — GPU kernel +74% vs baseline |
| Monitoring / Grafana | ✅ Live dashboard + collector + Prometheus telemetry běží |
| CI/CD pipeline | ✅ V3 CI/release workflows existují |
| BFG scrub premine klíčů | ❌ Blokuje veřejný launch |
| Exit criteria sign-off | ❌ Dokument stále draft bez podpisu |
| Genesis artefakty + checksumy | ❌ Neuzavřeno |
| 72h closure report | 🔄 Rozběhnutý, čeká na uzavření okna |
| Miner UX pro veřejnost | 🟡 Plánováno (UPGRADE_PLAN Fáze A) |

---

## V3 Mainnet — Kódová základna

### Crates (`V3/L1/`)

| Crate | LoC (est.) | Testy | Stav |
|-------|-----------|-------|------|
| `zion-cosmic-harmony` | ~3 000 | 33 pass | ✅ Clippy clean |
| `zion-core` | ~8 000 | 393 pass | ✅ Clippy clean |
| `zion-pool` | ~1 400 | 48 + 11 pass | 🟡 1 minor warning |
| `zion-miner` | ~700 | 13 pass | 🟡 4 minor warnings |
| `zion-native-ffi` | ~200 | — | 🟡 1 minor warning |
| **Celkem** | **~13 300** | **499+ / 0 fail** | ✅ |

### Implementované moduly (Phase 1–20)

**Consensus & Chain:**
- ✅ Ekam Deeksha PoW (`cosmic_harmony_ekam_deeksha`) — test vector frozen: `6339f2fb...`
- ✅ Decade Decay emission (`BASE_REWARD = 5 400 067 ZION`, tail `~724.785 ZION`, max 144B supply)
- ✅ LWMA DAA — 60-block window, ±25% clamp, 30–120s solve-time bounds
- ✅ Genesis blok — 12 premine výstupů, 16.78B ZION, frozen hash
- ✅ UTXO transakční model (TxInput/TxOutput, Ed25519, BLAKE3 txid)
- ✅ 11-step block validation (struktura, PoW, diff, timestamp, Merkle, signatury, double-spend, coinbase maturity, fees, subsidy, DAO lock)
- ✅ Fork choice (highest total_work), reorg (MAX_REORG_DEPTH=10), SOFT_FINALITY=60
- ✅ LMDB storage via heed — 8 databází, atomic writes, rollback, undo blocks
- ✅ Hardened mempool — 20MB/10K limit, fee-rate eviction, double-spend tracking

**Kryptografie:**
- ✅ Ed25519 keygen/sign/verify
- ✅ BLAKE3 general hashing
- ✅ `zion1...` 44-char adresa s checksumem (RIPEMD-160 style)
- ✅ Wallet — largest-first coin selection, `build_and_sign` se zeroize, batch payouts (max 200 příjemců)
- ✅ Fee policy — MIN_TX_FEE=1000, 100% burn, BURN_ADDRESS + DAO_ADDRESS

**P2P & Síť:**
- ✅ Persistent TCP connections (Phase 10)
- ✅ PeerManager — scoring, banning, subnet diversity (MAX_PER_SUBNET=4)
- ✅ PeerSecurity — rate limiter, escalating bans (5min → 30min → 2hod → permanent)
- ✅ Orphan buffer (200 max, 10min expiry)
- ✅ IBD state machine — batch sync 500 blocks, stall detection, peer round-robin
- ✅ Peer discovery — GetPeers exchange, merge do known_peers
- ✅ Peer persistence — `peers.json` uložen vedle chain state
- ✅ Flood-fill block propagation — SeenBlocks dedup, plan_relay()
- ✅ Mempool tx relay — AnnounceTx, SeenTransactions (8192 cap), plan_tx_relay()
- ✅ Block validation hardening — PoW verify, timestamp sanity, checkpoint enforcement
- ✅ Chain linkage verification — previous_hash_hex v AcceptedBlock

**Node RPC:**
- ✅ JSON-RPC 2.0 — 16 live metod: `getChainInfo`, `getNodeInfo`, `getBlock`, `getBlockByHeight`, `getBalance`, `getAccountBalance`, `getTransaction`, `getAccountTransaction`, `getBlockTemplate`, `getMempoolInfo`, `getPeerInfo`, `sendRawTransaction`, `submitTransaction`, `submitAccountTransaction`, `submitBlock`, `getUtxos`
- ✅ UTXO RPC — `getBalance` pro `zion1...` adresy, `getUtxos` endpoint
- ✅ Metrics Prometheus — `zion_*` prefix, health check JSON

**Pool:**
- ✅ Wire protokol `zion-v3-stratum/0.2` — JSON line (`Hello/Welcome/Job/Submit/Result/Stale/Cancel/Bye`)
- ✅ Node-backed template consumption přes RPC (`get_template`/`submit_candidate`)
- ✅ Session routing — ZION-first pinning pro user minery, weighted multistream pro backend
- ✅ Stale job expiry, upstream rejection handling

**Miner:**
- ✅ Local in-process + remote TCP pool mode
- ✅ DCR stealth worker (Blake3 Stratum, DCP-0011)
- ✅ GPU OpenCL backend (`dcr_blake3_mine.cl`)
- ✅ CPU benchmark — full-header vs precomputed-state comparison
- ✅ GPU benchmark mode (`--gpu-bench`) — precompute verify + live throughput
- ✅ Reconnect backoff (1s → 60s exponential)
- ✅ Native FFI hook — `ZION_DCR_HASH_IMPL=rust|native`

**Profit Router:**
- ✅ ExternalCoin enum — DCR, ALPH, KAS, ERG, RVN, ETC, EVR, MEWC, FLUX, CLORE, XMR
- ✅ `select_best_coin()` s hysteresis
- ✅ Blake3External revenue source (2% fee, DCR/ALPH)

**Infrastructure:**
- ✅ Docker multi-stage images — node, pool, miner (Rust builder → Debian slim runtime)
- ✅ Compose stack (`V3/docker/docker-compose.v3-mainnet.yml`)
- ✅ Canary compose (`docker-compose.v3-zion2-canary.yml`)

**DesktopApp (V3):**
- ✅ Electron shell — L1-L6 navigace
- ✅ Wallet manager skeleton — šifrovaný lokální storage
- ✅ Wallet role tagging (operator, treasury, bridge, validator)
- 🟡 Runtime subprocess supervision — skeleton, nedokončeno

---

## Legacy Desktop Agent (2.9.6-main)

| Komponenta | Stav |
|-----------|------|
| GPU kernel (Ekam Deeksha 256 KiB scratchpad) | ✅ +74% vs baseline (5.97 → 10.38 kH/s) |
| V3 CUDA benchmark (RTX 5090, release, ws=32768) | ✅ 30.37 kH/s |
| VRAM-based auto-tuning batch size | ✅ Implementováno |
| Dual mining (ZION + GPU coin) | ✅ Funguje |
| Auto-tuner class (IPC, event listener) | ✅ Implementováno |
| Profit switcher (DCR, KAS, ALPH, ERG, DCR, FLUX, CLORE, MEWC, EVR) | ✅ Rozšířeno |
| GPU feature detection + CUDA fallback | ✅ Implementováno |
| Grafana AI Consciousness dashboard | ✅ Vytvořen |
| Grafana Pool Overview (AI panely) | ✅ Rozšířen |

---

## Deployment — Canary Stack

```
Hetzner Helsinki: 91.98.122.165
  ├── zion-v3-node   :8334 (P2P), :8332 (RPC, host-local)
  ├── zion-v3-pool   :8444 (Stratum)
  └── zion-v3-miner  (internal)

Chain height: 110+ blocks
Accepted shares: 5/5 confirmed
Revenue routing: operační
```

**Seed peers (mainnet):**
- EU Prague, EU Frankfurt (`seed-eu1.zionchain.org`)
- US East (`seed-us1.zionchain.org`), US West (`seed-us2.zionchain.org`)
- APAC Singapore (`seed-ap1.zionchain.org`)

---

## Co chybí — Launch Blockers

### 🔴 KRITICKÉ

| # | Problém | Akce |
|---|---------|------|
| 1 | **BFG scrub premine klíčů** | 12 privátních klíčů v git historii (`PREMINE_WALLETS_BACKUP.json`) — **nutné před veřejným launchem** |
| 2 | **Exit criteria sign-off** | `docs/mainnet/MAINNET_EXIT_CRITERIA.md` je stále draft bez finálního podpisu |
| 3 | **Genesis artefakty + checksumy** | Offline genesis chain, tag a veřejné SHA-256 workflow nejsou uzavřené |
| 4 | **72h closure report** | Rehearsal běží, ale chybí finální closure verdict s recovery appendixem |

### 🟡 VYSOKÁ PRIORITA (UPGRADE_PLAN Fáze A–B)

| # | Problém |
|---|---------|
| 4 | Miner UX — žádný `--help`, config file, progress bar |
| 5 | `panic!()` na huge page alloc failure (miner) |
| 6 | Multi-thread nonce scan (rayon) — chybí v mainním mining path |
| 7 | Pool session timeouts a per-worker rate limity |
| 8 | Native FFI path není zapojen do live hotpath |

### 🟢 NÍZKÁ PRIORITA / Plánováno

| # | Feature |
|---|---------|
| 9 | Full async P2P (tokio) + parallel multi-peer IBD |
| 10 | HTTP transport pro JSON-RPC (axum) |
| 11 | DNS SRV peer discovery |
| 12 | DesktopApp runtime subprocess management |
| 13 | Security audit tooling |
| 14 | Load testy |

---

## Clippy Warnings (zbývající)

| Crate | Warning | Soubor |
|-------|---------|--------|
| `zion-miner` | `variant Native is never constructed` | `dcr_worker.rs:66` |
| `zion-miner` | `methods reset and current_ms are never used` | `reconnect.rs` |
| `zion-miner` | `manual implementation of .is_multiple_of()` (2×) | miner + pool |
| `zion-pool` | `manual implementation of .is_multiple_of()` | `server.rs` |
| `zion-native-ffi` | `variable does not need to be mutable` | ffi lib |

`zion-core` a `zion-cosmic-harmony` jsou **clippy clean** (Phase 19).

---

## Architektonická rozhodnutí (resolved)

| Otázka | Rozhodnutí |
|--------|-----------|
| UTXO vs Account model | ✅ UTXO (`tx.rs`: TxInput/TxOutput/Transaction) |
| Hashing algoritmus | ✅ BLAKE3 pro tx/merkle/adresy; Ekam Deeksha pro PoW |
| Fee routing | ✅ 100% burn (deflationary) — L3+ pro revenue split |
| Reward split | ✅ 100% miner v V3 — L3+ concern |
| Chain ID | ✅ `zion-mainnet-1` |

---

## Stav serveru — Live analýza (2026-03-18)

**Server:** `91.98.122.165` — Hetzner Helsinki „Zion2"  
**Uptime:** 8 dní 6 hodin | **Load avg:** 3.27 / 3.08 / 3.02  
**Disk:** 27 G / 75 G (37 % — ok) | **RAM:** 1.1 GiB / 7.6 GiB (14 % — ok) | **Swap:** 0

### Kontejnery

| Kontejner | Obraz | Status | CPU | RAM |
|-----------|-------|--------|-----|-----|
| `zion-miner` | `zion-miner:2.9.8-testnet` | Up 22 h | **295 %** (3 vlákna) | 7.5 MB |
| `zion-website` | `zion-website:2.9.9` | Up 22 h ✅ healthy | 0.01 % | 72 MB |
| `zion-pool` | `zion-pool:2.9.8-testnet` | Up 22 h ✅ healthy | 0.39 % | 13.6 MB |
| `zion-redis` | `redis:7-alpine` | Up 22 h ✅ healthy | 0.55 % | 7.7 MB |
| `zion-core` | `zion-core:2.9.8-testnet` | Up 22 h ✅ healthy | 2.80 % | 13.9 MB |
| `zion-seed-1` | `zion-core:2.9.8-testnet` | Up 22 h ❌ stall | 0 % | 18.5 MB |
| `zion-seed-2` | `zion-core:2.9.8-testnet` | Up 22 h ❌ stall | 0 % | 18.2 MB |

### Pool statistiky

| Metrika | Hodnota |
|---------|---------|
| Přijaté shares | **5 113** |
| Odmítnuté shares | **7 478** (59 % rejection rate) |
| Důvod odmítnutí | 7 471× „Does not meet target difficulty" + 7× „Duplicate" |
| VarDiff rozsah | 1 000 – 2 444 (aktivní) |
| Wallet | `zion1q893q6c5j7y0e3r062g4m7c240t5g294k7z6729` |
| Job string | `h4035-ecfb0000-...-cosmic_harmony` |

### Miner statistiky (interní pohled)

| Metrika | Hodnota |
|---------|---------|
| Přijaté shares (miner) | 4 822 |
| Odmítnuté shares (miner) | 2 |
| Miner acceptance rate | **100.0 %** |
| Hashrate | ~490 H/s (10s MA) |
| Celkové hashe | 38.2 M za 22 h |
| Vlákna | 3× CPU, bez GPU |
| Výška | **4 035** (frozen) |

### 🔴 Kritické problémy na serveru

#### 1. Chain STUCK na výšce 4 035
```
❌ prev_hash MISMATCH at height 4035:
   block.prev_hash = ecfb0000c8c21940...
   computed(prev)  = e2e006f0eb46a3e4...
```
Výskyt: **186×** v logu zion-core. Pool vydává joby s `prev_hash = ecfb0000...` ale core má jiný aktuální chain tip → každý nový blok selže validací. Chain se nepohybuje.

**Příčina:** Pravděpodobně race condition mezi pool `getBlockTemplate` a core state — pool drží stale prev_hash.

#### 2. Seed nodes banované vlastním P2P security
```
[P2P Security] Blocked blacklisted IP: 172.29.0.11  ← zion-seed-1
[P2P Security] Blocked blacklisted IP: 172.29.0.12  ← zion-seed-2
```
Seed nody jsou na jiné Docker subnet (`172.18.0.x`) než core (`172.29.0.x`). P2P security modul banuje Docker interní IPs seed nodů. Výsledek: seeds nemohou komunikovat s core.

#### 3. IBD stall — seedy nemohou synchronizovat
```
⚠️ IBD stall detected (retry 3/3)
⚠️ IBD aborted — 0 blocks downloaded
```
Seedy `zion-seed-1` a `zion-seed-2` jsou v reconnect smyčce — nemohou stáhnout jediný blok od core, protože jsou banované (viz bod 2).

#### 4. DNS seed resoluce selhává
```
[P2P] DNS lookup failed for seed1.zionterranova.com: invalid socket address
[P2P] DNS lookup failed for seed2.zionterranova.com: invalid socket address
[P2P] DNS lookup failed for seed3.zionterranova.com: invalid socket address
```
Domenový název `zionterranova.com` není nakonfigurovaný / neexistuje. Core nemůže najít žádné peers přes DNS discovery.

#### 5. Vysoká míra odmítnutí shares (pool-side)
Pool celkově odmítl 7 478 sharů (59 %). Příčina: legacy miner (`zion-miner:2.9.8-testnet`) posílá shares neodpovídající pool VarDiff targetům → klasický difficulty mismatch u legacy stratum protokolu.

### 🟢 Co funguje

- Pool přijímá shares průběžně (každých 5–10 vteřin) od aktivního mineru
- VarDiff retargeting správně kalibruje (1 000 → 2 444 → 1 000)
- Website na portu 3000 běží zdravě (`zion-website:2.9.9` — upgrade již nasazen)
- Redis zdravý
- Miner hashuje 490 H/s na 3 CPU vláknech bez přerušení

### Opravné akce (priorita)

| Priorita | Akce |
|----------|------|
| 🔴 P1 | Restartovat `zion-core` + `zion-pool` — vyčistí stale prev_hash state a chain se odblokuje |
| 🔴 P1 | Opravit P2P subnet config — seed nody musí být na stejné Docker síti jako core, nebo whitelist interní subnet v P2P security |
| 🟡 P2 | Aktualizovat DNS seed domény na `zionchain.org` v node config |
| 🟡 P2 | Nasadit V3 canary stack (compose již existuje v `/root/zion-2.9.6/V3/docker/`) |
| 🟢 P3 | Vyladit legacy stratum difficulty mismatch nebo přejít na V3 pool |

---

## Referenční dokumenty

| Dokument | Obsah |
|---------|-------|
| [V3/ROADMAP.md](V3/ROADMAP.md) | Aktivní roadmap, Phase tracker |
| [V3/docs/UPGRADE_PLAN.md](V3/docs/UPGRADE_PLAN.md) | Miner/pool/infra hardening plán |
| [V3/L1_TESTNET_VS_V3_MAINNET_AUDIT.md](V3/L1_TESTNET_VS_V3_MAINNET_AUDIT.md) | L1 testnet → V3 migrace audit |
| [docs/mainnet/MAINNET_CONSTITUTION.md](docs/mainnet/MAINNET_CONSTITUTION.md) | Konstituce — frozen parametry |
| [PREMINE_ADDRESSES_PUBLIC.txt](PREMINE_ADDRESSES_PUBLIC.txt) | 12 premine adres (public) |
| [SERVERS.md](SERVERS.md) | Server inventory a SSH přístupy |
