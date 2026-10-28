# REPORT — Premine Unlock Dry-Run (1.B5)

> **Tanggal:** 2026-10-27
> **Task:** `1.B5` — Premine unlock dry-run `build_admin_unlock_tx` 3-of-3 → `getAdminUnlocks`, sebelum height 144 000.
> **Hasil:** ✅ PASS — mekanisme unlock terverifikasi end-to-end di jalur node asli.
> **Referensi:** [`PREMINE_UNLOCK.md`](../PREMINE_UNLOCK.md)

---

## 1. Scope dry-run

Dry-run merehearse prosedur operasional `PREMINE_UNLOCK.md` di node sungguhan
(`zion-core` `Node`, SQLite `:memory:`, `soft_fork_activation_height = 0`):

1. **Fund admins** — 3 admin test didanai via block reward nyata (2 coinbase
   per admin, menunggu `COINBASE_MATURITY = 100` blok).
2. **Gate sebelum unlock** — spend premine via `submit_utxo_transaction` →
   `PremineLocked` ✅ (mempool gate menolak sebelum ada otorisasi).
3. **Broadcast unlock** — tx 3-of-3 (`ZION:ADMIN_UNLOCK:v1:<target>:<ref>`,
   input `sig || pubkey` per admin — bentuk wire identik dengan output
   `build_admin_unlock_tx`) masuk mempool → termine di blok berikutnya.
4. **`getAdminUnlocks`** — `utxo_set.is_admin_unlocked(target)` = `true`;
   `admin_unlocked()` (yang dilayani RPC `getAdminUnlocks` di semua node)
   memuat target ✅.
5. **Spend gate terbuka** — `validate_premine_and_maturity_for_tx` lolos ✅.
6. **DAO treasury slot** — slot `unlock_height = 144_000`: admin unlock
   tercatat on-chain, tapi spend tetap `PremineLocked` di bawah height gate;
   lolos di ≥144 000 ✅ — mengonfirmasi dua lapis kunci berjalan independen.

Test: `node::tests::premine_unlock_dry_run_full_node_path`
(`V31/L1/core/src/node.rs`). `#[ignore]` karena menambang ~107 blok nyata
(~3 menit) — maturity coinbase adalah konstanta konsensus.

```bash
cargo test -p zion-core --lib premine_unlock_dry_run -- --ignored
# → ok (172 s pada mesin build lokal, 2026-10-27)
```

Coverage terkait yang sudah ada (tetap hijau di run yang sama, 8/8):
`premine_spend_allowed_after_admin_unlock_tx` (gate 3-of-3 vs 2-of-3),
`unlock_survives_utxo_set_rebuild` (set direkonstruksi via replay →
restart-safe + identik di semua node), `build_admin_unlock_tx` rejection
tests (non-admin input, thin quorum, key↔address mismatch, unknown target),
`admin_unlock_memo` parser tests.

## 2. Temuan

- Tidak ada bug — path bekerja sesuai spec `PREMINE_UNLOCK.md`.
- `submit_utxo_transaction` menjalankan `validate_premine_for_mempool`
  **sebelum** cek signature → spend premine palsu (tanpa key) tetap terdeteksi
  sebagai `PremineLocked`, bukan error signature — gate adalah konsensus,
  bukan policy wallet.
- DAO slots 6–8 (`unlock_height = Some(144_000)`) aman dari "unlock lebih
  awal": flag admin terekam tapi height gate menahan sampai ≥144 000.

## 3. Batasan dry-run

- **Bukan tanda tangan asli** — `build_admin_unlock_tx` sengaja menolak input
  non-kanonikal + key↔address mismatch, jadi dry-run memakai admin test
  (`set_admin_addresses_for_test`) dengan bentuk wire identik. Eksekusi live
  dengan key Rama/Sita/Hanuman asli tetap 👤 operator (keys offline by design).
- **Single-node** — penyebaran set antar node via replay block (bukan state
  sync); determinisme replay diverifikasi `unlock_survives_utxo_set_rebuild`.

## 4. Checklist eksekusi LIVE (👤 operator, saat ≈144k)

1. Semua validator (EDGE2 primary + follower node2/node3) pakai binary yang
   mengandung unlock path — **deploy dulu baru broadcast** (node lama reject
   spend premine → mixed network stall).
2. Governance: `AdminProposal` (TreasurySpend) 3-of-3 + timelock + DAO vote →
   catat `proposal_id` sebagai `<ref>` memo.
3. Fund 3 admin address (dust ~0.01 ZION) — perlu UTXO spendable di masing-
   masing.
4. `build_admin_unlock_tx(admin_inputs, refund_addr, <slot>, Some(proposal_id), fee)`
   — masing-masing admin sign `signing_hash` offline.
5. Broadcast `submitUtxoTransaction` → tunggu confirm.
6. **Verifikasi di SEMUA node:** `getAdminUnlocks` → `unlocked` memuat target
   (EDGE2 :9445, node2 :9446, node3 :9447) — bukan hanya di node broadcast.
7. Baru submit spend premine. Unlock permanen & address-scoped — sweep sisa
   dana ke address baru setelahnya.

## 5. Risiko tersisa

- **Block time** — 144 000 tiba ~27–28 Nov; unlock hanya efektif jika tx
  termine — submit beberapa blok sebelumnya agar aman.
- **Unlock = one-way door** — tidak ada re-lock; jangan unlock slot yang
  tidak segera dipakai.

## 6. Live readiness check (2026-10-28)

Ověřeno na produkci:

| Předpoklad | Stav |
|---|---|
| Validatory běží unlock path | ✅ :9445/:9446/:9447 vše `node_version 3.2.0`, tip `bbd24779…` sync, `getAdminUnlocks` → canonical V2 set (Rama `zion1s4t4…`, Sita `zion1l6p5…`, Hanuman `zion18693…`) |
| Aktuální výška | 100 054 — zbývá **43 946 bloků** |
| Reálný block time | ~57.9 s (změřeno 54 bloků) → **ETA ≈ 27. 11. 2026** (±1 d) |
| Admin funding (krok 3) | ❌ **všechny 3 admin adresy mají 0 UTXO** — před exekucí nutno poslat dust ~0.01–0.05 ZION na každou (z `zion1d2k` payout treasury nebo jiného funded walletu; = 👤 pohyb prostředků). Bez spendable UTXO nemůže admin podepsat unlock input. |
| DAO guardians V2 | ✅ 5-of-7 ověřeno 27.10 (dao config EDGE2) |

**K vyřízení před ~144k (👤):** admin dust funding ×3 (ideálně s předstihem — coinbase maturity není potřeba pro normální UTXO), potom submit unlock tx ~50–100 bloků před gatem (jistota inclusion).
