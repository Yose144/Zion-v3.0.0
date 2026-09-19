# WARP Beta — ZION ↔ BTC Native Atomic Swap

> **Status:** **implementováno + audit-prep hotový** (2026-09-20) — regtest E2E oba směry + refundy + restart recovery zelené, live mainnet ZION leg SETTLED (`d77f837a` lock → `8c60d064` claim). Na Edge běží env-gated (`WARP_BTC_SWAP_ENABLED`); mainnet enable čeká na externí audit + produkční `WARP_BTC_RELAY_KEY`.
> **Zdroj konceptu:** [`Lithing.md`](./Lithing.md) + ChatGPT výzkum „Zion L6" (strategický závěr: před bullrunem prioritizovat nativní ZION/BTC WARP před dalšími vrstvami)

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

Atomarita je kryptografická, ne důvěryhodná — nikdo nemůže ztratit prostředky, maximálně je má zamčené do timeoutu.

## Scope WARP Beta

| In scope | Out of scope (zatím) |
|---|---|
| ZION ↔ BTC on-chain HTLC swap | Lightning Network (až WARP 0.3) |
| Regtest → testnet/mainnet pilot E2E | EVM/Solana/další chainy (wZION bridge je separátní stack) |
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
| BTC swap API | `warpd` :8454 `/v1/multichain/swaps/btc/*` (fail-closed auth) | ✅ live na Edge |
| LN klient | `V31/L2/multichain/src/warp/adapter/lightning.rs` + `docker/lightning/` | 🟡 disabled (WARP 0.3) |
| HTLC HTTP API | `warpd` :8454 `/v1/multichain/swaps/htlc/*` | ✅ live na Edge |
