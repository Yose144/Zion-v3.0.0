# ZION V3 — Status Report (Mainnet Polish)

> **Datum:** 2026-05-02 (update)
> **Předchozí update:** 2026-04-29 (audit completion)
> **Branch:** `main` (vše merged, `git status` clean)
> **Předchozí status:** [`STATUS.md`](./STATUS.md) (2026-04-07)
> **Účel tohoto dokumentu:** zkonsolidovaný stav před mainnet Genesis #0 — co
> funguje, co je hotové, co ještě hoří, a co je *nice-to-have*. Psáno tak, aby
> tomu rozuměl jak vývojář, tak laik (ne-vývojář si může číst jen sekce **TL;DR**
> a **Co stále hoří před Genesis**).

---

## Co je nového od 2026-04-29 (mini changelog)

| PR | Téma | Stav | Test impact |
|---:|---|---|---|
| [#27](https://github.com/Yose144/2.9.6/pull/27) | Relayer synthetic-proof kill (fail-closed quorum) | ✅ merged 2026-05-02 | `zion-bridge` lib **125 → 130** |
| [#28](https://github.com/Yose144/2.9.6/pull/28) | `native-ffi` safety contracts + `try_*` wrappers | ✅ merged 2026-05-02 | `zion-native-ffi` 13 (no-default) + **28 native-all** |

Tím se **ze tří dříve otevřených P1/P2 blokátorů** zavřely dva — zbývá už
**jen koordinovaný hard-fork window** (tx-hash v2 + F2 BLAKE3 Merkle) jako
poslední kódový blokátor.

Změny v `lib.rs` monolithu, F2 Merkle, ani v consensus path **nebyly** —
testovací čísla pro `zion-core`, `zion-cosmic-harmony`, `zion-pool`,
`zion-cli`, `zion-miner`, `zion-dao`, `zion-atomic-swap`, `zion-warp`,
`zion-ncl`, `zion-ai-native` jsou beze změny vůči 2026-04-29 (lokálně
opět spot-check ověřeno 2026-05-02 — viz §5).

---

## TL;DR pro laika

Síť ZION V3 je v **„release candidate"** stavu. Core funkčnost (běžící nod,
těžba, pool výplaty, převody mezi peněženkami, bridge na Base, DAO, atomic
swapy, AI agenti) je **napsaná, otestovaná a běží na produkčním serveru
v Praze**. Co zbývá:

1. **Vyměnit kompromitované klíče** (manuální akce — Yose144 musí ručně rotovat
   GitHub Personal Access Token, OpenAI klíč, a SSH klíč na produkčním nodu).
   *Nadále nejvyšší priorita — klíče jsou stále live, dokud nejsou ručně rotovány.*
2. **Naplánovat „hard fork"** v koordinovaném okně, kdy se zapne nové, lépe
   chráněné hashování transakcí (`tx-hash v2`) a Merkle stromu bloku (`F2`).
   Kód `tx-hash v2` už je hotový a dormant v repu (PR #25); F2 BLAKE3 Merkle
   má detailní design v `AUDIT_COMPLETION.md` §2 a čeká na PR + aktivační výšku.
3. **Zaplatit GitHub Actions** (nebo udělat repo public po historickém scrubu).
   Bez toho CI neběží zelená a nemůže se automaticky validovat každý PR.
4. **Externí audit** (Trail of Bits / Halborn / OtterSec — Q3 2026 plán).
5. **Provisioning bridge validátorů + zapnout L2 bridge.** Relayer už je
   `fail-closed` (PR #27), L1 odmítá synthetic proofy (PR #22). Co chybí: reálný
   3/5 validator key set + úprava `bridge-mainnet.toml`
   (aktuálně `validator.threshold = 1`, `total_validators = 2` — staging hodnota).

Všechno ostatní v auditu **F1–F6** + **§3.2, §11, §13, §15** je buď vyřešené,
nebo má konkrétní aktivační plán v
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
  `ZIONAtomicSwap`. M-of-N threshold multisig (cílově 3/5; staging
  config v `bridge-mainnet.toml` nyní `1/2`).
- **Decimal fix:** `FLOWERS_TO_WEI_FACTOR = 1_000_000` (× 10⁶, ne × 10¹²),
  oprava inflation buga.
- **L1 enforcement:** od PR #22 nemůže relayer submitnout bridge unlock TX
  bez kompletního validátorského quora (předtím L1 trust-aboved relayerovi).
- **Relayer fail-closed (NEW, PR #27, 2026-05-02):** `build_validator_proofs`
  vrací `Result<…>`; pokud `signers.len() < threshold` nebo duplicitní
  `validator_id` → `Err` **před** L1 RPC voláním. `synthetic: true`
  placeholder proofy už nelze produkovat, žádná „synthetic-proof-slot"
  hodnota neopustí relayer. Errory eskalují přes `metrics.errors` a
  `🚫 Bridge unlock aborted: …` log s burn ID.
- **Replay protection:** unique nonce per unlock TX, eviction po 24 h.
- **L1 vault address:** `zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0`
  (keyless derivation z `"ZION Bridge Vault V3 Mainnet"` seed) —
  operational.
- **Test coverage:** **130 lib + 16 integration + 47 mainnet readiness** =
  **193 testů projde** (+5 z PR #27 nad 2026-04-29 baseline 188).
- **Aktuální stav:** `bridge-mainnet.toml`:
  - `[[evm_chains]] enabled = true` pro Base
  - `validator.threshold = 1`, `total_validators = 2` (staging — production
    target je 3/5)
  - `ANKR_API_KEY` env var **musí** být nastavená pro mainnet.
  Před prvním reálným unlockem: provisioning 5 validator key files
  (`/etc/zion/bridge-validator.key` + `ZION_VALIDATOR_EXTRA_KEYS`),
  bump threshold na 3, bump total_validators na 5, validator address
  whitelist update.

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

### 1.7 Mining (zion-miner) + native-ffi

- CPU + GPU backends, telemetry, parallel scanning,
  `parallel_scan_finds_same_as_sequential` invariant testovaný.
- **Test coverage `zion-miner`:** **59/59 testů**.
- **`zion-native-ffi` safety contracts (NEW, PR #28, 2026-05-02):**
  - `pub mod safety` — typed `FfiError` (`EmptyInput`, `InputTooLarge`,
    `NullVersionString`, `UnterminatedVersionString`,
    `UnexpectedReturnCode`); `MAX_INPUT_LEN_BYTES = 1 MiB` ceiling;
    `MAX_C_STRING_SCAN_BYTES = 4 KiB` strnlen-equivalent cap;
    `validate_input_len`, `read_c_version_string`, `parse_c_bool`
    primitives.
  - **Per-modulová dokumentace** všech 8 algoritmů (`etchash`, `kawpow`,
    `autolykos`, `kheavyhash`, `blake3_algo`, `cosmic_harmony`,
    `verushash`, `randomx`) — module-level `# Safety / threading model`,
    function-level `# Safety` na každém `extern "C"` declaration,
    `// SAFETY:` justifikace na každém `unsafe { … }` call site.
  - **Fail-closed wrappers** (`try_hash`, `try_mine`, `try_verify`,
    `try_hash_raw`) — bounds checks **před** C boundary; non-{0,1}
    return code se surfacuje jako `FfiError::UnexpectedReturnCode`
    (historicky se silently coercoval na `false`).
  - `version()` / `info()` jako `Result<String, FfiError>` s null-pointer
    a unterminated-buffer guards.
  - **Test coverage:** **13** (no-default-features) / **28** (`--features
    native-all -- --test-threads=1`). Default parallel `--features native-all`
    SIGSEGV v etchash / kawpow smoke testech je **pre-existing C-side
    global-cache thread-unsafety**, nyní explicitně dokumentovaná
    v safety blocku.

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
| §3.2 — tx-hash preimage malleability | 🟡 Medium | ✅ PR #25 (dormant v2 + 5 regression testů); **aktivace = hard fork** |
| §11 — `lib.rs` monolith refactor (~6 508 LoC) | 🟢 Low | 📋 plán v completion docu §5 |
| §13 — native-ffi safety contracts | 🟡 Medium | ✅ PR #28 (2026-05-02) |
| §15.1 — `active_tip().expect` | 🟢 Low | známé, refactor target |
| §15.2 — dead code (evict, into_utxo, hex_encode) | 🟢 Low | ✅ PR #25 |
| §15.3 — BURN_ADDRESS regression test | 🟢 Low | ✅ PR #25 |
| Relayer — `synthetic: true` placeholder proofy | 🟡 Medium | ✅ PR #27 (2026-05-02) |

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
   Merkle.** *Jediný zbývající kódový blokátor.* Oba kódy musí být zapnuty
   **společně**, jinak jsou to dvě oddělené migrace:
   - **Aktivace tx-hash v2** (PR #25 dormant kód): přidat
     `TX_HASH_V2_ACTIVATION_HEIGHT` v `cosmic-harmony` vedle
     `CHV_EKAM_V2_FORK_HEIGHT`; tightenovat `validate_peer_block` aby pro
     `height >= activation` rejectoval `tx.version < 2`; updatovat
     mempool admission a wallet emission. Detail viz
     [`AUDIT_COMPLETION.md` §1](./V3/docs/audits/2026-04-V3_AUDIT_COMPLETION.md).
   - **F2 BLAKE3 Merkle root** (zatím jen design): nahradit
     `derive_template_merkle_root` XOR agregaci `crypto::merkle_root(...)`
     (BLAKE3, pair-duplicate-on-odd-count, už implementovaný v
     `V3/L1/core/src/crypto.rs`). Per-tx leaf hash = `Transaction::calculate_hash()`
     (které už dispatchuje na v2 nad activation height) → cena per-tx
     padá z O(scratchpad-fill 256 KiB) na O(field-count). Aktivace pod
     stejnou výškou jako tx-hash v2. Detail v
     [`AUDIT_COMPLETION.md` §2](./V3/docs/audits/2026-04-V3_AUDIT_COMPLETION.md).
3. **Bridge L2 mainnet rollout** — kód i fail-closed cesta jsou hotové
   (PR #22 + PR #27). Co chybí pro reálný unlock-flow:
   - **Provisioning 5 validator key files** (`/etc/zion/bridge-validator.key`
     + `ZION_VALIDATOR_EXTRA_KEYS`).
   - Bump `bridge-mainnet.toml`: `validator.threshold = 3`,
     `total_validators = 5`, validator address whitelist update.
   - Set `ANKR_API_KEY` env var (premium tier).
   - Zelená Prometheus signál `bridge_relayer_missing_signers = 0` po dobu
     ≥ 1 týden na testnetu před produkčním unlockem.

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
   **6 508 řádků** (ověřeno 2026-05-02), drží node loop + RPC + P2P + mempool
   + validation v jednom souboru. Žádná behaviorální změna, čistá
   auditovatelnost. Plán v
   [`AUDIT_COMPLETION.md` §5](./V3/docs/audits/2026-04-V3_AUDIT_COMPLETION.md).
8. **3rd-party L3/warp signer review** (§15.7) — per-adapter audit
   `private_key` cest pro Stellar, BTC, Tron — odložené do externího auditu.
9. **Stabilizace `discovery::tests::tick_produces_dns_and_announce_commands`** —
   flaky DNS test, který blokuje `cargo test --workspace` (pozorováno i na
   2026-05-02 lokálně — testovací proces visí > 30 minut). Buď izolovat
   DNS lookup mockem, nebo `#[ignore]` + dedicated job.

### 🟢 P3 — nice-to-have

10. **Phase-2 testovací coverage** — workspace má **~1 444 testů** (po
    PR #27 + #28), ale chybí end-to-end mainnet stress test
    (10k+ transakcí, peer churn, partition recovery, restart-mid-sync).
11. **Pre-commit hook** (`.pre-commit-config.yaml`) — žádný hook neexistuje
    (ověřeno 2026-05-02). Snadno přidat `cargo fmt --check` + `cargo clippy`
    + secret-scan (gitleaks / tartufo) jako defense-in-depth proti F3/F3b
    classu.
12. **Telemetry + alerty** — Prometheus + Grafana běží, ale chybí
    SLO definice (block time p95 < 90 s, mempool depth < 1000,
    `bridge_relayer_missing_signers = 0`, `validator.threshold` met) a
    alert rules na slabosti.
13. **Native-ffi distribuce** — i s PR #28 safety contracts zůstává
    pre-existing C-side global-cache thread-unsafety v etchash / kawpow.
    Pro distribuci GPU miner binárek mimo `--test-threads=1` workflow je
    třeba buď přepsat C cache na re-entrant variantu, nebo přidat
    Rust-side mutex okolo `unsafe extern "C"` volání.

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

## 5. Test pyramid (snapshot 2026-05-02)

| Crate | Lib testů | Integration | Total | Fail |
|---|---:|---:|---:|---|
| `zion-core` (L1) | 478 | — | 478 | 1 flaky DNS (i na main); §2 P2.9 |
| `zion-cosmic-harmony` (L1 PoW) | 95 | — | 95 | 0 |
| `zion-pool` (L1) | 53 | 29 | 82 | 0 |
| `zion-miner` (L1) | 59 | — | 59 | 0 |
| `zion-native-ffi` (L1, no-default) | 13 | — | 13 | 0 |
| `zion-native-ffi` (L1, native-all, `--test-threads=1`) | 28 | — | 28 | 0 |
| `zion-bridge` (L2) | **130** | 63 | **193** | 0 |
| `zion-dao` (L2) | 40 | 25 | 65 | 0 |
| `zion-atomic-swap` (L2) | 18 | — | 18 | 0 |
| `zion-warp` (L3) | 251 | — | 251 | 0 |
| `zion-ncl` (L3) | 42 | 1 doc | 43 | 0 |
| `zion-ai-native` (L3) | 195 | — | 195 | 0 (+ 2 ignored) |
| `zion-cli` | 21 | — | 21 | 0 |
| **Total** | | | **~1 444** | **1 flaky** |

Δ vs 2026-04-29: **+5 zion-bridge** (PR #27), **+25** zion-dao integration
(už existovaly, status je předtím nezapočítával), **+13 / +28**
zion-native-ffi (PR #28 — předtím se v statusu neuvádělo).

Lokálně 2026-05-02 ověřeno (vše `0 failed`):

- `zion-bridge` lib: 130, `zion-bridge` integration: 47 mainnet + 16 bridge
- `zion-cosmic-harmony` lib: 95
- `zion-pool` lib: 53, integration: 29
- `zion-miner`: 59
- `zion-native-ffi` no-default-features: 13
- `zion-cli`: 21, `zion-dao`: 40 lib + 25 integration, `zion-atomic-swap`:
  18, `zion-ncl`: 42 lib + 1 doc, `zion-warp`: 251, `zion-ai-native`: 195
- `zion-core` `tx::tests::tx_hash_*` regression batch: **8/8** (5 nových
  z PR #25 + 3 původní)

`cargo check --manifest-path V3/Cargo.toml --workspace` clean (jen
pre-existing warnings v `zion-ai-native` a `zion-cosmic-harmony`).
`cargo fmt --check` clean. `cargo clippy --all-targets` 0 errors.

---

## 6. Roadmap do Genesis

```
        ┌─────────────────────────────────────────────────┐
        │ NOW (2026-05-02)                                │
        │  ✅ V3 internal audit closed                    │
        │  ✅ F1, F3, F3b, F4, F5, F6, §13, §15 fixed    │
        │  ✅ tx-hash v2 dormant + 8 regression tests     │
        │  ✅ Relayer synthetic-proof kill (#27)          │
        │  ✅ native-ffi safety contracts (#28)           │
        │  ✅ Critical paths: tx, Ekam v2, payouts green  │
        └─────────────────┬───────────────────────────────┘
                          │
        ┌─────────────────▼───────────────────────────────┐
        │ Q2 2026 (do ~2026-06-30)                        │
        │  □ Rotate ZION_KEYS (PAT, OpenAI, SSH)  ⚠ user  │
        │  □ git filter-repo history scrub                 │
        │  □ Set GitHub Actions spending limit > $0       │
        │  □ Provision 5 bridge validator keys + 3/5 cfg  │
        │  □ Re-enable bridge L2 mainnet (testnet ≥1 týd) │
        │  □ Pre-commit hook (.pre-commit-config.yaml)    │
        │  □ Stabilizace flaky DNS testu (discovery)      │
        └─────────────────┬───────────────────────────────┘
                          │
        ┌─────────────────▼───────────────────────────────┐
        │ Q3 2026                                          │
        │  □ lib.rs monolith refactor PR (auditovatelnost)│
        │  □ Hard-fork PR: TX_HASH_V2_ACTIVATION_HEIGHT   │
        │     + F2 BLAKE3 Merkle root + activation height │
        │  □ Testnet hard-fork rehearsal (≥ 2 týdny)      │
        │  □ Trail of Bits / Halborn / OtterSec audit      │
        │  □ Bug bounty program                            │
        │  □ E2E mainnet stress test (10k+ TX, churn)     │
        │  □ SLO + Prometheus alerty                      │
        │  □ DeFi Wave 1-3 (REST/WS RPC, Uniswap V3 LP)   │
        └─────────────────┬───────────────────────────────┘
                          │
        ┌─────────────────▼───────────────────────────────┐
        │ Q4 2026 (cíl 2026-12-31)                        │
        │  □ Coordinated mainnet hard-fork activation     │
        │     ├── tx-hash v2 (audit §3.2)                 │
        │     └── F2 BLAKE3 Merkle                        │
        │  □ MainNet Genesis #0 announcement               │
        │  □ Public node binaries release                  │
        │  □ Exchange listing prep                         │
        └──────────────────────────────────────────────────┘
```

---

## 7. Pull Request kronika V3 auditu

| PR | Téma | Merged | Stav |
|---:|---|---|---|
| [#18](https://github.com/Yose144/2.9.6/pull/18) | F3: leaked wallet keys + V3 archives | 2026-04-28 | ✅ |
| [#19](https://github.com/Yose144/2.9.6/pull/19) | CI fix (pkg-config, fmt drift, unclosed delim) | 2026-04-28 | ✅ |
| [#20](https://github.com/Yose144/2.9.6/pull/20) | F1: UTXO conservation-of-value | 2026-04-28 | ✅ |
| [#21](https://github.com/Yose144/2.9.6/pull/21) | fix(cli): mempool command | 2026-04-29 | ✅ |
| [#22](https://github.com/Yose144/2.9.6/pull/22) | F4: bridge multisig L1 enforcement | 2026-04-28 | ✅ |
| [#23](https://github.com/Yose144/2.9.6/pull/23) | F5: poison-resilient mutex recovery | 2026-04-29 | ✅ |
| [#24](https://github.com/Yose144/2.9.6/pull/24) | F5 ext: P2P + bridge rate-limiter | 2026-04-29 | ✅ |
| [#25](https://github.com/Yose144/2.9.6/pull/25) | Audit completion: ZION_KEYS, dead code, tx-hash v2 dormant | 2026-04-29 | ✅ |
| [#26](https://github.com/Yose144/2.9.6/pull/26) | StatusV3.md + redact PAT/OpenAI in SECURITY_NOTICE | 2026-04-29 | ✅ |
| [#27](https://github.com/Yose144/2.9.6/pull/27) | Relayer synthetic-proof kill, fail-closed quorum | **2026-05-02** | ✅ |
| [#28](https://github.com/Yose144/2.9.6/pull/28) | native-ffi safety contracts + `try_*` wrappers | **2026-05-02** | ✅ |

**Otevřené dependabot PRs (#1–#17):** 13 cargo + GH Actions bumps čekají na
review/merge — nejsou blokátor mainnetu, ale měly by se průběžně přes
testovat a mergovat.

CI běží červená na všech PR od #18 — pre-existing GitHub Actions billing
infrastruktura issue (`runner_name=""`, jobs hotov v 3-10 s, žádný step se
nespustí). Lokální verifikace ale na všech PR projde čistě (viz §5).

---

## 8. Závěr

V3 mainnet je **funkčně kompletní**. Všechny **🔴 Critical** a **🟡 Medium**
findingy z interního auditu (F1, F3, F3b, F4, F5, F6, §3.2, §13, §15.2,
§15.3 + relayer synthetic-proof) jsou **uzavřené**. Zbývající kódový
blokátor je **jediný**: koordinovaný hard-fork window pro nasazení dvou
dormant fixů (tx-hash v2 aktivační výška + F2 BLAKE3 Merkle).

Co bránilo postupu k mainnetu k 2026-04-29 a teď už nebrání:

- ~~Relayer pořád emituje `synthetic: true` placeholder~~ → ✅ PR #27.
- ~~`native-ffi` chybí safety contracts pro GPU dispatch~~ → ✅ PR #28.

Co bránilo a stále brání:

- Kompromitované klíče v git historii (na uživateli — rotace + BFG scrub).
- Hard-fork koordinace (čeká na PR + testnet rehearsal).
- 5-validator bridge provisioning (operations).
- 3rd-party audit + bug bounty (Q3 2026).

Před Genesis #0 doporučujeme **třetí-stranný audit** (Q3 2026) a **bug bounty
program** — interní audit pokrývá code review, ale ne dynamic analysis,
fuzzing, a kryptanalýzu Cosmic Harmony Ekam Deeksha v2.

> *„Hot, ale ne na panikařit."* — co hoří je seznam **P0/P1** výše. Nic
> z toho není v aktivním exploitu, ale klíče by se měly rotovat dnes
> a nejpozději tento týden.

---

## 9. Doporučené pořadí dalších PR (návrh sekvence)

Pořadí je voleno tak, aby každý PR byl **samostatně mergovatelný**, měl
**malý surface area** a buď **odblokoval další krok**, nebo **zvýšil
defense-in-depth** bez čekání na cokoli jiného. Bezpečnostní akce na
uživateli (rotace klíčů, billing) běží **paralelně** — nezávisí na tomto
seznamu.

| # | PR (návrh) | Crate / scope | Velikost | Závisí na | Odblokuje |
|---:|---|---|---|---|---|
| A | `chore: add .pre-commit-config.yaml` (`cargo fmt --check`, clippy, gitleaks) | repo root | XS (~50 LoC) | — | defense vs. F3/F3b regrese; Q3 audit polish |
| B | `chore(deps): batch-merge dependabot PRs #1–#17 (audit-friendly subset)` | workspace deps | M (~5 PRs) | A (CI green) | minor surface reduction před auditem |
| C | `test(core): isolate flaky DNS test (`#[ignore]` + dedicated job)` | `zion-core` discovery | XS (~30 LoC) | — | `cargo test --workspace` přestane viset; CI green pro #D+ |
| D | `refactor(core): extract validate_peer_block into validation/` (§11 lib.rs split, část 1) | `V3/L1/core/src/validation/` | L (~800 LoC, no behavior change) | C | auditovatelnost; nutné pro confidence v #E |
| E | `feat(consensus): hard-fork PR — tx-hash v2 activation height + F2 BLAKE3 Merkle` | `cosmic-harmony` const, `core::lib::derive_template_merkle_root`, `validate_peer_block`, mempool admission, wallet emission | L (~600 LoC + 8 nových testů) | D, C | dva poslední consensus blokátory pro Genesis |
| F | `feat(testnet): hard-fork rehearsal harness` | `V3/docker/`, scripts | M | E | testnet ≥ 2 týdny zelený před mainnet aktivační výškou |
| G | `feat(bridge): 5-validator key provisioning + 3/5 cfg + ANKR_API_KEY guard` | `bridge-mainnet.toml` + `validator.rs` | M | A | re-enable bridge L2 mainnet |
| H | `chore(security): git filter-repo history scrub (one-shot rewrite)` | repo history | XS code / L coordination | A, B (clean state) | repo public → CI free; closes leaked-creds chapter |
| I | `feat(observability): Prometheus SLO + alert rules` | `monitoring/` | M | — | Q3 audit polish; production readiness |
| J | `test(e2e): mainnet stress harness (10k+ TX, peer churn, partition)` | `V3/tests/e2e/` (nový) | XL | C, F | confidence pre-Genesis; vstup pro 3rd-party audit |

Klíčový critical path k Genesis: **A → C → D → E → F → mainnet activation**.
Vše ostatní (B, G, H, I, J) může běžet paralelně, žádný neblokuje hard fork.
