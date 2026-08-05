# V31 Post-Cutover Execution Plan — Reconciled

> **Vytvořeno:** 2026-08-04  
> **Autor:** Devin  
> **Verze:** 1.0  
> **Status:** kanonický root plán pro dokončení V31 / 3.1.0 Mainnet Alpha  
> **Zdroje:** [`PLAN_TO_3.1.md`](./PLAN_TO_3.1.md), [`V31_V3_FULL_AUDIT.md`](./V31_V3_FULL_AUDIT.md), [`V31/STATUS.md`](./V31/STATUS.md), [`V31/CUTOVER_PLAN.md`](./V31/CUTOVER_PLAN.md), [`V31/AGENTS.md`](./V31/AGENTS.md), [`StatusV3.md`](./StatusV3.md)

---

## 1. Executive Summary

**Cutover je hotový.** V31 běží na Edge jako produkční mainnet track (`3.1.0-alpha.2`):
- public RPC `rpc.zionterranova.com:8443` -> `127.0.0.1:9445` (V31)
- pool stratum `62.171.141.136:8444` (V31)
- `zion-miner` těží a submituje share ~800k H/s
- `zion-multichain` `/health` 200 OK
- 2069 testů pass, `cargo clippy --workspace` čisté
|- GPU backend port (CUDA/OpenCL/Metal/native) kompiluje v `zion-miner`
|- DAO governance moduly portovány (treasury, humanitarian, db, l1_scanner, executor, consent, co_admin, cross_layer, metrics, prizes)

**ALE:** `V31_V3_FULL_AUDIT.md` (2026-08-04) ukazuje, že V31 je stále **alpha-grade**. `PLAN_TO_3.1.md` tvrdí, že mnoho komponent je "complete", ale audit odhaluje, že "complete" znamená *zkopírované knihovní moduly*, nikoli *produkční funkcionalitu* v binárkách. Tento dokument sjednocuje oba zdroje a definuje reálný plán hardeningu.

**Tento soubor je nový kanonický plán.** Všechny operace směřují podle něj, dokud není explicitně nahrazen.

---

## 2. Základní pravidla (z `AGENTS.md` a `V31/AGENTS.md`)

1. Aktivní mainnet track je **`V31/`**. `V3/` je archivován v `archive/V3/` — read-only reference.
2. Změny děláme v `V31/` (případně `ZION_OS/`, `edge-deploy/`, `scripts/` pokud jde o deploy/ops).
3. Žádný destructive rollback, purge nebo restart chainu bez explicitního schválení.
4. Každý krok musí projít `cargo test --workspace` v `V31/` a preferovaně i `cargo clippy --workspace --all-targets`.
5. Před nasazením na Edge vždy backup DB (`sqlite3 .backup`) a ověřit `PRAGMA integrity_check`.
6. Secrets nesmí do gitu — používat `/etc/zion/V31/*.env` a `EnvironmentFile=` v systemd.

---

## 3. Nesrovnalosti mezi `PLAN_TO_3.1.md` a `V31_V3_FULL_AUDIT.md`

| # | Oblast | Co říká `PLAN_TO_3.1.md` | Co říká `V31_V3_FULL_AUDIT.md` | Reálný stav / rozhodnutí |
|---|--------|---------------------------|--------------------------------|---------------------------|
| 1 | **Miner binary** | B.3 COMPLETE — 59 testů, miner feature parity | Miner binary je 312-řádkový CPU-only stub, žádné GPU, triple-stream, TUI, profit switching | **Knihovní moduly** (`auxpow/client.rs`, `hasher.rs`, `dual_stratum.rs`, ...) jsou portovány. **Binárka `zion-miner.rs`** je CPU-only stratum klient. GPU backendy (`gpu-opencl`, `gpu-cuda`, `gpu-metal`) jsou prázdné feature flags. |
| 2 | **Pool** | B.2 COMPLETE — 79 testů, pool feature parity | Pool API server se nespouští, PPLNS je share-count (ne difficulty-weighted), chybí fee split, payout execution, auth, env var config | `zion-pool` binary běží a forwarduje share (produkční stratum 8444). PPLNS má `v3_pplns.rs` portován, ale binárka ho zatím nekonfiguruje. Chybí API server, fee split, metrics, env config. |
| 3 | **DAO** | C1.4 `gen-dao-guardians` ported; D3.4 multichain `/health` OK | `zion-dao` je skeleton — žádné voting, treasury, humanitarian, L1 scanner, HTTP API | `zion-dao` C1 **COMPLETE**: všechny V3 moduly, runtime napojený na `DaoDb` (načítá i persistuje), L1 scanner předává hlasy runtimeu v reálném čase přes `Arc<TokioMutex<GovernanceRuntime>>`. |
| 4 | **DEX / ZionDex** | Multichain `/v1/swap/pools` OK, WARP HTLC smoke pass | DEX je basic AMM router, chybí intent-based settlement, solver network, TypeScript SDK, Solidity contracts | `zion-multichain::swap::dex` má constant-product AMM. ZionDex backend není portován. |
| 5 | **Profit oracle** | AutonomousProfitRouter unit testy pass | Profit oracle má fallback, chybí NiceHash + WhatToMine live integrace | `autonomous.rs` a `stream_profit.rs` jsou v workspace, ale live data nejsou zapojená v binárce. |
| 6 | **Desktop Agent** | Není zmíněn v plánu | Neexistuje V31 Desktop Agent — bundle pouze V3 | Skutečně neexistuje. Nutné rozhodnout, zda je 3.1.0 blocker. |
| 7 | **CLI** | `zion` CLI má wallet/bridge/swap/api příkazy | Chybí wallet file management, transaction sending, service lifecycle | `zion-cli` implementuje `wallet create|load|send` a `service start|stop|status|restart|logs`. |
| 8 | **Dashboard** | V31 node card integrated | Hardcoded RPC porty, chybí V31 miner monitoring, pool metrics | Dashboard má živé pool/miner/multichain/DAO metriky, porty z `nodes.json` a systemd jednotky z `services.json`. C8 COMPLETE. |
| 9 | **Bridge** | `v3_bridge.rs` ported, bridge unlock multisig | `submitBridgeUnlock` je stub v nativním V31 RPC | V3 compat layer existuje, ale nativní V31 RPC volá `submitBridgeUnlock` jako stub. |
| 10 | **P2P / Mempool** | P2P hardening done (PeerManager, bans, discovery, IBD) | Nativní P2P/mempool jsou alpha-grade (JSON, žádný scoring, minimal mempool) | V3-compatible P2P funguje, nativní P2P potřebuje dotáhnout. |
| 11 | **Repo / Security** | A1.1-A2.4 PASS, D4.5 public subtree pending, A3.x deferred | N/A (audit je code-only) | A1.4 key rotation, A1.5 `git secrets`, A3.2-A3.6 purification a D4.5 public subtree zůstávají otevřené. |

**Závěr z nesrovnalostí:** `PLAN_TO_3.1.md` je příliš optimistický ohledně produkční připravenosti. Musíme rozlišit mezi *knihovna portována* a *binárka produkční*. Tento plán opravuje prioritu.

---

## 4. Prioritní seznam otevřených mezer

### 4.1 CRITICAL (blokují 3.1.0 Mainnet Alpha)

| ID | Mezera | Zdroj | Proč je kritická | Odhad |
|----|--------|-------|------------------|-------|
| C1 | `zion-miner` je CPU-only stub bez GPU/OpenCL/CUDA/Metal | audit §3, vlastní kontrola `V31/L1/miner/src/bin/zion-miner.rs` | SMOS / desktop / veřejní mineři nemohou těžit ZION; existující V31 pool by ztratil hashrate po odstavení V3 poolu | 2-3 týdny |
| C2 | Pool fee split (humanitarian 5%, issobella 5%, pool 1%) chybí v binárce | audit §2 | Protokol ZION vyžaduje 89/5/5/1 split; bez toho jsou payouty nesprávné | 2-4 dny |
| C3 | Pool payout execution (sweep thread, wallet) chybí | audit §2 | Mineři nedostávají výplaty | 2-4 dny |
| C4 | `submitBridgeUnlock` je stub v nativním V31 RPC | audit §1 | Bridge nefunguje end-to-end | 2-3 dny |
| C5 | API auth pro pool / multichain chybí | audit §2, AGENTS.md | Veřejný pool API bez autentizace = DoS / zneužití | 1-2 dny |
| C6 | Desktop Agent neexistuje pro V31 | audit §6 | Uživatelé nemají GUI; V3 agent bundle V3 binárky | 2-3 týdny |

### 4.2 HIGH (zpomalují adopci / zvyšují riziko)

| ID | Mezera | Zdroj | Dopad | Odhad |
|----|--------|-------|-------|-------|
| H1 | PPLNS share-count místo difficulty-weighted | audit §2 | Nevyvážené payouty při různých difficulty | 3-5 dní |
| H2 | Pool API server nespuštěný (žádný HTTP API) | audit §2 | Dashboard / explorer nemá pool data | 1-2 dny |
| H3 | Profit switching / live oracle není aktivní v binárce | audit §3, §4 | Miner nevybírá nejvýnosnější coiny | 3-5 dní |
| H4 | DAO governance runtime chybí | audit §4 | Žádné hlasování, treasury, humanitarian | 1-2 týdny |
| H5 | ZionDex není portován do multichain | audit §4 | Chybí pokročilé DEX funkce | 1-2 týdny |
| H6 | CLI chybí wallet file management a tx sending | audit §7 | Uživatelé nemohou posílat TX z CLI | 3-5 dní |
| H7 | Dashboard hardcoded porty a chybí miner/pool metriky | audit §8 | Operátoři nemají správný monitoring | 2-3 dny |

### 4.3 MEDIUM / LOW (kvalita a dlouhodobá stabilita)

- Nativní P2P scoring, subnet diversity, banning.
- Nativní mempool fee-rate eviction, size limity.
- VarDiff / set_difficulty ve stratum.
- Template cache s TTL.
- Notifications (Telegram/SMTP).
- WebSocket broadcast.
- Undo blocks pro reorg safety.
- Non-EVM WARP kontrakty (Tron, Solana, Cosmos...).
- Repo purification (`L1/`, `L2/`, `L3/`, filozofie, research, public subtree sync).

---

## 5. Fáze A-D — Post-cutover hardening

### Fáze A — Critical Fix & Production Safety (0-5 dní)

**Cíl:** V31 pool a node jsou finančně a bezpečnostně bezpečné pro veřejný provoz.

| # | Úkol | Soubor / crate | Acceptance | Poznámka | Status |
|---|------|----------------|------------|----------|--------|
| A1 | Přidat pool fee split 89/5/5/1 | `V31/L1/pool/src/pplns.rs`, `pool.rs` | Test s mock chain: payout se rozdělí miner 89%, humanitarian 5%, issobella 5%, burn 1% | Použít V3 `emission.rs` konstanty. Adresy z `genesis.rs` / env. | DONE |
| A2 | Přidat payout sweep thread + wallet | `V31/L1/pool/src/main.rs`, `pool.rs` | Periodicky (např. každých 30s) se sestaví a odešle payout TX; `submit` prochází | Vzor z V3 `pool/src/lib.rs` payout thread. | DONE |
| A3 | Wire `submitBridgeUnlock` v RPC | `V31/L1/core/src/v3_rpc.rs` nebo `rpc.rs` | RPC `submitBridgeUnlock` volá `v3_bridge::verify_bridge_proofs()` a vrací tx id | Ověřit s multichain smoke testem. | DONE |
| A4 | Přidat API auth do pool | `V31/L1/pool/src/api.rs` | Endpointy `/admin/*` vyžadují `ZION_POOL_API_ADMIN_KEY`; `/api/*` `ZION_POOL_API_KEY` | Token bucket rate limit již existuje. | DONE |
| A5 | Přepnout pool PPLNS na `v3_pplns.rs` (difficulty-weighted) | `V31/L1/pool/src/pool.rs` | Payout je difficulty-weighted, 500k window, testy pass | `v3_pplns.rs` je už portován. | DONE |
| A6 | Podpora env var config v pool | `V31/L1/pool/src/main.rs` | `zion-pool` načítá `ZION_POOL_*` proměnné místo pouze CLI args | Vzor z V3 `edge-deploy/config/edge-environment.sh`. | DONE |
| A7 | Enable 4 feature-gated binaries | `V31/L1/core/Cargo.toml` | `wallet`, `core-util`, `fund-bridge-vault`, `burn-funds`, `migrate-escrow`, `canonical-operator-env` buildují | Dle `V31/STATUS.md` C1. | DONE |
| A8 | Dokončit A1.4 + A1.5 bezpečnostních akcí | `AGENTS.md`, Ankr dashboard | Air-gapped key rotation hotovo; ANKR key rotated; `git secrets --scan` clean | Vyžaduje vlastníka. |
| A9 | Public subtree sync D4.5 | `public/` | `git subtree push --prefix=public public main --dry-run` clean, pak push | Nespěchá, ale patří do 3.1.0 readiness. |

**Fáze A Go/No-Go:**
- [x] Pool správně rozděluje 89/5/5/1 a odesílá payouty.
- [x] `submitBridgeUnlock` není stub.
- [x] Pool API má auth a rate limit.
- [x] `cargo test --workspace` pass.

---

### Fáze B — Miner Full Parity (1-3 týdny)

**Cíl:** `zion-miner` má plnou produkční funkčnost (GPU, triple-stream, profit switching, TUI).

| # | Úkol | Soubor / crate | Acceptance | Poznámka | Status |
|---|------|----------------|------------|----------|--------|
| B1 | Přidat GPU deps do miner Cargo.toml | `V31/L1/miner/Cargo.toml` | `ocl`, `cudarc`, `metal` pod feature flags `gpu-opencl`, `gpu-cuda`, `gpu-metal`; build pass | GPU csrc soubory již existují. | DONE |
| B2 | Nahradit stub `gpu_miner.rs` | `V31/L1/miner/src/auxpow/gpu_miner.rs` | ZION Deeksha běží na OpenCL/CUDA/Metal, CPU/GPU match testy pass | Port z `archive/V3/L1/miner/src/gpu_backend.rs` + `AuXpow/`. | DONE |
| B3 | Přepsat `zion-miner.rs` na triple-stream | `V31/L1/miner/src/bin/zion-miner.rs` | Stream 1 ZION, Stream 2 GPU AuxPoW, Stream 3 CPU AuxPoW souběžně; TUI zobrazuje per-stream hashrate/shares | Využít `MinerConfig` a `MinerRuntime` z `runtime.rs`/`stream.rs`. | DONE |
| B4 | Připojit `parallel.rs` | `V31/L1/miner/src/parallel.rs` | Feature `zion_auxpow` (nebo jiný crate) není cyklická závislost; triple stream test pass | Dle `V31/STATUS.md` 1. otevřená položka. | DONE |
| B5 | Aktivovat profit switching | `V31/L1/miner/src/autonomous.rs`, `stream_profit.rs` | Miner volá `select_stream2`/`select_stream3` každých 5 min, přepíná při 15% hysteresis | Live data zatím mohou být fallback / stub. | DONE |
| B6 | Přidat miner metrics / TUI | `V31/L1/miner/src/` | Prometheus endpoint nebo TUI log zobrazuje hashrate, accepted/rejected shares, active coin | TUI z V3 lze portovat postupně. | DONE |

**Fáze B Go/No-Go:**
- [ ] `zion-miner --features gpu-opencl` těží ZION na GPU s >90% accept rate.
- [ ] Triple stream běží na referenčním rigu (AMD Vega / GTX 1070 Ti).
- [ ] Profit switching vybírá coiny a netřese se (< 1 switch / 5 min mimo velký pohyb).

---

### Fáze C — L2 / Multichain / Operations (2-4 týdny)

**Cíl:** Bridge, DAO, DEX, CLI a dashboard jsou plně funkční.

| # | Úkol | Soubor / crate | Acceptance | Poznámka | Status |
|---|------|----------------|------------|----------|--------|
| C1 | Port DAO governance runtime | `V31/L2/dao/src/` | Proposal submit, vote, quorum, treasury, humanitarian kategorie, L1 scanner, HTTP API | Port z `archive/V3/L2/dao/`. | IN PROGRESS |
| C2 | Port ZionDex do multichain | `V31/L2/multichain/src/swap/dex.rs` | Intent + solver + AMM aggregator; smoke test quote + execute | Vzor `archive/ZionDex/`. |
| C3 | Přidat HTLC endpoints | `V31/L2/multichain/src/server.rs` | `/v1/multichain/swaps/htlc/lock`, `/claim`, `/refund` fungují | Již existují moduly v multichain. | DONE |
| C4 | Přidat live profit oracle | `V31/L1/cosmic-harmony/src/stream_profit.rs` | WhatToMine + NiceHash fetch s fallbackem, cache, rate limit | Opatrně s API klíči (1Password). | DONE |
| C5 | Bridge validator consensus | `V31/L2/multichain/src/bridge/` | 5/7 quorum logika, threshold signing | V3 bridge má 5/5, navrh 5/7. | DONE |
| C6 | CLI wallet file + tx sending | `V31/cli/src/commands/wallet.rs` | `zion wallet create|load|send` ukládá/načítá wallet file a posílá TX | Bezpečné zpracování seedu. | DONE |
| C7 | CLI service lifecycle | `V31/cli/src/commands/` | `zion node start|stop|status`, `zion pool start|stop`, `zion miner start|stop` | Volá `systemctl` nebo nástavec. | DONE |
| C8 | Dashboard V31 env + metriky | `ZION_OS/dashboard/app.py`, `v31.py` | Pool/miner/multichain/DAO metriky živě, porty z `nodes.json`, služby z `services.json` | DONE |

**Fáze C Go/No-Go:**
- [ ] Bridge E2E round-trip 100K wZION funguje.
- [ ] DAO proposal vote + execute prochází.
- [ ] CLI umí poslat TX a spravovat wallet.
- [ ] Dashboard zobrazuje všechny V31 služby a metriky.

---

### Fáze D — 3.1.0 Mainnet Alpha Launch (4-8 týdnů)

**Cíl:** Splnit Go/No-Go pro `v3.1.0 Mainnet Alpha` a public launch.

| # | Úkol | Acceptance | Poznámka |
|---|------|------------|----------|
| D1 | 30 dní continuous run na Edge | 99.9% uptime pool, 0 block orphanů, 0 kritických incidentů | Start až po Fázi A, ideálně po B. |
| D2 | Full regression test suite | `cargo test --workspace` pass, E2E smoke pass | Včetně miner/pool/bridge smoke. |
| D3 | Security + chaos testy | 24h fuzzing, 1000+ miner simulace, bridge reconnect stress, pool reconnect storm | Vzor `docs/3.0.9/SECURITY_AUDIT_REPORT.md`. |
| D4 | GitHub `v3.1.0-beta` release | Linux, Windows, macOS binárky + `SHA256SUMS` | Cross-compilace dle `AGENTS.md`. |
| D5 | Vytvořit V31 Desktop Agent | Electron app bundle V31 binárky, funguje na macOS/Windows/Linux | Volitelně může být deferred za 3.1.0, ale pro public launch je téměř nutný. |
| D6 | Public docs + beta announcement | `public/README.md` reflektuje 3.1.0, blog/Discord/Telegram, bug bounty kanál | Public subtree sync D4.5 musí být hotov. |
| D7 | Repo purification | Legacy `L1/2/3/`, filosofie, research pryč z mainu; `public/` subtree clean | Tag `pre-purification-3.0.9` existuje, může pokračovat. |

**Fáze D Go/No-Go (3.1.0 Mainnet Alpha):**
- [ ] 30d continuous run bez kritického incidentu.
- [ ] Všechny crate testy pass, všechny E2E smoke testy pass.
- [ ] GitHub release publikován s binárkami a SHA256.
- [ ] Monitoring a alerting aktivní.
- [ ] Backup/DR otestován.
- [ ] Public docs a komunitní kanály ready.

---

## 6. Prioritní pořadí exekuce (upravené)

```
Den 1-2:   [A1] Pool fee split            — rychlá, finančně kritická
           [A2] Payout sweep              — rychlá, finančně kritická
           [A3] submitBridgeUnlock wire   — bridge E2E
           [A4] Pool API auth             — bezpečnost
Den 3-5:   [A5] v3_pplns activation       — férové payouty
           [A6] Pool env config           — ops
           [A7] Feature-gated binaries    — tooling
           [A8-A9] Security + public sync — vlastník / Devin
Týden 2-4: [B1-B4] GPU miner              — hashrate / adoption
           [B5] Profit switching
           [B6] Miner metrics/TUI
Týden 4-6: [C1-C5] L2 multichain          — DAO, DEX, bridge, HTLC
           [C6-C7] CLI wallet/tx/lifecycle
Týden 6-8: [C8] Dashboard                — monitoring
           [D1-D7] 30d run, release, docs, purification
```

---

## 7. Rizika a mitigace

| Riziko | Mitigace |
|--------|----------|
| Miner GPU port trvá déle než 3 týdny | Nejdřív A1-A4 pro stabilní pool; V3 pool může zůstat jako fallback port 8444 alias dokud V31 miner není plný |
| Payouty se rozbijí PPLNS state | Před A2 udělat `sqlite3 .backup`, otestovat na debug pool, nové PPLNS okno po resetu |
| `submitBridgeUnlock` zveřejní chybu | Testovat na private testnet / local fork, ne na mainnetu Base |
| Public subtree push prozradí tajnosti | `git subtree push --dry-run` + ruční audit IP/klíčů před push |
| 30d run nelze začít bez funkčního mineru | Začít 30d run až po Fázi B, mezitím shadow run poolu/node |
| Desktop Agent oddálí launch | Rozhodnout: 3.1.0 bez desktop agenta (CLI + web) nebo deferred do 3.1.x |

---

## 8. Co je hotovo a co nebudeme řešit

### Hotovo / nemusíme řešit
- V31 node syncuje V3 mainnet P2P (height 11270+, sync_lag 0).
- V31 pool stratum běží na 8444 a akceptuje share.
- V31 multichain `/health` a základní WARP bridge fungují.
- V3 core modules 12/12 portovány, 2069 testů pass.
- V3 archivováno (`archive/V3/`, `archive/AuXpow/`, `archive/ZionDex/`).

### Odsunuto / explicitně vynecháno z 3.1.0
- **Pearl (PRL) PoUW** — oficiálně deferred do post-3.1.0 dle `StatusV3.md`.
- **CHv4.2 Merkabah Dual-Spin** — fork height `u64::MAX`, čeká na governance.
- **Non-EVM WARP kontrakty** — Phase C volitelné, post-Alpha.

---

## 9. Definice "Done" pro 3.1.0 Mainnet Alpha

1. V31 pool produkuje validní bloky, payouty fungují se správným fee split, API je auth + rate limit.
2. V31 miner těží ZION Deeksha na OpenCL (a preferovaně CUDA/Metal) s accept rate > 95%.
3. Bridge E2E round-trip (lock/mint/burn/release) prochází na Base Mainnet.
4. DAO umí proposal, vote a execute bez lidské intervence.
5. CLI umí wallet, send TX a service lifecycle.
6. 30d continuous run na Edge bez kritického incidentu.
7. GitHub `v3.1.0-beta` release s multi-platform binárkami a SHA256.
8. Public subtree sync clean, public docs ready, komunitní kanály otevřené.

---

## 10. Odkazy

- Zdroje: [`PLAN_TO_3.1.md`](./PLAN_TO_3.1.md), [`V31_V3_FULL_AUDIT.md`](./V31_V3_FULL_AUDIT.md), [`V31/STATUS.md`](./V31/STATUS.md)
- Pravidla: [`AGENTS.md`](./AGENTS.md), [`V31/AGENTS.md`](./V31/AGENTS.md)
- Status: [`StatusV3.md`](./StatusV3.md)
- Cutover: [`V31/CUTOVER_PLAN.md`](./V31/CUTOVER_PLAN.md)

---

*Generated with [Devin](https://devin.ai) — 2026-08-04*
