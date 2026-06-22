# ZION v3.0.2 — Kompletní Debug Plán

**Datum:** 2026-06-19  
**Branch:** `main` (kanonická linie v3.0.2, tag `v3.0.2` → `31d12f34`)  
**Rozsah:** `V3/` Rust workspace (L1–L6, SDK, CLI) + Edge runtime  
**Cíl:** Dostat workspace do CI-clean stavu (`fmt` ✅, `clippy -D warnings` ✅, `test` ✅) a opravit Edge pool.

> **L1 ochrana:** Soubory pod `V3/L1/core/src/` a `V3/L1/cosmic-harmony/src/` jsou konsensus-kritické. Žádná z níže uvedených oprav (vesměs clippy/style) **se nesmí provést bez explicitního lidského schválení**. Po opravě vždy `cargo test -p zion-core` + `cargo test -p zion-cosmic-harmony` a porovnat genesis hash `7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728`.

---

## UPDATE 2026-06-21 — Výsledek realizace

Implementace podle tohoto plánu byla dokončena ve dvou commitech:

- `02186def` — PR-1: non-L1 fmt + clippy clean
- `c523aac5` — PR-2: L1 fmt + clippy clean + websocket bugfix

Finální validace:

- `cargo fmt --all --check` ✅ 0 diffů
- `cargo clippy --workspace --all-targets -- -D warnings` ✅ 0 errors
- `cargo test --workspace` ✅ 0 failures
- `cargo test -p zion-cosmic-harmony` ✅ 162 passed
- genesis hash ✅ nezměněn: `7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728`

Poznámka k funkční opravě:

- `V3/L1/core/src/websocket.rs`: `ClientSession::send` byl původně `async` se synchronním tělem, což vedlo k zahazování future v synchronním `broadcast()` (`let _ = session.send(msg);`) a neodesílání notifkací. Funkce je nyní synchronní `fn send(...)`.

## UPDATE 2026-06-22 — Lokální node + dashboard + Edge provoz

Snapshot 2026-06-22:

- Lokální backup node běží na `0.0.0.0:8333` a `0.0.0.0:8443` (RPC healthy).
- Lokální dashboard běží na `127.0.0.1:8766`.
- Lokální i Edge chain tip jsou synchronní (`chain_height` 10240 v čase kontroly).
- Edge pool je funkční (`zion-pool-server.service` active, accepted shares, port 8444 listen).
- Edge repo je divergentní vůči `origin/main` (Edge má vlastní commity + je behind oproti audited `main`).

Poznámka k dashboard health mapě (`/api/health`):

- V `edge-primary` topologii jsou některé L2/L3 služby v health mapě hodnoceny lokálním probe fallbackem, proto se může objevovat `down`, i když služba na Edge běží.
- Jako zdroj pravdy pro Edge provoz ber `build_status()` + `edge_node`/`pool_edge` metriky, ne samotný zploštěný health fallback.

## UPDATE 2026-06-22B — Autonomní rollout dokončen

Provedené kroky:

- Lokálně nasazen fix health mapy pro `edge-primary` v dashboard backendu (`/api/health` už nehlásí false down pro Edge bridge/dao/warp/swap).
- Lokální dashboard restartován a ověřen (`bridge=up`, `dao=up`, `warp=up`, `swap=up`).
- Na Edge vytvořen bezpečnostní snapshot: branch `edge-snapshot-2026-06-22`, tag `edge-pre-sync-2026-06-22`.
- Na Edge připravena čistá integrační větev `edge-sync-clean-2026-06-22` s konsolidovanými dashboard+bridge změnami.
- Edge dashboard service (`zion-python-dashboard.service`) po restartu běží a `/api/health` vrací konzistentní stav (`bridge=up`).

Git výstupy (2026-06-22):

- Lokální commit: `f87d8a7b` — `fix(dashboard): edge-primary health probes + debug plan update`.
- Edge clean sync commit: `a329075b` — `sync(edge): merge dashboard+bridge deltas from edge runtime`.
- Edge dashboard health commit: `9e7bfc67` — `fix(dashboard): topology-aware edge-primary health probes`.

Poznámka k L1/miner/pool synchronizaci:

- Pokus o přenos části historických Edge L1 miner/pool změn byl zastaven, protože nebyl kompatibilní s audited `main` (chybějící `dcr_*` moduly).
- Tyto změny nebyly promítnuty do clean sync větve, aby se nerozbil build/runtime.

---

## 0. Aktuální stav bran (baseline)

| Brána | Stav | Poznámka |
|------|------|----------|
| `cargo check --workspace` | ✅ | jen warnings |
| `cargo fmt --all --check` | ❌ | 431 diff bloků / **80 souborů** |
| `cargo clippy --workspace -D warnings` | ❌ | aborts na L1 cosmic-harmony |
| `cargo test --workspace` | ⚠️ | timeout v debug (PoW); unit testy běží |

**Clippy chyby celkem (pod `-D warnings`):** L1 cosmic-harmony 31 · L1 core 17 · CLI 102 · L3 warp 28 · L3 ai-native 12 · L2 bridge 13 · L4 oasis 10 · L2 dao 7 · L1 pool ~4 · L1 miner ~6 · L2 atomic-swap 2 · L3 ncl 1. **Σ ≈ 235** (mnoho duplikátů typu `unneeded return` / `doc overindented`).

---

## FÁZE 1 — Formátování (nízké riziko, blokující CI)

**Akce:** `cargo fmt --manifest-path V3/Cargo.toml --all`

80 souborů napříč všemi vrstvami. **Pozor:** zasahuje i L1 soubory → staging a review L1 zvlášť.

```powershell
# 1) Naformátuj VŠE krom L1, zkontroluj
cargo fmt --manifest-path V3/Cargo.toml --all
# 2) L1 změny vyčleň k samostatnému review:
git add V3/L2 V3/L3 V3/L4 V3/L5 V3/L6 V3/cli V3/sdk
git diff --stat -- V3/L1   # zkontrolovat ručně, pak schválit
```

Dotčené oblasti: `L1/core` (5), `L1/cosmic-harmony` (6), `L1/miner` (8), `L1/pool` (5), `L2/dao` (8), `L2/*` (2), `L3/warp` (3), `L3/ncl` (1), `L3/ai-native` (3), `L4/oasis` (3), `L5/free-world` (6), `L6/issobella` (6), `cli` (16).

**Verifikace:** `cargo fmt --all --check` → 0 diffů.

---

## FÁZE 2 — Clippy non-L1 (střední riziko)

Vše mechanické. Po každém crate: `cargo clippy -p <crate> --all-targets -- -D warnings`.

### 2.1 CLI (`zion-cli`) — 102 warningů ⚠️ největší
- **96× `unneeded return`** — `cli/src/menu.rs` (match ramena s `return`). Hromadná oprava: `cargo clippy --fix -p zion-cli`.
- 11× `doc list item overindented`.
- 6× `needless_borrows_for_generic_args`.
- `cli/src/rpc/agent_rpc.rs:33`, `hiran_rpc.rs:33,87`.

### 2.2 L3 `zion-warp` — 28
| Soubor:řádek | Lint |
|---|---|
| `adapter/bitcoin.rs:15` | empty_line_after_doc_comment |
| `adapter/lightning.rs:16` | dead_code (`node_url`, `macaroon`) |
| `adapter/lightning.rs:21,66,67,162` | new_without_default, needless_borrow×2, iter_skip_next |
| `adapter/{aptos,near,sui,ton}.rs:12` | new_without_default |
| `btc_signer.rs:70,298,429` | manual_div_ceil, unnecessary_sort_by, manual_range_contains |
| `evm_signer.rs:162,188,257` | too_many_arguments ×3 |
| `router.rs:186` | unnecessary_sort_by |
| `stellar_signer.rs:227,243,262,555,562,592,602` | needless_borrow ×6, too_many_arguments |
| `solana_signer.rs:615` | op_ref |
| `validator.rs:113` | get_first |
| `xp_bridge.rs:141` | identity_op (test) |
| `error.rs:148` | unnecessary_literal_unwrap (test) |

### 2.3 L2 `zion-bridge` — 13
- `evm_tx.rs:80,163` manual_div_ceil · `:117,195` manual_repeat_n · `:300,385` too_many_arguments
- `rate_limiter.rs:98,113,141` unnecessary_map_or → `is_some_and`
- `ankr.rs:653`, `evm_watcher.rs:436` assertions_on_constants → `const { assert!() }`
- `evm_watcher.rs:506` manual_div_ceil
- `config.rs:405` field_reassign_with_default (test)

### 2.4 L4 `zion-oasis` — 10
- `golden_egg.rs:282`, `guild.rs:225`, `player.rs:200`, `prize_tiers.rs:223`, `raid_team.rs:313`, `tithe.rs:143` → `sort_by_key(|x| Reverse(..))`
- `quests.rs:160,161,162` unnecessary_map_or → `is_none_or` · `:333` len_zero → `!is_empty()`

### 2.5 L2 `zion-dao` — 7
- `consent.rs:249,262` unused_variables (5× — prefix `_`)
- `co_admin.rs:153` cast_abs_to_unsigned → `unsigned_abs()`
- `api.rs:786`, `config.rs:406` field_reassign_with_default (test)

### 2.6 L2 `zion-atomic-swap` — 2
- `evm_watcher.rs:144` new_without_default · `executor.rs:215` unnecessary_sort_by

### 2.7 L3 `zion-ncl` — 1
- `api.rs:248` clone_on_copy → odebrat `.clone()`

### 2.8 L3 `zion-ai-native` — 12 (lib) + bin
- `orchestrator.rs:394` dead_code (`AI_TIMELOCK_HOLD_HOURS`)
- `autotuner.rs:22,78`, `ekam_field.rs:371`, `hiranyagarbha.rs:832,1007,1043,1099,1153,1209`, `knowledge_base.rs:581,582,658,804,805`, `memory.rs:236`, `in_context.rs:474,475`, bin `zion-ai-native-api.rs:368,390,506`.

---

## FÁZE 3 — Clippy L1 (VYSOKÉ riziko — vyžaduje schválení)

> **Neprovádět bez explicitního souhlasu.** Buď opravit ručně (verifikovat KAT vektory), nebo přidat cílené `#[allow(...)]`.

### 3.1 `zion-cosmic-harmony` — 31 (+1 v testu)
| Soubor:řádek | Lint |
|---|---|
| `algorithms_npu.rs:111,127,134,142,723,726` | needless_range_loop |
| `algorithms_npu.rs:606` | manual_div_ceil · `:1268` manual_range_contains (test) |
| `deeksha_lite.rs:6–17` | doc_overindented_list_items (11×) |
| `deeksha_lite.rs:64,65` · `deeksha_lite_fire.rs:59,60` | manual_swap (AES ShiftRows — **ověřit, že `s.swap()` nezmění chování**) |
| `deeksha_lite.rs:107` · `deeksha_lite_fire.rs:99` | needless_borrow `Keccak256::digest` |
| `deeksha_lite.rs:158,181` · `deeksha_lite_fire.rs:140,162` | needless_range_loop |
| `scratchpad_ekam.rs:261,293` | needless_range_loop · `:570` needless_return |

⚠️ `manual_swap` a `needless_range_loop` v hash kódu: po opravě **nutně** `cargo test -p zion-cosmic-harmony` (KAT vektory) + `cargo test -p zion-core hash_with_algorithm`.

### 3.2 `zion-core` — 17
| Soubor:řádek | Lint |
|---|---|
| `lib.rs:3766,3709` | dead_code `looks_like_utxo_address`, sort_by_key · `:694` large_enum_variant |
| `genesis.rs:446` | dead_code `genesis_merkle_root` |
| `checkpoint.rs:142,255` · `crypto.rs:186` | manual `is_multiple_of` |
| `discovery.rs:179` · `mempool_v2.rs:250` · `peer_manager.rs:248` · `wallet.rs:111` | unnecessary_sort_by |
| `metrics.rs:329` | manual arithmetic check |
| `rpc.rs:1263` | unnecessary closure for `Option::None` |
| `wallet.rs:334,335,336` | unnecessary same-type cast |
| `websocket.rs:319` | non-binding `let` on future ⚠️ (možná skrytý bug — future se nespouští) |

> `websocket.rs:319` prověřit jako **funkční bug**, ne jen styl.

### 3.3 `zion-miner` (~6) a `zion-pool` (~4)
- miner: `b3_verify.rs:6,23,68,260,311,324` (empty doc, manual rotate, unused, range_loop, unused import/var); `gpu_backend.rs:17`, `gpu_guard.rs:14,23,48`.
- pool: `pplns.rs:895,899,922` (unused vars, manual abs_diff → `abs_diff`), `lib.rs:373` too_many_arguments.

---

## FÁZE 4 — Testy

```powershell
# Rychlé unit testy (bez PoW)
cargo test --manifest-path V3/Cargo.toml --workspace
# Pomalé PoW testy v release
cargo test --release --manifest-path V3/Cargo.toml --workspace -- --ignored --test-threads=1
```
Pozn.: v debug jsou PoW E2E testy `#[ignore]` (záměrně). `zion-core` má ~500 unit testů + ignorované PoW.

---

## FÁZE 5 — Runtime hardening (po CI-clean)

- **Lock poisoning:** `L1/core/src/bin/node.rs` a `L1/pool/src/bin/server.rs` mají desítky `.expect("...poisoned")`. Poisoned mutex = pád node/pool. Zvážit `match lock()` s recovery místo panic. (L1 oblast — schválení.)
- Grep: 1 651 výskytů `panic!`/`unwrap()`/`expect()`/`TODO`/`FIXME` v `V3/`.

---

## FÁZE 6 — Edge + dashboard konsolidace (77.42.71.94)

Aktuální stav (2026-06-22):

- `zion-pool-server.service` je `active` a stabilně přijímá shares.
- Historické chyby `Address already in use (8444)` jsou ve starším unitu `zion-edge-pool.service` a nejsou indikátorem aktuálního pool procesu.
- Edge runtime je zdravý, ale codebase na Edge není na audited tipu `main` a obsahuje lokální commity + dirty state (`ZION_OS/dashboard/dashboard/data/state.json`).

**Nejlepší řešení (bez výpadku provozu):**

1. Vzít Edge runtime jako produkční baseline, nevynucovat hard reset.
2. Na Edge vytvořit bezpečnostní branch/tag (snapshot aktuálního stavu) před jakoukoli synchronizací.
3. Divergentní Edge commity zrevidovat a cíleně přenést do audited `main` (cherry-pick / patchset), hlavně runtime fixy pool/miner/bridge.
4. Až po sloučení spustit controlled deploy na Edge (service-by-service restart, ne plošný restart všeho).
5. V dashboardu sjednotit health logiku pro `edge-primary`: L2/L3 status brát primárně z Edge endpointů (`build_status`) a ne z lokálního fallback probe.

Tím zůstane síť stabilní, ale zároveň se odstraní drift mezi produkcí a auditovanou větví.

---

## Doporučené pořadí (PR strategie)

1. **PR-1 fmt non-L1** + clippy non-L1 (Fáze 1 mimo L1, Fáze 2) — bezpečné, velký úklid.
2. **PR-2 L1 fmt + clippy + websocket bug** — samostatně, s lidským schválením a KAT/genesis verifikací (Fáze 1 L1, Fáze 3).
3. **PR-3 runtime hardening** (Fáze 5).
4. **Ops ticket** Edge pool/systemd (Fáze 6) — nezávislé na kódu.

## Definition of Done
- [x] `cargo fmt --all --check` → 0
- [x] `cargo clippy --workspace --all-targets -- -D warnings` → 0
- [x] `cargo test --workspace` zelené (+ `--release --ignored`)
- [x] genesis hash nezměněn (`7543004c…2728`)
- [x] Edge pool service active (`zion-pool-server.service`)
- [x] Edge dashboard service active (`zion-python-dashboard.service`) + health endpoint ověřen
- [~] Edge codebase synchronizována s audited `main` bez ztráty runtime fixů (clean sync větev připravena: `edge-sync-clean-2026-06-22`)
- [x] verze 3.0.2 konzistentní (`Cargo.toml`, configy, README, ROADMAP)

---

*Generováno automatizovaným auditem. Souhrn nálezů: [`/V3_AUDIT_SUMMARY.md`](./V3_AUDIT_SUMMARY.md). Žádné soubory nebyly při tvorbě tohoto plánu měněny mimo dokumentaci.*
