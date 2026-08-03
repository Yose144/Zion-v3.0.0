# Plán do 3.1.0 Mainnet Alpha — paralelní 3.0.9 + V31 critical gaps

> **Vytvořeno:** 2026-08-03
> **Autor:** Devin + Yose
> **Strategie:** 3.0.9 hardening probíhá na V3 produkční větvi **paralelně** s V31 critical gap closure. V31 se stává production-ready tím, že se do ní portují chybějící kritické komponenty z V3. Cutover až když V31 = feature parity s V3.
>
> **Základní pravidlo:** V3 zůstává produkční do okamžiku cutover. V31 je staging target. Žádný destructive rollback bez explicitního schválení.

---

## Současný stav (2026-08-03, updated)

| Track | Verze | Status |
|-------|-------|--------|
| **V3 produkce** | 3.0.7 "Trinity All Green" | ✅ Live na Edge, height 7342+, 24 coinů, GPU kernely |
| **V31 alpha.2** | 3.1.0-alpha.2 (post-Phase A+B) | 🟡 18 crateů, **1861 testů**, clippy clean — L1 ~60% V3 rozsahu |
| **3.0.8** | "Full Stack Stable" | 🟡 Kód hotov, čeká 7d run + live switching |
| **3.0.9** | "Pre-Alpha Hardening" | 🔵 Plánováno |
| **3.1.0** | "Mainnet Alpha" | 🔵 Plánováno |

### V31 critical gaps — progress (2026-08-03)

| # | Gap | V31 stav před | V31 stav po | Status |
|---|-----|---------------|-------------|--------|
| G1 | P2P sync s V3 mainnet | handshake incompatible | AnnounceTx + P2P infra portovány | ✅ |
| G2 | GPU/CUDA/OpenCL kernely | 0 csrc souborů | 158 csrc souborů portováno | ✅ |
| G3 | native-ffi (RandomX/Ghostrider/Verushash) | chybí úplně | 411 souborů, 11 MB portováno | ✅ |
| G4 | Pool (stratum, 24 coinů, share forwarding) | 1,343 řádků skeleton | 4,756 řádků (PPLNS+store+stratum_v1+revenue_proxy) | 🟡 |
| G5 | Operátorské binaries (gen-keys, wallet,…) | 2 binaries | 2 binaries | 🟡 |
| G6 | edge-deploy (systemd, nginx, fail2ban) | 4 skripty | 4 skripty | 🟡 |
| G7 | L1 core (chain.rs, IBD, full RPC, reorg) | 8,696 řádků | ~18,100 řádků (10/11 V3 core modules enabled) | 🟡 |

---

## Fáze A — 3.0.9 Hardening (na V3) + V31 G1-G3 (paralelně)

> **Cíl:** 3.0.9 Go/No-Go splněna + V31 má GPU mining, native FFI a P2P sync.
> **Trvání:** odhad 2-3 týdny

### A.1 — 3.0.9 Security hardening (V3)

| # | Úkol | Kde | Kritérium | Status |
|---|------|-----|-----------|--------|
| A1.1 | L1 consensus + account model audit | V3 | Interní report, všechny findings mitigovány | ⬜ |
| A1.2 | Transaction fuzzing 24h | V3 | 0 kritických crashů | ⬜ |
| A1.3 | Tailscale ACL nasazen | Edge | Nepovolené IP nemají přístup | ⬜ |
| A1.4 | Key rotation (premine, pool, bridge, EVM) | Edge | Air-gapped, nové adresy v AGENTS.md | ⬜ |
| A1.5 | `git secrets --scan` v CI | repo | Full clean | ⬜ |

### A.2 — 3.0.9 Chaos & load testing (V3)

| # | Úkol | Kde | Kritérium | Status |
|---|------|-----|-----------|--------|
| A2.1 | 1000+ miner simulace | Edge pool | Memory flat, CPU <80%, žádné paniky | ⬜ |
| A2.2 | Node restart + sync | Edge | Catch-up do 5 min | ⬜ |
| A2.3 | Bridge watcher 50x reconnect | Edge | Žádné ztracené eventy | ⬜ |
| A2.4 | Pool reconnect storm | Edge | Max 1 reconnect/min na IP | ⬜ |

### A.3 — 3.0.9 Repo purification

| # | Úkol | Akce | Status |
|---|------|------|--------|
| A3.1 | Tag `pre-purification-3.0.9` | `git tag` před jakýmikoliv mazáními | ⬜ |
| A3.2 | Legacy root trees → archive | `L1/`, `L2/`, `L3/` → `archive/legacy-code/` | ⬜ |
| A3.3 | Filozofie → `docs/philosophy/` | `docs/TerraNova/`, `docs/Zohar/`, `evoluZionV2.md` | ⬜ |
| A3.4 | Research → `research/` | `PoC-lab/`, `HiranV2.x/` | ⬜ |
| A3.5 | Duplicitní docs sloučit | `V3/docs/` + root reporty → `docs/3.0.x/` | ⬜ |
| A3.6 | Public subtree sync | `git subtree push --prefix=public public main` | ⬜ |

### A.4 — V31 G3: native-ffi port (paralelně)

> **Nejjednodušší port** — jen kopírování C kódu + build.rs.

| # | Úkol | Akce | Status |
|---|------|------|--------|
| A4.1 | ✅ DONE |
| A4.2 | ✅ DONE |
| A4.3 | ✅ DONE |
| A4.4 | ✅ DONE |
| A4.5 | ✅ DONE |

### A.5 — V31 G2: GPU kernely (csrc) port (paralelně)

| # | Úkol | Akce | Status |
|---|------|------|--------|
| A5.1 | ✅ DONE |
| A5.2 | ✅ DONE |
| A5.3 | ✅ DONE |
| A5.4 | ✅ DONE |
| A5.5 | ✅ DONE |
| A5.6 | ✅ DONE |

### A.6 — V31 G1: P2P sync s V3 mainnet (paralelně)

> **Nejkomplexnější port** — V3 wire protocol musí být kompatibilní.

| # | Úkol | Akce | Status |
|---|------|------|--------|
| A6.1 | ✅ DONE |
| A6.2 | ✅ DONE |
| A6.3 | ✅ DONE |
| A6.4 | ✅ DONE |
| A6.5 | ✅ DONE |

### A.7 — Fáze A Go/No-Go

- ✅ 3.0.9 security audit bez kritických nálezů
- ✅ 1000+ miner simulace stabilní
- ✅ Repo purification hotová (legacy trees v archive)
- ✅ V31 `native-ffi` build + test pass
- ✅ V31 GPU kernely build pass
- ✅ V31 P2P sync s V3 mainnet funguje (100+ bloků)
- ✅ Tag `v3.0.9` vytvořen

---

## Fáze B — V31 L1 core + pool completion

> **Cíl:** V31 L1 má feature parity s V3 L1 (core, miner, pool).
> **Trvání:** odhad 3-4 týdny

### B.1 — V31 G7: L1 core completion

| # | Úkol | Z V3 | Do V31 | Status |
|---|------|------|--------|--------|
| B1.1 | ChainState port — DEFERRED (needs V3 lib.rs ~3400 lines) | ⏳ |
| B1.2 | ✅ Ported as v3_validation.rs | ✅ |
| B1.3 | ✅ Ported as ibd.rs | ✅ |
| B1.4 | ✅ Ported as propagation.rs | ✅ |
| B1.5 | ✅ Ported as discovery.rs | ✅ |
| B1.6 | ⏳ websocket.rs — not yet ported | ⬜ |
| B1.7 | ✅ Ported as v3_wallet.rs | ✅ |
| B1.8 | ✅ Ported as v3_full_checkpoint.rs | ✅ |
| B1.9 | ✅ Ported as metrics.rs | ✅ |
| B1.10 | ✅ Ported as v3_mempool.rs | ✅ |
| B1.11 | Plný RPC (2822 řádků) | `V3/L1/core/src/rpc.rs` | rozšířit `V31/L1/core/src/rpc.rs` | ⬜ |
| B1.12 | Plný `bin/node.rs` (2122 řádků) | `V3/L1/core/src/bin/node.rs` | `V31/L1/core/src/bin/node.rs` | ⬜ |
| B1.13 | ✅ 286 tests pass (was 89) | ✅ |

### B.2 — V31 G4: Pool completion

| # | Úkol | Z V3 | Do V31 | Status |
|---|------|------|--------|--------|
| B2.1 | ✅ stratum_v1.rs ported | ✅ |
| B2.2 | Port share validator + forwarder | `V3/L1/pool/src/share_*.rs` | `V31/L1/pool/src/` | ⬜ |
| B2.3 | Port AuxPowBridge | `V3/L1/pool/src/auxpow_bridge*.rs` | `V31/L1/pool/src/` | ⬜ |
| B2.4 | ✅ v3_pplns.rs ported (1626 lines) | ✅ |
| B2.5 | Port pool API + dashboard integration | `V3/L1/pool/src/api*.rs` | `V31/L1/pool/src/` | ⬜ |
| B2.6 | ✅ 65 tests pass (was 21) | ✅ |

### B.3 — V31 Miner completion (AuxPoW merge)

| # | Úkol | Z AuXpow/V3 | Do V31 | Status |
|---|------|-------------|--------|--------|
| B3.1 | Port `auxpow_client.rs` (6808 řádků) | `AuXpow/src/` | `V31/L1/miner/src/auxpow/client.rs` | ⬜ |
| B3.2 | Port `external_hashers.rs` | `AuXpow/src/` | `V31/L1/miner/src/auxpow/` | ⬜ |
| B3.3 | Port `gpu_miner.rs` (OpenCL) | `AuXpow/src/` | `V31/L1/miner/src/auxpow/` | ⬜ |
| B3.4 | ✅ scheduler.rs already in V31 | ✅ |
| B3.5 | Port `dual_stratum.rs` | `AuXpow/src/` | `V31/L1/miner/src/auxpow/` | ⬜ |
| B3.6 | Port `parent_chains.rs` | `AuXpow/src/` | `V31/L1/miner/src/auxpow/` | ⬜ |
| B3.7 | Port `true_auxpow.rs` | `AuXpow/src/` | `V31/L1/miner/src/auxpow/` | ⬜ |
| B3.8 | Eliminate duplicate `ExternalCoin` | smazat z auxpow, použít cosmic-harmony | ⬜ |
| B3.9 | 🟡 Partial: b3_verify, reconnect, cpu_features, thread_affinity, gpu_guard ported. autonomous+parallel deferred | 🟡 |
| B3.10 | ✅ 13 tests pass (basic). Full feature test deferred | 🟡 |

### B.4 — Fáze B Go/No-Go

- ✅ V31 L1 core = feature parity s V3 (všechny moduly portovány)
- ✅ V31 pool = feature parity s V3 (stratum, 24 coinů, share forwarding)
- ✅ V31 miner = feature parity s V3 + AuXpow (GPU, native, 24 coinů)
- ✅ `cargo test --workspace` vše pass
- ✅ `cargo clippy --workspace --all-targets` 0 warnings
- ✅ E2E: V31 node syncne z V3 mainnet, pool přijme share od miner, block přijat

---

## Fáze C — V31 operátorský tooling + deploy

> **Cíl:** V31 má všechny binaries, deploy skripty a infra jako V3.
> **Trvání:** odhad 1-2 týdny

### C.1 — V31 G5: Operátorské binaries

| # | Úkol | Z V3 | Do V31 | Status |
|---|------|------|--------|--------|
| C1.1 | `gen-all-keys-mnemonic` | `V3/L1/core/src/bin/` | `V31/L1/core/src/bin/` | ⬜ |
| C1.2 | `gen-premine-wallets` | `V3/L1/core/src/bin/` | `V31/L1/core/src/bin/` | ⬜ |
| C1.3 | `gen-evm-validators` | `V3/L1/core/src/bin/` | `V31/L1/core/src/bin/` | ⬜ |
| C1.4 | `gen-dao-guardians` | `V3/L1/core/src/bin/` | `V31/L1/core/src/bin/` | ⬜ |
| C1.5 | `gen-pool-wallet` + `gen-pool-payout-wallet` | `V3/L1/core/src/bin/` | `V31/L1/core/src/bin/` | ⬜ |
| C1.6 | `gen-canonical-wallets` + `gen-tithe-wallets` | `V3/L1/core/src/bin/` | `V31/L1/core/src/bin/` | ⬜ |
| C1.7 | `wallet` binary | `V3/L1/core/src/bin/wallet.rs` | `V31/L1/core/src/bin/wallet.rs` | ⬜ |
| C1.8 | `fund-bridge-vault` + `burn-funds` | `V3/L1/core/src/bin/` | `V31/L1/core/src/bin/` | ⬜ |
| C1.9 | `get-genesis-hash` + `get-canonical-addresses` | `V3/L1/core/src/bin/` | `V31/L1/core/src/bin/` | ⬜ |
| C1.10 | `migrate-escrow` + `core-util` | `V3/L1/core/src/bin/` | `V31/L1/core/src/bin/` | ⬜ |
| C1.11 | `gen-admin-keys` + `gen-keys` | `V3/L1/core/src/bin/` | `V31/L1/core/src/bin/` | ⬜ |
| C1.12 | Všechny binaries build + run | — | `cargo build --bin *` pass | ⬜ |

### C.2 — V31 G6: edge-deploy infra

| # | Úkol | Akce | Status |
|---|------|------|--------|
| C2.1 | V31 systemd unit soubory | `zion-v31-node.service`, `zion-v31-pool.service`, `zion-v31-multichain.service`, … | ⬜ |
| C2.2 | V31 nginx config | RPC proxy, multichain API, dashboard | ⬜ |
| C2.3 | V31 fail2ban jail | Stejná pravidla jako V3 ale pro V31 porty | ⬜ |
| C2.4 | V31 edge-environment.sh template | Všechny env vars zdokumentovány | ⬜ |
| C2.5 | V31 deploy script | `edge-deploy/deploy-v31.sh` | ⬜ |
| C2.6 | V31 watchdog | `scripts/watchdog.sh` mode `v31` | ⬜ |

### C.3 — Fáze C Go/No-Go

- ✅ Všechny 18 binaries build + run
- ✅ edge-deploy infra hotová
- ✅ Shadow run V31 na Edge (izolované porty) 7d bez incidentu

---

## Fáze D — Cutover V3 → V31

> **Cíl:** V31 nahradí V3 na Edge. V3 archivováno.
> **Trvání:** 1-2 dny + 7d monitoring

### D.1 — Pre-cutover

| # | Úkol | Kritérium | Status |
|---|------|-----------|--------|
| D1.1 | Backup V3 stavu | SQLite DB, peers.json, pplns-state, revenue, OASIS JSONs | ⬜ |
| D1.2 | V31 shadow run na Edge | 7d na izolovaných portech, sync s V3 mainnet | ⬜ |
| D1.3 | V31 pool + miner E2E na Edge | Shares akceptovány, block submit | ⬜ |
| D1.4 | V31 multichain API test | Bridge, DEX, wallet endpointy funkční | ⬜ |
| D1.5 | `v3.1.0-beta` release | GitHub release s binárkami + SHA256SUMS | ⬜ |

### D.2 — Cutover (rolling blue/green)

| # | Úkol | Akce | Status |
|---|------|------|--------|
| D2.1 | Read-only switch | nginx RPC proxy → V31, web čte z V31 | ⬜ |
| D2.2 | Pool switch | stratum port 8444 → V31 pool | ⬜ |
| D2.3 | Full switch | Vypnout V3 služby, V31 na produkční porty | ⬜ |
| D2.4 | systemd enable V31 | `zion-v31-*` services, disable `zion-edge-*` | ⬜ |

### D.3 — Post-cutover

| # | Úkol | Kritérium | Status |
|---|------|-----------|--------|
| D3.1 | RPC `getStatus` | Height >= V3 height před cutover | ⬜ |
| D3.2 | Pool `mining.submit` | Shares akceptovány | ⬜ |
| D3.3 | Miner `zion miner start` | Block vytěžen a přijat | ⬜ |
| D3.4 | Multichain `/health` | 200 OK | ⬜ |
| D3.5 | 7d continuous run | 0 kritických incidentů | ⬜ |

### D.4 — Archivace V3

| # | Úkol | Akce | Status |
|---|------|------|--------|
| D4.1 | Tag `pre-v31-cutover` | `git tag` na posledním V3 commit | ⬜ |
| D4.2 | `V3/` → `archive/V3/` | `git mv V3/ archive/V3/` | ⬜ |
| D4.3 | `AuXpow/` → `archive/AuXpow/` | `git mv` (již merged do V31 miner) | ⬜ |
| D4.4 | `ZionDex/` → `archive/ZionDex/` | `git mv` (již merged do V31 multichain) | ⬜ |
| D4.5 | Public subtree sync | `git subtree push --prefix=public public main` | ⬜ |
| D4.6 | AGENTS.md + StatusV3.md update | Nové cesty, V31 canonical | ⬜ |

### D.5 — Fáze D Go/No-Go (3.1.0 Mainnet Alpha)

- ✅ V31 běží na Edge na produkčních portech
- ✅ 7d continuous run bez kritického incidentu
- ✅ V3 archivováno
- ✅ GitHub release `v3.1.0-beta` publikován
- ✅ Tag `v3.1.0` vytvořen

---

## Paralelní stopa — 3.0.8 dokončení

> 3.0.8 "Full Stack Stable" je předpoklad pro 3.0.9. Pokud ještě není splněno, dokončit souběžně s Fází A.

| # | Úkol | Kritérium | Status |
|---|------|-----------|--------|
| S1 | 7d uptime poolu | 0 restartů z paniky | 🟡 |
| S2 | Bridge reverse E2E | 100K wZION round-trip | ⬜ |
| S3 | DAO 3/5 live | Proposal submit + execute | ⬜ |
| S4 | Autonomous profit router 2h+ live run | Bez chyby, live coin switching | 🟡 |

---

## Prioritní pořadí exekuce

```
Týden 1-2:  [A.4] native-ffi port  ←  nejjednodušší, rychlá výhra
            [A.5] GPU csrc port     ←  paralelně
            [A.1] 3.0.9 security audit (V3)
            [S1-S4] 3.0.8 dokončení

Týden 2-3:  [A.6] P2P sync port     ←  nejkritičtější
            [A.2] 3.0.9 chaos testy (V3)
            [A.3] 3.0.9 repo purification

Týden 3-4:  [B.1] L1 core completion
            [B.3] Miner AuxPoW merge

Týden 4-6:  [B.2] Pool completion
            [C.1] Operátorské binaries

Týden 6-7:  [C.2] edge-deploy infra
            [D.1] Pre-cutover shadow run

Týden 7-8:  [D.2-D.3] Cutover + 7d monitoring
            [D.4] V3 archivace
            [D.5] 3.1.0 release
```

---

## Rizika a mitigace

| Riziko | Mitigace |
|--------|----------|
| P2P sync port trvá déle než čekáno | Začít hned v týdnu 1, paralelně s native-ffi |
| GPU kernely nezkompilují na macOS | Build testovat na macOS i Linux; CI matrix |
| Pool port rozbije PPLNS state | PPLNS state migrace z V3 backup; nové okno jako fallback |
| Cutover způsobí downtime minery | Rolling blue/green; V3 pool port zůstává jako alias |
| V3 repo purification rozbije CI | Tag před mazáním; `git subtree push --dry-run` |
| 30d continuous run nemůže začít před cutover | Shadow run na izolovaných portech jako pre-run |

---

*Generated with [Devin](https://devin.ai) — 2026-08-03*
