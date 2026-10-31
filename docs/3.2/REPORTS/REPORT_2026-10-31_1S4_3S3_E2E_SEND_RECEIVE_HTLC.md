# 1.S4 + 3.S3 — Release evidence: E2E send/receive + HTLC refund

**Datum:** 2026-10-31 · **Audit items:** 1.S4, 3.S3 (sdílené) · **Verdikt: PASS**

## Scope

> 1.S4: „Release evidence: E2E send/receive bez secrets na release commitu (Registr důkazů L1)"
> 3.S3: „E2E send/receive + HTLC refund v release evidence (sdíleno s 1.S4)"

## 1. E2E send/receive — `e2e_send_receive_full_node_path` (nový)

**Lokace:** `V31/L1/core/src/node.rs` (test modul) · **Runtime:** 234 s · **Secrets:** žádné (fresh regtest keypairs)

Plná node cesta, stejná disciplína jako `premine_unlock_dry_run_full_node_path` (1.B5):

1. Regtest node (`:memory:` db, reálná konsensuální validace)
2. Wallet A = fresh `generate_keypair` → coinbase funding → maturity 100 bloků (konsensuální konstanta, žádný bypass)
3. `v31_wallet::build_send` (produkční wallet builder — UTXO select, fee, change, Ed25519 podpis) — A → B `21_000_000` atomic + fee `1_000_000`
4. `submit_utxo_transaction` → mempool accept (premine/maturity/double-spend/size gates)
5. Receive-side assert před confirmem: **B prázdné** (žádná mempool viditelnost v UTXO view)
6. Mined → `get_utxos_for_address(B)` = **přesně send_amount** v txid outputs; A = **balance − amount − fee**

```
cargo test -p zion-core --lib e2e_send_receive -- --ignored
test node::tests::e2e_send_receive_full_node_path ... ok (234.38s)
```

`#[ignore]` default = regtest minuje ~107 bloků; spouští se explicitně pro release evidence běh (stejný pattern jako 1.B5 dry-run).

## 2. HTLC refund — regression suite (existující, re-run na HEAD)

`V31/L2/multichain/src/swap/htlc.rs` + `warp/btc_htlc.rs` — **45/45 PASS** na release commitu:

| Oblast | Evidence |
|---|---|
| Timelock | `refund_fails_before_timelock`, `refund_succeeds_after_timelock` |
| Refund↔claim exclusion | `claim_fails_after_refund`, `refund_after_terminal_claim_rejected` |
| Claim-before-send (1.B2) | `refund_in_flight_blocks_refire`, `claim_in_flight_blocks_reclaim_and_refund`, `refunding_survives_restart_and_blocks_refire` (persist `Refunding`/`Claiming` PŘED ambiguous chain call — crash → park, žádný auto-resend) |
| Persistence | `htlc_refund_persists_to_db`, `htlc_persists_and_reloads_from_db` |
| BTC wire | `refund_tx_has_cltv_locktime`, `extract_preimage_rejects_refund_witness`, `claim_sig_verifies_against_sighash`, `script_build_parse_roundtrip` |
| API pinning | `htlc_refund_public_pins_locker_and_expiry`, `htlc_claim_public_pins_recipient_to_committed_claimant` |

```
cargo test -p zion-multichain --lib htlc → 45 passed; 0 failed (0.23s)
```

## Reprodukce na release commitu

```bash
cd V31
cargo test -p zion-core --lib e2e_send_receive -- --ignored   # ~4 min, E2E send/receive
cargo test -p zion-multichain --lib htlc                      # 45 refund/claim regresí
```

## Verdikt

**PASS** — E2E send/receive běží na reálné node cestě bez secrets (nový `--ignored` test), HTLC refund matrix pokryt 45 regresemi včetně claim-before-send failure modes z 1.B2. Oba artefakty reprodukovatelné na release commitu = Registr důkazů L1 položka splněna.
