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
| **Chain height** | 40+ (aktivně roste, 100% accept rate) |
| **Accepted blocks** | 43+ |
| **Konsenzus** | `cosmic_harmony_ekam_deeksha_v2` |
| **Difficulty** | LWMA, 60-block window, ±25% clamp |
| **Block time target** | 60s |
| **Docker kontejnery** | 7 (core, seed1, seed2, pool, miner, redis, website) |
| **Compose file** | `docker/docker-compose.v3-testnet.yml` |
| **Mining config** | NONCE_COUNT=500K, JOB_TTL_MS=180s, LOOP_COUNT=4294967295 |
| **P2P chyby** | 0 (po fix `f2ca370`) |
| **Miner throughput** | ~4.4K H/s (CPU, 3.5 cores) |

### Opravy nasazené 19. 3. 2026

1. **Docker compose rewrite** — V3 binaries používají `from_env()` výhradně (CLI args ignorovány), env vars `ZION_*` pro všechny služby
2. **Raw TCP JSON-RPC health check** — `getChainInfo` přes `nc` na port 8332 (ne HTTP curl)
3. **Dockerfile update** — `netcat-openbsd` místo `curl`, EXPOSE 8332 (RPC port)
4. **State path fix** — `ZION_NODE_STATE_PATH` musí být soubor (`chain_state.json`), ne adresář
5. **Mining loop fix** — pool/miner `loop_count=4294967295` pro kontinuální běh (default=1!)
6. **Nonce/TTL tuning** — nonce 500K, TTL 180s (eliminace stale shares)
7. **P2P duplicate block fix** — duplicate check před `validate_peer_block()` (`f2ca370`) — eliminuje falešné difficulty mismatch chyby při re-announcement bloků ze seed nodů
8. **prev_hash lenient validation** — stored hash lookup + warn-only při algorithm mismatch
9. **P2P private IP exemption** — RFC 1918 bypass pro Docker seed nody
10. **Redis env fix** — `--env-file .env` injekce pro REDIS_PASSWORD

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

**HEAD:** `cdf39de` — V3 testnet stabilization: L1 fixes, miner tuning, docs update 19.3.2026

**Poslední commity:**
- `cdf39de` — V3 testnet stabilization: L1 fixes, miner tuning, docs update
- `f2ca370` — V3: fix P2P duplicate block re-announcement causing difficulty mismatch
- `98fa4b5` — V3: fix Docker compose for env-var config, health checks, mining params
- `c7823cd` — docker: add V3-specific Dockerfiles and testnet compose
- `6e4a056` — V3: wire Ekam v2 PoW through core/pool/miner (height-aware BlockCandidate)

---

## Co zbývá k MainNetu

1. **Genesis block** — Definován, offline validace proběhla
2. **V3 TestNet stress test** — 1000+ peers, prolonged run
3. **Pool stability** — 100+ simultánních minerů na V3 stack
4. **Cargo version bump** — 2.9.6 → finální release verze
5. **Interní audit** — uzavření AUDIT sekcí A–I
