# Provenance manifest produkčních binárek (8.S2)

> **Datum:** 2026-11-08
> **Zadání:** 8.S2 — „provenance manifest všech produkčních binárek = release commit".
> **Režim:** kód (build skripty + marker) a read-only sběr. **Žádný build na produkci,
> žádný deploy, žádný restart.** Běžící binárky zůstaly nedotčené.

## 1. Výchozí stav: 10 ze 14 binárek nemělo commit vůbec

`scripts/ops/deploy-provenance.sh` existoval od 2026-10-28 (8.B3) a sbíral `sha256`,
`mtime`, `--version` a repo checkout. Ale build id nesly jen tři binárky
(`zion-pool`, `zion-node`, `zion-cli`) — u zbytku se provenance **odhadovala z mtime**.

Naměřeno dnes (`--verify`):

```
PROVEN=3   node2, node3, zion-v31-node      → fdeda709a
TAGGED=1   zion-v31-pool                    → d786449b0-g8fix
UNKNOWN=10 miner, fallback-miner, dao, multichain, oasis,
           free-world, issobella, ncl, ai-native, hiran-gateway
```

## 2. Co je teď v kódu

Každý produkční crate má vlastní `build.rs` se stejnou resolucí jako pool
(`ZION_GIT_SHA` → `.git-archive-sha` → `git rev-parse` + `-dirty` → `unknown`) a
v `lib.rs`/`main.rs` **statický marker**:

```rust
#[used]
static ZION_BUILD_ID_MARKER: &str = concat!("zion-build-id:", env!("ZION_BUILD_ID"));
```

Jeden souvislý literál v `.rodata` → čitelný **bez spuštění daemona**:

```bash
grep -ao "zion-build-id:[^[:space:]]*" /path/to/binary
```

Pokryté cratey: `L1/{core,pool,miner}`, `cli`, `L2/{dao,multichain}`,
`L3/{ai-native,ncl,hiran-gateway}`, `L4/oasis`, `L5/free-world`, `L6/issobella`.
`warpd` navíc `long_version`, takže i `--version` vypíše `3.2.0 build <sha>`.
Šablona pro další cratey: `V31/deploy/build-id.build.rs`.

**Ověřeno:** `cargo check --workspace` zelené (jen pre-existující warning v `zion-cli`);
`cargo build -p zion-ncl` → v binárce je `zion-build-id:f07b4d583024-dirty`
(`-dirty` je správně, strom byl v tu chvíli necommitnutý).

## 3. `--verify`: díra se hlásí, ne schovává

```bash
bash scripts/ops/deploy-provenance.sh --verify             # tabulka + exit 1
bash scripts/ops/deploy-provenance.sh --verify --strict    # DIRTY/TAGGED = chyba
bash scripts/ops/deploy-provenance.sh --verify --expect=<rc sha>
```

Stavy: `PROVEN` · `TAGGED` (sha + suffix) · `DIRTY` (necommitnutý strom) ·
`UNKNOWN` · `WRONG-COMMIT`. Exit 1 na `UNKNOWN`/`WRONG-COMMIT`, se `--strict`
i na `DIRTY`/`TAGGED`. Klasifikátor je samostatný (`scripts/ops/verify-provenance.py`),
aby se dal použít i na uložený JSONL.

Manifest dneška: `docs/3.2/DEPLOY-PROVENANCE-2026-11-08.jsonl`
(2 hosty, 14 binárek, EDGE checkout `c14f1e4d9` / 8 028 dirty, EDGE2 bez checkoutu).

## 4. Proč to zatím není PASS

Marker je **v kódu**, ale běžící binárky jsou starší než změna. Dokud se cratey
znovu nepostaví a nenasadí, `--verify` vrací exit 1 — a to je správně: nemá se
vydávat odhad za důkaz.

Uzavře se to **RC buildem** (`9.B4`): build s `ZION_GIT_SHA=<rc sha>` (nebo z čistého
stromu, aby nevznikl `-dirty`), deploy, pak `--verify --expect=<rc sha>` musí projít
na všech 14. To je přesně ten „manifest = release commit".

**Trvalý dluh:** EDGE2 nemá git checkout (`checkout:"none"`) — binárky se buildí na
EDGE a rsyncují. Marker to poprvé umožní ověřit per-binárka, ale samotná absence
checkoutu zůstává; alternativou je buildit EDGE2 binárky z pinnutého worktree
(`/opt/zion-rel/build` pattern už v AGENTS je).

## 5. Změny v repu

- `V31/deploy/build-id.build.rs` — šablona build skriptu
- `build.rs` v 8 cratech (dao, multichain, ai-native, ncl, hiran-gateway, oasis, free-world, issobella)
- marker static v `lib.rs`/`main.rs` 12 crateů (8 nových + core/pool/miner/cli)
- `L2/multichain/src/bin/warpd.rs` — `long_version` s build id
- `scripts/ops/deploy-provenance.sh` — sběr `build_id`, režim `--verify`
- `scripts/ops/verify-provenance.py` — klasifikátor (nový)
- `docs/3.2/DEPLOY-PROVENANCE.md` + `DEPLOY-PROVENANCE-2026-11-08.jsonl`

## 6. Co zůstává

- **RC build + deploy** → teprve pak `--verify` projde (8.S2 se uzavírá tam).
- **EDGE2 bez checkoutu** — zvážit build z pinnutého worktree.
- `ZION_GIT_SHA` u ručních buildů zadávat vždy; bez něj vznikne `-dirty` nebo `unknown`
  a verifikace to (správně) odmítne.
