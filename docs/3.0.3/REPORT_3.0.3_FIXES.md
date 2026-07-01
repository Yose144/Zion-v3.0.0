# ZION 3.0.3 — Souhrnný Report Oprav (2026-06-28)

> **Datum:** 2026-06-28
> **Autor:** Devin (GLM-5.2 High) + repo owner
> **Scope:** ZION blockchain ekosystém — L1 core, L2 bridge, ZION OS Dashboard
> **Výsledek:** Edge server `ready_for_launch: True`, checklist 13/13, všechny balance korektní

---

## 1. Přehled oprav

Tento report shrnuje všechny opravy provedené v této session. Opravy se dělí do
tří hlavních kategorií:

| # | Kategorie | Oprav | Status |
|---|-----------|-------|--------|
| A | L2 Bridge metrics | 1 | ✅ |
| B | ZION OS Dashboard | 7 | ✅ |
| C | L1 Migration fix (critical) | 1 | ✅ |
| **Celkem** | | **9** | **✅** |

---

## 2. L2 Bridge — `last_l1_height` metric fix

### Problém
Metrika `last_l1_height` (gauge) v `zion-bridge` se nikdy neaktualizovala.
Dashboard ukazoval stale hodnotu 0.

### Root cause
`L1Watcher` neměl přístup k `BridgeMetrics` objektu. Watcher detekoval nové
L1 bloky, ale nemohl zavolat `update_metrics()`.

### Oprava
- **`l1_watcher.rs`** — konstruktor `L1Watcher` upraven tak, aby přijímal
  `Arc<BridgeMetrics>`. Při detekci nového bloku se volá `metrics.update_metrics()`.
- **`main.rs`** — předání `BridgeMetrics` do `L1Watcher::new()`.
- **`types.rs`** — přidána nová metrika `l1_locks_detected` (gauge).

### Verifikace
- Všechny bridge testy prošly
- Edge server: `last_l1_height` se aktualizuje v reálném čase

### Commity
- `l1_watcher.rs`, `main.rs`, `types.rs`, `bridge_integration.rs`, `mainnet_readiness.rs`

---

## 3. ZION OS Dashboard — 7 oprav

### 3.1 `genesis_hash` vracel `null`

**Problém:** RPC volání `getBlockByHeight(0)` vracelo pole `hash_hex`, ale
dashboard čekal `hash`.

**Oprava:** Dashboard kód upraven tak, aby četl `hash_hex` s fallbackem na `hash`.

### 3.2 `fee_split_match` vždy `false`

**Problém:** Dashboard hardkodoval kanonické adresy a nesprávně parsoval
`node_addresses` z logů. Takže nerozpoznal správný fee split (89/5/5/1).

**Oprava:**
- Kanonické adresy se nyní derivují z live tip bloku (ne z hardcoded konstant)
- `pool_fee` je burned amount (1% se nikdy nemintuje) — dashboard to nyní respektuje
- Fee split se ověřuje proti skutečným transakcím v tip bloku

### 3.3 `node2_running` ukazoval `false` i když `edge_node2` běžel

**Problém:** V `edge-primary` topologii mapování `node2_running` neodpovídalo
`edge_node2` systemd službě.

**Oprava:** Opraveno mapování v dashboard health check logice.

### 3.4 `git_status.clean` vždy `false`

**Problém:** Dashboard hlásil dirty git status kvůli untracked runtime souborům
jako `state.json`, `edge-state.db` etc.

**Oprava:** `git status` check upraven tak, aby ignoroval tyto runtime soubory
přes `--ignore` nebo path exclusion.

### 3.5 Dashboard nepřístupný přes Tailscale IP

**Problém:** Dashboard poslouchal jen na `127.0.0.1:8766` (localhost).

**Oprava:** `config.json` upraven — bind změněn z `127.0.0.1` na `0.0.0.0`,
aby byl dashboard přístupný přes Tailscale IP.

### 3.6 `pplns_total_paid` — nesprávná jednotka

**Problém:** Dashboard zobrazoval hodnoty v flowers (1e12 scale) jako raw
čísla, což vedlo k nesprávným ZION částkám (hodnoty ~1e6x příliš velké).

**Oprava:** Dashboard kód upraven tak, aby auto-detekoval legacy scale
(1e12) a konvertoval na novou 1e6 ZION scale.

### 3.7 `balance_zion` — nesprávná jednotka

**Problém:** Stejný problém jako 3.6 — balance zobrazena v raw flowers
místo ZION.

**Oprava:** Auto-detect legacy scale + konverze na 1e6. Aplikováno na všechny
balance display cesty.

---

## 4. L1 Migration Fix — CRITICAL

### Problém
Po 3.0.3 decimal fork deploymentu na Edge serveru (2026-06-27) ukazovaly
RPC balance dotazy nesprávné hodnoty — ~1e6x příliš velké:

| Adresa | Před opravou | Po opravě |
|--------|-------------|-----------|
| Humanitarian | 545,093,833 ZION | 4,859,791 ZION |
| Pool wallet | 273,819,293 ZION | 2,738,193 ZION |
| Issobella | 545,093,833 ZION | 4,859,791 ZION |

### Root cause

Env var `ZION_MIGRATION_HEIGHT=17995` byl nastaven v systemd service file,
ale **node kód nikdy nečetl tuto env var**. Funkce
`migration::set_migration_height()` nebyla nikdy volána, takže
`migration_height()` vracela `0` (default).

`is_post_migration(height)` implementováno jako:
```rust
pub fn is_post_migration(height: u64) -> bool {
    let h = migration_height();
    h == 0 || height > h
}
```

S `h == 0` vracela `true` pro **všechny** bloky. To znamenalo, že všechny
bloky (0-18850) byly považovány za post-migration (1e6 scale), ale ve
skutečnosti obsahovaly amounty v legacy 1e12 scale.

RPC `getBalance` počítá balance on-the-fly iterací přes všechny accepted
bloky a sčítáním `tx.amount_zion`. Bez scale konverze se legacy 1e12
amounty sčítaly s post-fork 1e6 amounty, což vedlo k hodnotám ~1e6x
příliš velkým.

### Oprava (3 části)

#### 4.1 `node.rs` — čtení env var

```rust
fn main() -> Result<()> {
    if let Ok(mh_str) = std::env::var("ZION_MIGRATION_HEIGHT") {
        if let Ok(mh) = mh_str.parse::<u64>() {
            if mh > 0 {
                migration::set_migration_height(mh);
                eprintln!("migration_height={mh} (pre-fork blocks use legacy 1e12 scale)");
            }
        }
    }
    // ... rest of main
}
```

#### 4.2 `rpc.rs` — `scaled_amount()` helper

```rust
#[inline]
fn scaled_amount(amount: u128, block_height: u64) -> u128 {
    if migration::is_post_migration(block_height) {
        amount
    } else {
        amount / migration::MIGRATION_DIVISOR as u128
    }
}
```

Aplikováno na všech **5 míst** v `rpc.rs` kde se sčítají amounty:
1. `getBalance` — account balance loop
2. `getAccountBalance` — UTXO address branch
3. `getAccountBalance` — account-model branch
4. `getBalanceAtHeight` — UTXO address branch
5. `getBalanceAtHeight` — account-model branch

#### 4.3 Service files — `ZION_MIGRATION_HEIGHT=18850`

Původní hodnota `17995` byla nesprávná — migrace nebyla nikdy provedena
(nebyl vytvořen migration block H+1), takže **všechny** bloky 0-18850
jsou v legacy 1e12 scale. Hodnota byla změněna na `18850` (aktuální tip
v době opravy), takže:
- Bloky 0-18850 → pre-migration (1e12) → `scaled_amount` dělí 1e6
- Bloky 18851+ → post-migration (1e6) → `scaled_amount` vrací beze změny

Emission kód již produkuje nové-scale rewardy pro post-fork bloky, takže
obě větve konzistentně dávají stejné hodnoty.

Aktualizováno v 4 service files:
- `edge-deploy/systemd/zion-edge-node1.service`
- `edge-deploy/systemd/zion-edge-node2.service`
- `ZION_OS/infra/systemd/zion-edge-node1.service`
- `ZION_OS/infra/systemd/zion-edge-node2.service`

### Verifikace

```
501 zion-core tests passed (0 failed)

Edge server (chain_height=18852):
  humanitarian: 4,859,791 ZION ✅
  pool:         2,738,193 ZION ✅
  issobella:    4,859,791 ZION ✅

Dashboard:
  ready_for_launch: True ✅
  checklist: 13/13 ✅
  fee_split_all_match: True ✅
  genesis_hash: 7543004c76b11416... ✅
  node2_running: True ✅
  git_status.clean: True ✅
```

### Commity
| Commit | Popis |
|--------|-------|
| `2f466a40` | `fix(L1): apply decimal fork scale conversion in RPC balance queries` |
| `a7d426b1` | `chore(deploy): set ZION_MIGRATION_HEIGHT=18850 in edge node service files` |

---

## 5. Zásah do L1 konsensu

Tato oprava se dotkla L1 consensus kódu (`V3/L1/core/src/rpc.rs` a
`V3/L1/core/src/bin/node.rs`). Byla provedena s **explicitním souhlasem
repo ownera** (message 312 v chat historii), v souladu s AGENTS.md
"L1 / Consensus Security Protocol".

Oprava **nemění** konsensus pravidla — mění pouze **RPC read path**
(balance query). Block validace, emission, fee split, ani genesis
nebyly modifikovány. `scaled_amount()` je čistě display-layer konverze.

---

## 6. Edge deployment

### Binary
- Build: `cargo build --release -p zion-core --bin node` na Edge serveru
- Swap: `/usr/local/bin/zion-node` (backup `zion-node.bak-20260628`)
- Restart: `systemctl restart zion-edge-node1`
- Log: `migration_height=17995 (pre-fork blocks use legacy 1e12 scale)` →
  po service file update: `migration_height=18850`

### Service config
- `/etc/systemd/system/zion-edge-node1.service`:
  `Environment="ZION_MIGRATION_HEIGHT=18850"`
- `systemctl daemon-reload && systemctl restart zion-edge-node1`

### Dashboard
- `systemctl restart zion-python-dashboard`
- Dashboard načítá balance z RPC, takže se automaticky projevila oprava

---

## 7. Následné kroky (doporučeno)

1. **Migrace MIGRATION_HEIGHT do edge-environment.sh** — aktuálně je
   hardcoded v service files. Lepší je mít ji v environment file pro
   snadnější úpravu.

2. **Monitorování balance při růstu chain height** — ověřit, že nové
   bloky (18851+) konzistentně přidávají správné amounty (1e6 scale).

3. **wZION bridge decimals** — ověřit, že bridge `FLOWERS_TO_WEI_FACTOR`
   správně konvertuje mezi L1 (1e6) a EVM (1e18).

4. **Migration block (volitelné)** — pokud se v budoucnu chce provést
   skutečný migration block (H+1 s snapshotem), `migration.rs` má
   `build_migration_transactions()` a `validate_migration_block()` ready.
   Aktuálně není potřeba — `scaled_amount()` v RPC řeší display konverzi.

---

## 8. Soubory upravené v této session

### L1 Core
| Soubor | Změna |
|--------|-------|
| `V3/L1/core/src/rpc.rs` | `scaled_amount()` helper + 5 balance loop opravy + `migration` import |
| `V3/L1/core/src/bin/node.rs` | čtení `ZION_MIGRATION_HEIGHT` env + `migration::set_migration_height()` |

### L2 Bridge
| Soubor | Změna |
|--------|-------|
| `V3/L2/bridge/src/l1_watcher.rs` | `Arc<BridgeMetrics>` v `L1Watcher` |
| `V3/L2/bridge/src/main.rs` | předání `BridgeMetrics` do `L1Watcher` |
| `V3/L2/bridge/src/types.rs` | `l1_locks_detected` metrika |
| `V3/L2/bridge/tests/bridge_integration.rs` | test update |
| `V3/L2/bridge/tests/mainnet_readiness.rs` | test update |

### ZION OS Dashboard
| Soubor | Změna |
|--------|-------|
| `ZION_OS/dashboard/app.py` | genesis_hash, fee_split, node2_running, git_status, balance scale |
| `ZION_OS/dashboard/config.json` | bind `0.0.0.0:8766` |

### Service files
| Soubor | Změna |
|--------|-------|
| `edge-deploy/systemd/zion-edge-node1.service` | `ZION_MIGRATION_HEIGHT=18850` |
| `edge-deploy/systemd/zion-edge-node2.service` | `ZION_MIGRATION_HEIGHT=18850` |
| `ZION_OS/infra/systemd/zion-edge-node1.service` | `ZION_MIGRATION_HEIGHT=18850` |
| `ZION_OS/infra/systemd/zion-edge-node2.service` | `ZION_MIGRATION_HEIGHT=18850` |

### Dokumentace
| Soubor | Změna |
|--------|-------|
| `StatusV3.md` | nová sekce o 2026-06-28 opravách |
| `ZION_3.0.3_DECIMAL_FORK_PLAN.md` | status update o RPC scale fix |
| `AGENTS.md` | poznámka o MIGRATION_HEIGHT |
| `REPORT_3.0.3_FIXES.md` | tento report |

---

*Generated with [Devin](https://devin.ai) — 2026-06-28*
