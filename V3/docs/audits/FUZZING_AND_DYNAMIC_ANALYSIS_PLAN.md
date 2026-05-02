# Dynamická analýza & fuzz — plán (audit §8 doplněk)

Interní audit §8 uváděl mimo scope **fuzzing** `validate_peer_block` / `insert_utxo_transaction`.
Tento dokument řadí práci po blocích tak, aby šla paralelně s externím auditem.

---

## Fáze 0 — infrastruktura

- `cargo install cargo-fuzz` (vyžaduje nightly toolchain pro některé targety).
- V adresáři `V3/L1/core/` inicializovat `cargo fuzz init` (necommitovat dokud nejsou stabilní seed corpus a CI slot).

---

## Fáze 1 — levné targety

- Binární / serde dekódery kde vstup přichází z P2P nebo RPC (bez nutnosti celého `ChainState`).
- `crypto::merkle_root` nad náhodnými leaf vektory (invarianty sudého počtu duplikátů).

---

## Fáze 2 — stavové fuzzery

- Harness s minimálním `ChainState` fixture (fixní genesis + několik bloků), pak mutace tx řetězců vstupujících do `insert_utxo_transaction`.
- Oddělený harness pro část peer pipeline (`validate_accepted_peer_block`) s mock snapshots (`accepted_blocks`, `utxo_set`).

**Poznámka:** vyžaduje refaktoring pro injektovatelný stav — koordinovat s maintainery před velkým merge.

---

## Fáze 3 — kontinuální běh

- Krátký (`max_total_time`) job v CI nebo nightly cron s artefaktem crash corpus.
- Politika: každý crash → regression test před uzavřením ticketu.

---

## Související

- Playbook položky 1–6: [`../operational/AUDIT_CLOSEOUT_1_THROUGH_6.md`](../operational/AUDIT_CLOSEOUT_1_THROUGH_6.md).
