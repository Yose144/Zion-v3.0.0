# ZION Chain Stall Fix Report — 2026-07-13

## Souhrn

Chain se zasekl na bloku **4502** po dobu **~25 hodin** (od ~12. července 14:04 UTC do 13. července 14:48 UTC). Root cause byly **dva bugy** aktivované při CHV3 fork height 4500. Po fixu chain obnovil block production — 5 bloků (4503-4507) nalezeno za ~12 minut.

---

## Diagnostika

### Příznaky
- Chain height stuck na 4502, 0 nových bloků za 25h
- Pool: 100% share accept rate, ale 0 BLOCK_FOUND
- 569 `hash_mismatch` events za 24h (miner `local-gpu`)
- Všechni externí mineri (nano-02/03/04/05): 0 valid shares
- Pool hashrate spadl z 9.5 MH/s na 101K hps
- P2P disconnect storm: ~904 disconnects za 5 minut (externí mineri na P2P port 8333)

### Root Cause #1: CHV3 algorithm name mismatch

**Commit** `7dd81cfb7` (2026-07-12) nastavil `CHV3_FORK_HEIGHT=4500` — od bloku 4500 pool začal advertovat `deeksha_chv3` jako kanonický algorithm name místo `deeksha_lite_v1`.

Problém: `deeksha_chv3` je bit-identical alias přes `hash_with_algorithm()`:
```rust
"deeksha_chv3" | "deeksha_lite_v1" => {
    zion_cosmic_harmony::deeksha_lite::deeksha_lite(&header_bytes, self.nonce)
}
```

ALE:
1. **Node binárka na Edge** (build 12. července 21:58) **neobsahovala** `deeksha_chv3` string (0 výskytů v `strings`). Když pool poslal `submit_candidate` s `algorithm: "deeksha_chv3"`, node fallbackoval na `_ => cosmic_harmony_with_height(...)` — **úplně jiný hash** (keccak + sha3_512 + golden_matrix + memory_hard + npu_mixing + fusion).
2. **Externí mineri** (nano-02/03/04/05) neznali `deeksha_chv3` → počítali špatný hash → pool viděl `hash_mismatch`.

Bloky 4500 a 4501 prošly náhodou (cosmic_harmony hash náhodou splnil target ~1 ku 1M).

**Fix:** `V3/L1/pool/src/lib.rs` — `advertised_algorithm_for_height()` vždy vrací `"deeksha_lite_v1"` bez ohledu na height. Oba návy mapují na stejnou hash funkci, takže to je safe. CHV3 name může být re-enabled až když všechny nody a mineri budou updatovány.

### Root Cause #2: force_coin override pro Zion sessions

`ZION_POOL_AUXPOW_COIN=ETC` nastavoval `force_coin = Some(ExternalCoin::ETC)`. V job dispatch logice:

```rust
let desired_external_coin = if config.auxpow_config.enabled {
    config.auxpow_config.force_coin           // ← vždy Some(ETC)
        .or_else(|| revenue_source_to_external_coin(revenue_source))
} else { None };
```

`force_coin` **přepisoval** revenue scheduler i pro session_group=Zion. Všichni mineri kteří chtěli těžit ZION (`session_group_requested=zion`) dostávali ETC external jobs místo ZION jobs.

**Fix:** `V3/L1/pool/src/bin/server.rs` — když `session_group == SessionGroup::Zion`, `force_coin` se nepoužije:
```rust
if session_group == SessionGroup::Zion {
    None  // ← issue native ZION job
} else {
    config.auxpow_config.force_coin
        .or_else(|| revenue_source_to_external_coin(revenue_source))
}
```

### Sekundární problém: chybějící env vars

- `ZION_BACKEND_AUTO_INCLUDE_ZION` — default `false`, ZION nebyl zahrnut v auto-assignment → přidáno `=1`
- `ZION_POOL_AUXPOW_SPLIT_EXTERNAL` — chyběl, `parse_split_env()` vracel `None`, `should_issue_external_job()` vracel `true` (vždy external) → přidáno `=1`

---

## Aplikované fixy

### Code changes

| Soubor | Změna |
|--------|-------|
| `V3/L1/pool/src/lib.rs` | `advertised_algorithm_for_height()` → vždy `"deeksha_lite_v1"` |
| `V3/L1/pool/src/bin/server.rs` | `force_coin` skip pro `SessionGroup::Zion` |
| `AuXpow/src/auxpow_client.rs` | Pre-existing compile fix: `extrannonce2` → `extranonce2` (2 sites), duplicitní `epoch` field |

### Edge server deploy (62.171.141.136)

| Komponenta | Akce |
|------------|------|
| `zion-pool-server` | Rebuild + deploy (2.98 MB) |
| `zion-node` | Rebuild + deploy (3.02 MB) |
| `/etc/zion/edge-environment.sh` | `ZION_BACKEND_AUTO_INCLUDE_ZION=1`, `ZION_POOL_AUXPOW_SPLIT_EXTERNAL=1` |
| L2/L3 services | Restart (bridge, dao, atomic-swap, warp) |

### Commits

| Commit | Popis |
|--------|-------|
| `48e06c130` | fix(pool): stop session churning from dashboard TCP probes |
| `fcd28a85b` | fix(pool): revert CHV3 algorithm name + fix Zion session job dispatch |

---

## Verifikace

### Block production po fixu

| Blok | Čas (CEST) | Miner | Algorithm |
|------|-----------|-------|-----------|
| 4503 | 14:48:11 | 5070Ti | deeksha_lite_v1 |
| 4504 | 14:50:34 | worker-04 | deeksha_lite_v1 |
| 4505 | 14:52:20 | worker-04 | deeksha_lite_v1 |
| 4506 | 14:55:56 | 5070Ti | deeksha_lite_v1 |
| 4507 | 15:00:24 | worker-04 | deeksha_lite_v1 |

### Metrics po fixu

- `chain_height`: 4502 → 4507 (5 bloků za ~12 min)
- `pool_blocks_found_total`: 5
- `hash_mismatch`: 0 (vs 569 za 24h před fixem)
- `active_sessions`: 3
- `pool_hashrate`: 107K hps (worker-04 + local-miner + 5070Ti)
- `valid_shares`: worker-04=413, local-miner=501

### Služby

| Služba | Status |
|--------|--------|
| zion-node | active |
| zion-node2 | active |
| zion-pool | active |
| zion-bridge | active |
| zion-dao | active |
| zion-atomic-swap | active |
| zion-warp | active |
| zion-dashboard | active |
| zion-dex | active |
| zion-free-world | active |
| zion-issobella | active |
| zion-oasis | active |

---

## Naučené lekce

1. **Soft fork = deploy všech uzlů** — i "bit-identical alias" zlomí chain pokud node binárka neobsahuje nový algorithm name. Vždy rebuild a deploy **všech** nodů před fork height.
2. **force_coin nesmí přepisovat session_group** — když miner explicitně žádá Zion work, force_coin by ho neměl přesměrovat na external coin.
3. **Env var defaults** — `should_issue_external_job` s `split=None` defaultuje na `true` (vždy external). To je nebezpečné — když chybí `ZION_POOL_AUXPOW_SPLIT_EXTERNAL`, pool přestane těžit ZION.

---

## Další kroky

- [ ] Rebuild a deploy `zion-node2` (follower) s novou binárkou
- [ ] Audit všech externích minerů — potvrdit že používají `deeksha_lite_v1`
- [ ] Až budou všechny nody a mineri updatovány, re-enable `deeksha_chv3` name
- [ ] Přidat integration test: pool→node submit s algorithm name dispatch
- [ ] Zvážit `should_issue_external_job` default na `false` když split=None
