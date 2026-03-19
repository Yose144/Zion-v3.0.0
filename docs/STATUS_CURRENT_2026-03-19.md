# ZION TerraNova — Aktuální stav projektu

**Datum:** 19. března 2026  
**Verze:** Cargo workspace 2.9.6 · V3 workspace 3.0.0 · Website 2.9.8 „Deeksha"  
**Infrastruktura:** Primární host 91.98.122.165 (Hetzner Zion2)

---

## Souhrn

ZION TerraNova je kryptoměnový ekosystém se 4 hlavními vrstvami (L1–L4), vlastním PoW konsenzem Cosmic Harmony Ekam Deeksha v2, desktop agentovým minerem a Next.js webem. Projekt je ve fázi aktivního testnet provozu — V3 stack běží na serveru s aktivně rostoucím chainem.

---

## V3 TestNet — Live Status (19. 3. 2026)

| Metrika | Hodnota |
|---------|---------|
| **Chain height** | 48+ (aktivně roste) |
| **Accepted blocks** | 49 |
| **Konsenzus** | `cosmic_harmony_ekam_deeksha_v2` |
| **Difficulty** | LWMA, 60-block window, ±25% clamp |
| **Block time target** | 60s |
| **Docker kontejnery** | 7 (core, seed1, seed2, pool, miner, redis, node) |
| **Compose file** | `docker/docker-compose.v3-testnet.yml` |
| **Mining config** | NONCE_COUNT=500K, JOB_TTL_MS=180s |

### Opravy nasazené 19. 3. 2026

1. **prev_hash lenient validation** — stored hash lookup + warn-only při algorithm mismatch
2. **P2P private IP exemption** — RFC 1918 bypass pro Docker seed nody
3. **Redis env fix** — `--env-file .env` injekce pro REDIS_PASSWORD
4. **Miner TTL tuning** — nonce 5M→500K, TTL 60s→180s (eliminace stale shares)
5. **P2P duplicate block fix** — duplicate check před validate_peer_block() (commit `f2ca370`)

---

## Statistiky kódu

| Metrika | Hodnota |
|---------|---------|
| **Rust souborů** | 340+ |
| **Rust LOC celkem** | 114 520+ |
| **Rust `#[test]` celkem** | 1 379+ |
| **V3 workspace** | Plně samostatný mainnet track |
| **Docker compose** | 8+ funkčních compose souborů |

### LOC a testy per vrstva

| Vrstva | LOC | Testy | Stav |
|--------|-----|-------|------|
| **L1 celkem** | 74 985 | 729 | ✅ Produkčně připravena |
| **L2 celkem** | 21 387 | 245 | 🔵 Implementováno |
| **L3 celkem** | 14 654 | 356 | 🔵 Implementováno |
| **L4 celkem** | 3 494 | 49 | 🟡 Aktivní vývoj |

---

## Infrastruktura

| Komponenta | Umístění | Stav |
|------------|----------|------|
| **Primární server** | 91.98.122.165 (Hetzner Zion2) | ✅ Běží |
| **V3 Core node** | Docker `zion-core` (image `zion-core:2.9.8-testnet`) | ✅ Live, height 48+ |
| **V3 Pool** | Docker `zion-pool` | ✅ Accepting shares |
| **V3 Miner** | Docker `zion-miner` | ✅ Mining blocks |
| **V3 Seeds** | Docker `zion-seed1`, `zion-seed2` | ✅ P2P connected |
| **Redis** | Docker `zion-redis` | ✅ Healthy |
| **Website** | Docker container `zion-website` | ✅ Produkce |
| **Monitoring** | Prometheus + Grafana stack | ✅ Nasazeno |

---

## Verze a verzování

| Komponenta | Verze | Poznámka |
|------------|-------|----------|
| Cargo.toml workspace | **2.9.6** | Vývojový základ (legacy root) |
| V3 workspace | **3.0.0** | Mainnet track, clean-room |
| cosmic-harmony crate | **3.0.0** | Ekam Deeksha v2 |
| Website (package.json) | **2.9.8** | Release verze |
| Desktop agent | **2.9.7** | Stabilní |

---

## Git Status (19. 3. 2026)

**HEAD:** `f2ca370` — V3: fix P2P duplicate block re-announcement causing difficulty mismatch

**Modified (unstaged):**
- `L1/core/src/blockchain/validation.rs` — lenient prev_hash validation
- `L1/core/src/p2p/mod.rs` — RFC 1918 private IP exemption
- `L1/core/src/state/mod.rs` — stored prev hash lookup
- `L1/core/src/storage/lmdb.rs` — get_block_hash_by_height()
- `docker/docker-compose.v3-testnet.yml` — nonce/TTL tuning

---

## Co zbývá k MainNetu

1. **Genesis block** — Definován, offline validace proběhla
2. **V3 TestNet stress test** — 1000+ peers, prolonged run
3. **Pool stability** — 100+ simultánních minerů na V3 stack
4. **Cargo version bump** — 2.9.6 → finální release verze
5. **Interní audit** — uzavření AUDIT sekcí A–I
