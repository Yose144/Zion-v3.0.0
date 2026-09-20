# WARP Beta — ZION ↔ BTC Native Atomic Swap

> **Status:** **SAFETY HOLD** (2026-09-20). Historický regtest E2E baseline je zelený, ale Edge BTC swap flow je vypnutý (`WARP_BTC_SWAP_ENABLED=0`) kvůli P0 mezeře v autorizaci ekonomických podmínek offeru. Lokální hardening je pending full-suite gate a Edge deploy. Re-enable/mainnet pilot navíc blokuje externí audit, server-side signed quote/pricing/approval, dedikovaný offer key, dokončený bitcoind IBD a production WIF review.
> **Zdroj konceptu:** [`Lithing.md`](./Lithing.md); aktuální provozní rozhodnutí jsou pouze v [`STATUS.md`](./STATUS.md) a [`AUDIT_PREP.md`](./AUDIT_PREP.md).

## Cíl

**Trustless atomický swap ZION ↔ BTC** — bez custodians, bez wrapped tokenů, bez centrální burzy.

```text
   ZION L1                     Bitcoin
   ───────                     ───────
   HTLC lock   ◄── H = SHA256(S) ──►   HTLC lock
   (native)                         (P2WSH script)
        │                               │
        └────── preimage S reveals ─────┘
                     atomic
```

Klíčový předpoklad je **splněn**: ZION L1 má nativní, konsensem vynucovaný HTLC (SHA-256 hashlock + timestamp timeout + Ed25519 claim/refund), nasazený a E2E ověřený na Edge mainnetu 2026-08-23.

## Princip (1 strana)

1. Alice má ZION, Bob má BTC. Alice vygeneruje secret `S` (32 B) a publikuje `H = SHA256(S)`.
2. Bob uzamkne BTC do HTLC outputu: claim vyžaduje preimage `S` + podpis Alice, refund po timeoutu Bobovi.
3. Alice uzamkne ZION do nativního HTLC outputu se stejným `H`: claim pro Boba s `S`, refund po timeoutu Alici.
4. Bob claimne ZION tím, že odhalí `S` on-chain → Alice přečte `S` z claim tx a claimne BTC.
5. Pokud se swap nedokončí, oba timeouty vrátí prostředky původním vlastníkům.

HTLC atomarita omezuje counterparty risk mezi dvěma správně vytvořenými legy, ale nechrání před implementační chybou, nesprávným timeoutem ani ekonomicky neautorizovaným offerem. Proto zůstává externí audit a server-side schválení podmínek povinným gate.

## Scope WARP Beta

| In scope | Out of scope (zatím) |
|---|---|
| ZION ↔ BTC on-chain HTLC swap | Lightning Network (až WARP 0.3) |
| Regtest E2E + bezpečnostní hardening | Mainnet pilot před uzavřením safety gates; EVM/Solana/další chainy |
| `warpd` orchestrace + CLI | DEX UI, marketplace integrace |
| Per-swap P2WSH adresy | Automatický solver/market-maker |

## Dokumenty

| Soubor | Obsah |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Technický design: oba HTLC scripty, swap flow, timeout parametry, API |
| [`STATUS.md`](./STATUS.md) | Gap analýza — HOTOVO / ROZPRACOVÁNO / CHYBÍ / BLOCKER |
| [`ROADMAP.md`](./ROADMAP.md) | Fáze WARP 0.1 → 0.2 → 0.3 → 1.0, milníky, testnet plán |
| [`AUDIT_PREP.md`](./AUDIT_PREP.md) | Self-audit findings log + auditor checklist + pre-mainnet checklist |

## Klíčové soubory v repo

| Komponenta | Soubor | Stav |
|---|---|---|
| L1 HTLC konsensus | `V31/L1/core/src/utxo.rs` (`verify_input`, script `0x01`) | ✅ mainnet |
| L1 HTLC buildery | `V31/L1/core/src/v31_wallet.rs` (`build_htlc_{lock,claim,refund}`) | ✅ |
| Swap koordinátor | `V31/L2/multichain/src/swap/htlc.rs` (`HtlcSwap`) | ✅ |
| Swap orchestrátor | `V31/L2/multichain/src/warp/btc_swap.rs` (`BtcSwapFlow`, oba směry) | ✅ |
| ZION adapter | `V31/L2/multichain/src/chain/adapters/zion_l1.rs` | ✅ |
| BTC HTLC modul | `V31/L2/multichain/src/warp/btc_htlc.rs` (P2WSH 13-op script) | ✅ |
| BTC adapter (watch) | `V31/L2/multichain/src/warp/adapter/bitcoin.rs` (per-swap detekce + multi-endpoint failover) | ✅ |
| BTC signer | `V31/L2/multichain/src/warp/btc_signer.rs` (P2WPKH + HTLC claim/refund) | ✅ |
| BTC swap API | `warpd` :8454 `/v1/multichain/swaps/btc/*` | Edge flow disabled + hardened binary nasazená (offer fail-closed bez `WARP_BTC_SWAP_OFFER_KEY`) |
| LN klient | `V31/L2/multichain/src/warp/adapter/lightning.rs` + `docker/lightning/` | 🟡 disabled (WARP 0.3) |
| HTLC HTTP API | `warpd` :8454 `/v1/multichain/swaps/htlc/*` | ✅ live na Edge |
