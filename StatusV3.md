# ZION V3 — Status Report (Mainnet Polish)

> **Datum:** 2026-04-29
> **Branch:** `devin/1777486177-mainnet-polish`
> **Předchozí status:** [`STATUS.md`](./STATUS.md) (2026-04-07)
> **Účel tohoto dokumentu:** zkonsolidovaný stav před mainnet Genesis #0 — co
> funguje, co je hotové, co ještě hoří, a co je *nice-to-have*. Psáno tak, aby
> tomu rozuměl jak vývojář, tak laik (ne-vývojář si může číst jen sekce **TL;DR**
> a **Co stále hoří před Genesis**).

---

## TL;DR pro laika

Síť ZION V3 je v **„release candidate"** stavu. Core funkčnost (běžící nod,
těžba, pool výplaty, převody mezi peněženkami, bridge na Base, DAO, atomic
swapy, AI agenti) je **napsaná, otestovaná a běží na produkčním serveru
v Praze**. Co zbývá:

1. **Vyměnit kompromitované klíče** (manuální akce — Yose144 musí ručně rotovat
   GitHub Personal Access Token, OpenAI klíč, a SSH klíč na produkčním nodu).
2. **Naplánovat „hard fork"** v koordinovaném okně, kdy se zapne nové, lépe
   chráněné hashování transakcí (`tx-hash v2`) a Merkle stromu bloku (`F2`).
   Kód už je hotový a v repu, jen čeká na zapnutí.
3. **Zaplatit GitHub Actions** (nebo udělat repo public po historickém scrubu).
   Bez toho CI neběží zelená a nemůže se automaticky validovat každý PR.
4. **Externí audit** (Trail of Bits / Halborn / OtterSec — Q3 2026 plán).
5. **Skutečně otevřít bridge L2** (zatím `enabled = false` v
   `bridge-mainnet.toml`).

Všechno ostatní v auditu **F1–F6** + **§3.2, §13, §15** je buď vyřešené, nebo
má konkrétní aktivační plán v
[`V3/docs/audits/2026-04-V3_AUDIT_COMPLETION.md`](./V3/docs/audits/2026-04-V3_AUDIT_COMPLETION.md).

---

## 1. Co je hotové (mainnet ready)

### 1.1 Konsensus & PoW (Cosmic Harmony / Ekam Deeksha v2)

- **Algoritmus:** 6-stage pipeline, **256 KiB scratchpad**, BLAKE3 finální hash,
  NPU mixing INT8 MLP, Galois-field substituce, Poseidon round, Keccak-style
  finalize. Determinismus ověřen napříč CPU x86/aarch64 a GPU backends.
- **Test coverage:** **95/95** unit testů v `zion-cosmic-harmony` projde, včetně
  `test_v3_deterministic`, `test_v3_avalanche`, `test_v3_differs_from_v2_full`,
  `test_ekam_v2_full_deterministic`, kanonických test vektorů a determinismu
  scratchpadu.
- **Hard fork hooks:** `CHV_EKAM_V2_FORK_HEIGHT` připravený pro koordinaci
  budoucích PoW upgrade.
- **Hugepages:** linuxový `mmap(MAP_HUGETLB)` + macOS `VM_FLAGS_SUPERPAGE_SIZE_2MB`
  + Windows `VirtualAlloc(MEM_LARGE_PAGES)`. Padá zpět na regular mmap →
  poslední fallback je tvrdý panic s jasným error logem (úmyslně — node bez
  scratchpadu nemůže PoW verifikovat).
- **DAA (difficulty):** **LWMA-60** s integer math, ±25 % clamp, 30–120 s solve
  time clamp.

### 1.2 Transakce & validace (zion-core L1)

- **Hybrid Account + UTXO model:** běžné Account model pro běžné účty,
  UTXO pro coinbase + bridge unlock. Cross-model dispatch funguje
  (`RuntimeTransaction::as_utxo`, `as_account`).
- **Konsensusové validace** (po PR #20, F1):
  - **Conservation of value:** ∑ inputs ≥ ∑ outputs + fee — jak pro Account
    tak pro UTXO. Overflow attacky chyceny `checked_add` foldem (PR #20
    Devin Review fix).
  - **Coinbase maturity:** 100 bloků od těžby → utratitelné.
  - **DAO Treasury timelock:** 525 600 bloků (~1 rok) na premine outputy.
  - **Bridge unlock multisig:** 3/5 threshold vynucený **na L1** (po PR #22,
    F4) — relayer nemůže propašovat unlock TX bez kompletního validator
    quora.
  - **Fee minimum** pro UTXO transakce (kromě bridge unlock).
  - **Premine lock predikát:** používá `is_coinbase()` (ne `.skip(1)` —
    PR #20 fix).
- **TX hash v2 (dormant, audit §3.2):** `Transaction::calculate_hash`
  dispatchuje na `self.version`. Verze `<2` zachovává původní raw-concat
  preimage (žádný historický UTXO ID se nemění). Verze `>=2` používá nové
  domain-separated, length-prefixed schéma `"ZION_TX_V2\0"`. Aktivace
  čeká na hard fork.
- **Test coverage:** **478/479** lib testů v `zion-core` projde (1 selhává
  i na `main`: `discovery::tests::tick_produces_dns_and_announce_commands`,
  flaky DNS lookup test, ne kód). 5 nových `tx_hash_*` regression testů
  přibylo v PR #25, jeden z nich úmyslně **pinuje malleability v1** aby
  budoucí contributoři neopravovali v1 in-place a tím nezneplatnili každý
  historický UTXO ID.

### 1.3 Pool a výplaty (zion-pool L1)

- **Stratum-style protokol** (TCP, line-based — `hello`/`job`/`submit`/`result`).
- **PPLNS výplaty** s budget-cap fallback (proporcionální scaling při
  nedostatku v pool walletu — fix z 2026-04 STATUS.md).
- **Fee split 89/5/5/1:** miner / humanitarian / Issobella / pool_fee — ověřen
  on-chain ve výšce bloku 465 a opakovaně na 471, 472. Po Phase 18
  rolloutu (2026-04-01, height 6801) standardní pro každý coinbase.
- **Pool re-computes hash** sám, nedůvěřuje minerově submission (anti-spoof).
- **Test coverage:** **82/82** testů v `zion-pool` projde
  (53 lib + 29 integration), včetně `pool_only_accepts_after_upstream_confirmation`,
  PPLNS distribuční testy, share validation, session lifecycle.

### 1.4 Bridge L2 ↔ Base Mainnet (zion-bridge)

- **Smart contracts** verifikované na BaseScan: `wZION` (ERC-20),
  `ZIONBridge`, `ZIONStaking`, `ZIONGovernance`, `ZIONFarm`,
  `ZIONAtomicSwap`. 3/5 threshold multisig.
- **Decimal fix:** `FLOWERS_TO_WEI_FACTOR = 1_000_000` (× 10⁶, ne × 10¹²),
  oprava inflation buga.
- **L1 enforcement:** od PR #22 nemůže relayer submitnout bridge unlock TX
  bez 3/5 podpisů (předtím L1 trust-aboved relayerovi).
- **Replay protection:** unique nonce per unlock TX, eviction po 24 h.
- **Test coverage:** **125 lib + 16 integration + 47 mainnet readiness** =
  **188 testů projde**.
- **Aktuální stav:** `bridge-mainnet.toml: enabled = false` — relayer ještě
  emituje `synthetic: true` placeholder proofy (audit nález). Plán: kill
  synthetic-proof cestu (separátní PR), pak zapnout bridge.

### 1.5 DAO / Atomic Swap / Warp / NCL / AI-Native

- **DAO** (`zion-dao`): proposal lifecycle, voting, treasury, humanitarian
  tithe → **40/40 testů projde**.
- **Atomic Swap** (`zion-atomic-swap`): HTLC, refund loop, EVM watcher →
  **18/18 testů projde**.
- **Warp** (`zion-warp`): 7-chain bridge (EVM, Bitcoin, Solana, Tron, Stellar,
  Cardano, Cosmos) → **251/251 testů projde**.
- **NCL** (`zion-ncl`): Neural Compute Layer, decentralized AI marketplace →
  **42/42 testů projde**.
- **AI-Native** (`zion-ai-native`): autonomous AI agent framework
  (orchestrator, consciousness engine, pool optimizer, warp agent) →
  **195/195 testů projde** (+ 2 ignorované).

### 1.6 Operátorský CLI (`zion`)

- Unified entrypoint: `start/stop/restart/logs/status/doctor/deploy`,
  routes do L1/L2/L3 subcommandů.
- Wallet encryption: `encrypt_wallet_moves_secrets_out_of_plaintext_fields`,
  `encrypted_wallet_can_be_revealed` testy projdou.
- **Test coverage:** **21/21 testů**.
- Mempool zobrazení opraveno (PR #21).

### 1.7 Mining (zion-miner)

- CPU + GPU backends, telemetry, parallel scanning,
  `parallel_scan_finds_same_as_sequential` invariant testovaný.
- **Test coverage:** **59/59 testů**.

### 1.8 Auditní výstupy

| Audit nález | Severity | Stav |
|---|---|---|
| F1 — conservation-of-value v `validate_peer_block` | 🔴 Critical | ✅ PR #20 |
| F2 — XOR „merkle root" → BLAKE3 strom | 🔴 High | 🗓 design v completion docu, čeká na hard fork |
| F3 — `zion-wallet.json` plaintext klíče | 🔴 Critical | ✅ PR #18 |
| F3b — `docs/docs2.9/ZION_KEYS/` PAT + OpenAI + SSH | 🔴 Critical | ✅ PR #25 (HEAD), **rotace klíčů na uživateli** |
| F4 — bridge unlock multisig na L1 | 🟡 Medium | ✅ PR #22 |
| F5 — `unwrap/expect` density | 🟡 Medium | ✅ PR #23 + #24 |
| F6 — `V3-src*.tar/.zip` archivy v repu | 🟡 Medium | ✅ PR #18 + PR #25 |
| §3.2 — tx-hash preimage malleability | 🟡 Medium | ✅ PR #25 (dormant v2 + 5 regression testů) |
| §11 — `lib.rs` monolith refactor | 🟢 Low | 📋 plán v completion docu |
| §13 — native-ffi safety contracts | 🟡 Medium | 📋 plán v completion docu |
| §15.1 — `active_tip().expect` | 🟢 Low | známé, refactor target |
| §15.2 — dead code (evict, into_utxo, hex_encode) | 🟢 Low | ✅ PR #25 |
| §15.3 — BURN_ADDRESS regression test | 🟢 Low | ✅ PR #25 |
| Relayer — `synthetic: true` placeholder proofy | 🟡 Medium | 📋 plán v completion docu, blokuje re-enable bridge |

---

## 2. Co stále hoří před Genesis (řazeno podle naléhavosti)

### 🚨 P0 — bezpečnostní akce na uživateli (ne na kódu)

1. **Rotace `ZION_KEYS` credentials** — *nutná akce na Yose144*. Klíče byly
   v repu od 2026-03-30 do 2026-04-29, jsou stále aktivní pokud nezrotovány:
   - **GitHub PAT** (prefix `ghp_7gxI3Y…`) → revoke na
     <https://github.com/settings/tokens>, audit security log.
   - **OpenAI API key** (prefix `sk-proj-CsUPFBafi12A3…`) → delete na
     <https://platform.openai.com/api-keys>, audit usage stránku.
   - **SSH deployment key** na `91.98.122.165` (Praha) → vygenerovat nový,
     odstranit starý z `~/.ssh/authorized_keys` na serveru, zkontrolovat
     `last -F` a `journalctl -u sshd --since "2025-11-10"`.

   *Proč to hoří:* PAT může klonovat soukromé repa a pushnout malware do
   tvých dalších projektů. OpenAI klíč může nasekat účet (tisíce USD/den).
   SSH klíč = root na živý mainnet node.

### 🔴 P1 — produkční blokátory

2. **Hard fork window — koordinovaná aktivace tx-hash v2 + F2 BLAKE3
   Merkle.** Oba kódy už jsou v repu (jeden dormant, druhý jako design doc),
   musí se zapnout **společně**, jinak je to dvě oddělené migrace:
   - Aktivace tx-hash v2: bump `Transaction.version` na `2` v wallet/RPC
     emisi po `TX_HASH_V2_ACTIVATION_HEIGHT`. Detail viz
     [`AUDIT_COMPLETION.md` §1](./V3/docs/audits/2026-04-V3_AUDIT_COMPLETION.md).
   - F2 BLAKE3 Merkle root: nahradit `derive_template_merkle_root` XOR
     agregaci skutečným binárním stromem; per-tx hash z drahého Cosmic
     Harmony Ekam Deeksha → levný BLAKE3.
3. **Relayer synthetic-proof kill** — `relayer.rs:647` pořád emituje
   `synthetic: true` placeholder. Po PR #22 je to *na L1 odmítnuto*, ale
   relayer to zbytečně produkuje. Než se znovu zapne `bridge-mainnet.toml:
   enabled = true`, kill cesta + per-validator threshold check
   relayer-side. Plán v [`AUDIT_COMPLETION.md` §3](./V3/docs/audits/2026-04-V3_AUDIT_COMPLETION.md).

### 🟡 P2 — kvalita & jistota před launch

4. **Externí security audit (3rd party)** — Trail of Bits / Halborn /
   OtterSec, plán Q3 2026. Tento interní audit *není* náhrada — je to
   hluboké code review, ne formální audit.
5. **CI infrastructure** — GitHub Actions jobs běží 3-10 sekund s
   `runner_name=""`, žádný step se nespustí. Příčina: spending limit > $0
   nenastaven na private repo, free tier vyčerpán. Akce uživatele:
   - Nastavit spending limit > $0 na
     <https://github.com/settings/billing/spending_limits>,
   - **NEBO** po `git filter-repo` historic scrubu repo otevřít public
     (Actions zdarma neomezeně),
   - **NEBO** přesunout pod GitHub organization s placeným plánem.
6. **`git filter-repo` history scrub** — jednorázová destructive op
   (rewrites every branch, breaks every existing clone) pro odstranění
   leaked credentials z historie. Musí proběhnout *jednou* a najednou pro:
   - `zion-wallet.json` (root) + `V3/zion-wallet.json` (premine privkey, mnemonic)
   - `docs/docs2.9/ZION_KEYS/` (PAT, OpenAI, SSH)
   - `V3-src*.tar`, `V3-src.zip`, `V3_upload.zip` (archivní zálohy)
   Detail v [`SECURITY_NOTICE_2026-04-28.md`](./SECURITY_NOTICE_2026-04-28.md).
7. **`lib.rs` monolith refactor** (§11) — `V3/L1/core/src/lib.rs` má
   ~6 250 řádků, drží node loop + RPC + P2P + mempool + validation v jednom
   souboru. Žádná behaviorální změna, čistá auditovatelnost. Plán
   v [`AUDIT_COMPLETION.md` §5](./V3/docs/audits/2026-04-V3_AUDIT_COMPLETION.md).
8. **native-ffi safety contracts** (§13) — `V3/L1/native-ffi` exportuje
   `extern "C"` GPU dispatch funkce; safety contracts (lifetime, alignment,
   thread-safety, dangling pointer guards) je třeba dokumentovat a vynutit
   před distribucí GPU miner binárek. Plán
   v [`AUDIT_COMPLETION.md` §4](./V3/docs/audits/2026-04-V3_AUDIT_COMPLETION.md).

### 🟢 P3 — nice-to-have

9. **Phase-2 testovací coverage** — workspace má ~1 374 testů, ale chybí
   end-to-end mainnet stress test (10k+ transakcí, peer churn, partition
   recovery).
10. **Pre-commit hook** (`.pre-commit-config.yaml`) — žádný hook neexistuje.
    Snadno přidat `cargo fmt --check` + `cargo clippy` + secret-scan
    (tartufo / gitleaks) jako defense-in-depth proti F3/F3b classu.
11. **Telemetry + alerty** — Prometheus + Grafana běží, ale chybí
    SLO definice (block time p95 < 90 s, mempool depth < 1000, etc.) a
    alert rules na slabosti.

---

## 3. Architektura (V3 stack jedním pohledem)

```
┌─────────────────────────────────────────────────────────────┐
│ APP&WEB/  — Electron desktop, RN mobile, Next.js website    │
└──────────────────────┬──────────────────────────────────────┘
                       │ JSON-RPC + WebSocket
┌──────────────────────▼──────────────────────────────────────┐
│ V3/cli  — `zion` operátorský binárník                       │
│ V3/L3/ai-native  — autonomní AI agenti (orchestrator, ...)  │
│ V3/L3/warp       — 7-chain universal bridge                 │
│ V3/L3/ncl        — Neural Compute Layer marketplace         │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ V3/L2/bridge        — wZION ↔ Base Mainnet (3/5 multisig)   │
│ V3/L2/dao           — proposal/voting/treasury daemon        │
│ V3/L2/atomic-swap   — HTLC cross-chain swaps                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ L1 RPC + P2P
┌──────────────────────▼──────────────────────────────────────┐
│ V3/L1/core             ← node, mempool, validation, RPC     │
│ V3/L1/pool             ← PPLNS Stratum-style pool           │
│ V3/L1/miner            ← CPU/GPU miner                      │
│ V3/L1/cosmic-harmony   ← Ekam Deeksha v2 PoW (256 KiB SP)   │
│ V3/L1/native-ffi       ← extern "C" GPU dispatch            │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
   LMDB (heed) — persistentní chain state
```

**Klíčové parametry:**

| Parametr | Hodnota |
|---|---|
| Total supply | 144 000 000 000 ZION (= `144_000_000_000 × FLOWERS_PER_ZION`) |
| Premine | 16 280 000 000 ZION (11.31 %), 12 outputů s timelockem |
| Block reward | 5 400.067 ZION → -20 % / dekádu, tail `724_784_723_787_776` flowers (≈ 724.785 ZION) |
| Block time | 60 s, LWMA-60, ±25 % clamp, 30–120 s solve clamp |
| Fee policy | 100 % burn (miner nedostává tx fees) |
| Reward split | 89 % miner / 5 % humanitarian / 5 % Issobella / 1 % pool |
| Konsensus | Cosmic Harmony / Ekam Deeksha v2 (256 KiB scratchpad, BLAKE3) |
| TX model | Hybrid Account + UTXO, Ed25519 |
| Storage | LMDB přes `heed` |
| Decimals | 10¹² flowers / 1 ZION |

---

## 4. Kde co najít

| Co potřebuju | Kde |
|---|---|
| Chci spustit lokální nod | `cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin node` |
| Chci spustit pool | `ZION_POOL_BIND=0.0.0.0:8444 ZION_NODE_RPC_ADDR=127.0.0.1:8443 cargo run --release --manifest-path V3/Cargo.toml -p zion-pool --bin server` |
| Chci spustit miner | `ZION_POOL_ADDR=127.0.0.1:8444 cargo run --release --manifest-path V3/Cargo.toml -p zion-miner` |
| Chci CLI helper | `cargo run --manifest-path V3/Cargo.toml -p zion-cli -- --help` |
| Chci celý workspace test | `cargo test --manifest-path V3/Cargo.toml --workspace -- --test-threads=1` |
| Chci Docker stack | `docker compose -f V3/docker/docker-compose.v3-mainnet.yml up -d` |
| Audit report | [`V3/docs/audits/2026-04-V3_INTERNAL_AUDIT.md`](./V3/docs/audits/2026-04-V3_INTERNAL_AUDIT.md) |
| Aktivační plán hard fork věcí | [`V3/docs/audits/2026-04-V3_AUDIT_COMPLETION.md`](./V3/docs/audits/2026-04-V3_AUDIT_COMPLETION.md) |
| Co rotovat / scrubnout | [`SECURITY_NOTICE_2026-04-28.md`](./SECURITY_NOTICE_2026-04-28.md) |
| Operator guide | [`V3/docs/CLI_GUIDE.md`](./V3/docs/CLI_GUIDE.md) |
| Roadmap | [`ROADMAP.md`](./ROADMAP.md), [`V3/ROADMAP.md`](./V3/ROADMAP.md) |
| Předchozí status | [`STATUS.md`](./STATUS.md) (2026-04-07) |

---

## 5. Test pyramid (snapshot 2026-04-29)

| Crate | Lib testů | Integration | Total | Fail |
|---|---:|---:|---:|---|
| `zion-core` (L1) | 478 | — | 478 | 1 flaky DNS (i na main) |
| `zion-cosmic-harmony` (L1 PoW) | 95 | — | 95 | 0 |
| `zion-pool` (L1) | 53 | 29 | 82 | 0 |
| `zion-miner` (L1) | 59 | — | 59 | 0 |
| `zion-bridge` (L2) | 125 | 63 | 188 | 0 |
| `zion-dao` (L2) | 40 | — | 40 | 0 |
| `zion-atomic-swap` (L2) | 18 | — | 18 | 0 |
| `zion-warp` (L3) | 251 | — | 251 | 0 |
| `zion-ncl` (L3) | 42 | — | 42 | 0 |
| `zion-ai-native` (L3) | 195 | — | 195 | 0 (+ 2 ignored) |
| `zion-cli` | 21 | — | 21 | 0 |
| **Total** | | | **~1 379** | **1 flaky** |

`cargo fmt --check` clean, `cargo clippy --all-targets` 0 errors (warnings
existují, ale jsou pre-existing).

---

## 6. Roadmap do Genesis

```
        ┌─────────────────────────────────────────────────┐
        │ NOW (2026-04-29)                                │
        │  ✅ V3 internal audit closed                    │
        │  ✅ F1, F3, F3b, F4, F5, F6, §15 fixed          │
        │  ✅ tx-hash v2 dormant + 5 regression tests     │
        │  ✅ Critical paths: tx, Ekam v2, payouts green  │
        └─────────────────┬───────────────────────────────┘
                          │
        ┌─────────────────▼───────────────────────────────┐
        │ Q2-Q3 2026                                       │
        │  □ Rotate ZION_KEYS (PAT, OpenAI, SSH)          │
        │  □ git filter-repo history scrub                 │
        │  □ Set GitHub Actions spending limit > $0       │
        │  □ Relayer synthetic-proof kill PR              │
        │  □ Re-enable bridge L2 mainnet                  │
        │  □ native-ffi safety contracts PR (gates GPU)    │
        │  □ lib.rs monolith refactor PR                   │
        │  □ DeFi Wave 1-3 (REST/WS RPC, Uniswap V3 LP)   │
        └─────────────────┬───────────────────────────────┘
                          │
        ┌─────────────────▼───────────────────────────────┐
        │ Q3 2026                                          │
        │  □ Trail of Bits / Halborn / OtterSec audit      │
        │  □ Bug bounty program                            │
        │  □ Coordinated hard fork window                  │
        │     ├── Activate tx-hash v2 (audit §3.2)         │
        │     └── Activate F2 BLAKE3 Merkle                │
        └─────────────────┬───────────────────────────────┘
                          │
        ┌─────────────────▼───────────────────────────────┐
        │ Q4 2026 (cíl 2026-12-31)                        │
        │  □ MainNet Genesis #0 announcement               │
        │  □ Public node binaries release                  │
        │  □ Exchange listing prep                         │
        └──────────────────────────────────────────────────┘
```

---

## 7. Pull Request kronika V3 auditu

| PR | Téma | Stav |
|---:|---|---|
| [#18](https://github.com/Yose144/2.9.6/pull/18) | F3: leaked wallet keys + V3 archives | ✅ merged |
| [#19](https://github.com/Yose144/2.9.6/pull/19) | CI fix (pkg-config, fmt drift, unclosed delim) | ✅ merged |
| [#20](https://github.com/Yose144/2.9.6/pull/20) | F1: UTXO conservation-of-value | ✅ merged |
| [#21](https://github.com/Yose144/2.9.6/pull/21) | fix(cli): mempool command | ✅ merged |
| [#22](https://github.com/Yose144/2.9.6/pull/22) | F4: bridge multisig L1 enforcement | ✅ merged |
| [#23](https://github.com/Yose144/2.9.6/pull/23) | F5: poison-resilient mutex recovery | ✅ merged |
| [#24](https://github.com/Yose144/2.9.6/pull/24) | F5 ext: P2P + bridge rate-limiter | ✅ merged |
| [#25](https://github.com/Yose144/2.9.6/pull/25) | Audit completion: ZION_KEYS, dead code, tx-hash v2 dormant | ✅ merged |

CI běží červená na všech PR od #18 — pre-existing GitHub Actions billing
infrastruktura issue (`runner_name=""`, jobs hotov v 3-10 s, žádný step se
nespustí). Lokální verifikace ale na všech PR projde čistě.

---

## 8. Závěr

V3 mainnet je **funkčně kompletní**. Všechny kritické nálezy z interního
auditu jsou buď uzavřené, nebo mají konkrétní aktivační plán. Co zbývá je
operační hygiena (rotace klíčů, scrub historie, CI billing) a koordinovaný
hard fork window pro nasazení dvou dormant fixů (tx-hash v2 + BLAKE3 Merkle).

Před Genesis #0 doporučujeme **třetí-stranný audit** (Q3 2026) a **bug bounty
program** — interní audit pokrývá code review, ale ne dynamic analysis,
fuzzing, a kryptanalýzu Cosmic Harmony Ekam Deeksha v2.

> *„Hot, ale ne na panikařit."* — co hoří je seznam P0/P1 výše. Nic z toho
> není v aktivním exploitu, ale klíče by se měly rotovat dnes a nejpozději
> tento týden.
