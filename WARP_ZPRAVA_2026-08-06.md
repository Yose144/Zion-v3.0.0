# Zpráva z testování WARP non-EVM adaptérů na devnet/testnet

> **Datum:** 2026-08-06  
> **Cíl:** ověřit Solana (devnet), Stellar (testnet) a Bitcoin (testnet) adaptéry v `V31/L2/multichain` bez odeslání mainnet transakcí.  
> **Testovací prostředí:** lokální `warpd` s `warp.test.toml` (`quorum = 1`, povolené `solana`, `stellar`, `bitcoin`).  
> **Testovací klíče a env:** `/tmp/zion-warp-test/secrets.env` — necommitované, mimo repo.

## Shrnutí

| Chain | Stav | Co bylo testováno | Výsledek |
|-------|------|-------------------|----------|
| **Stellar** | ✅ **OK** | `watch_events` + `execute_mint` | Live mint 0.001 ZION na testnet proběhl úspěšně. |
| **Solana** | 🟡 **částečně** | `watch_events` | Polling OK, 0 BridgeBurn proofů. Live `mint_to` nelze — devnet faucet vrací `429` a relay nemá SOL. |
| **Bitcoin** | 🟡 **částečně** | `watch_events` | Polling OK, 0 HTLC depositů. Live `execute_mint` nelze — testnet address má 0 UTXO a chybí P2WSH HTLC. |

Celkově `V31/L2/multichain` kompiluje a prochází testy. Opraveny kompilace `zion-pool` a drobný clippy warning ve WARP executoru.

## Stellar testnet — ✅ `execute_mint` PASS

- **Issuer / bridge / relay:** `GC4SGOGJWQGBSPJOM5M3RXVWLKWWAZIF4NNPVA4TTBWN36ZW6J7AMEDS`
- **Distribution test account:** `GCSGJDBBDQVLNCEJGAUJ2SBZNCDL4G7HBVD6N2MT754LPZZIIF5TS3KV`
- **Asset:** `ZION`
- **Horizon:** `https://horizon-testnet.stellar.org`
- **Soroban RPC:** `https://soroban-testnet.stellar.org`
- **Testovací množství:** `0.001 ZION` = `1 000` stroops
- **Poslední úspěšný mint TX:** `2cbe550fe7730d2c06abf5ab58c290f95962e39a39c471c7c56881c51c68d34e`

Provedení:

1. Vygenerován testovací Stellar issuer (= relay) a distribution account.
2. Issuer a distribution zafundovány přes Friendbot.
3. Distribution vytvořil trustline na `ZION/GC4SG...`.
4. Issuer poslal 1 ZION na distribution account (tx `84753ccfba2240c7b64c0aec3571cd0244fe5410e8791ee2cbf8502419118d04`).
5. Spuštěn test `test_stellar_execute_mint_live_testnet` v `V31/L2/multichain/src/warp/adapter/stellar.rs`.
6. Adaptér úspěšně poslal `0.001 ZION` z relaye (= issuer) na distribution account.

Relay secret key je uložen pouze v `/tmp/zion-warp-test/secrets.env` a v Edge `EnvironmentFile`, **nikdy v repu**.

## Solana devnet — 🟡 polling OK, mint neotestován

- **Relay public key:** `4J2FRDrHFihJ3QdjF3eLAQ7tZDagyAsgVcKFDh7xdmr3`
- **Placeholder mint:** `3XtfWPaLQTLrjTT6hhzo6WVZP73KmW2JpQnU8iaVwLEU`
- **RPC:** `https://api.devnet.solana.com`
- **Výsledek:**
  - `warpd` správně polluje devnet a hlásí `0 BridgeBurn proofs`.
  - Relay má `0` lamportů.
  - Pokus `requestAirdrop` vrátil `429` („faucet dry / rate-limited“).
  - Pro live `mint_to` je potřeba:
    1. získat devnet SOL (jiný faucet nebo cli `solana airdrop` později),
    2. vytvořit / nasadit reálný SPL token mint,
    3. nastavit `WARP_SOLANA_ZION_MINT` na reálnou mint adresu (nyní použitý relay public key je jen placeholder).

## Bitcoin testnet — 🟡 polling OK, spend neotestován

- **Relay / HTLC watch address:** `tb1qjkq5gmqp4rm2yj4zefjvw63p3mxle86leflq4z`
- **API:** `https://mempool.space/testnet/api`
- **Výsledek:**
  - `warpd` správně polluje testnet a hlásí `0 HTLC deposits`.
  - Address má `0` UTXO.
  - Pro live `execute_mint` je potřeba:
    1. získat testnet BTC z faucetu,
    2. vytvořit a nasadit reálný P2WSH HTLC script,
    3. nastavit `WARP_BITCOIN_HTLC_ADDRESS` na HTLC address (nyní je to jen P2WPKH relay address).

## Provedené kódové změny

- `V31/L2/multichain/src/warp/adapter/stellar.rs`
  - Přidán `#[ignore]` live test `test_stellar_execute_mint_live_testnet`.
- `V31/L2/multichain/src/warp/executor.rs`
  - Odstraněn zbytečný `as u128` cast (clippy `unnecessary_cast`).
- `V31/L1/pool/src/stratum.rs`
  - Oprava destrukturování `JobEntry` (`_reward` → `reward`).
  - Přidán `use std::net::SocketAddr;` pro fix kompilace.
- `docs/3.0.5/CONTRACT_ADDRESSES.md`
  - Nová kapitola `§9 Testnet Smoke-Test Log (2026-08-06)`.
- `V31/L2/multichain/contracts/non-evm/DEPLOY.md`
  - Nová sekce `Testnet Smoke-Test Notes (2026-08-06)`.
- `StatusV3.md`
  - Aktualizována sekce `WARP (Non-EVM)` o výsledky testu.

## Testovací klíče a konfigurace

Všechny testovací privátní klíče (Solana relay, Stellar relay, Bitcoin WIF) a `warp.test.toml` jsou uloženy v `/tmp/zion-warp-test/` — **mimo repozitář** a nebudou commitnuty.

## Verifikace

Příkazy spuštěny pro kontrolu:

```bash
cd /home/zionserver/2.9.6-main/V31
cargo test -p zion-multichain   # 571 testů PASS
cargo test -p zion-pool         # 160 testů PASS
cargo test                      # celý workspace PASS
cargo clippy -p zion-multichain # PASS (pouze pre-existing warningy)
```

## Další kroky

1. **Stellar:** přidat 5/5 multi-sig validátorů, připravit mainnet issuer, provést mainnet deploy dle `DEPLOY.md`.
2. **Solana:** získat devnet SOL, vytvořit SPL token mint s WARP mint authority, otestovat `mint_to` na devnet.
3. **Bitcoin:** získat testnet BTC, sestavit a nasadit P2WSH HTLC script, otestovat `execute_mint`.
4. **Edge deploy:** aktualizovat `/root/.env.warp` reálnými klíči a adresami, restartovat `zion-v31-multichain`.
5. **Dokumentace:** po každém live deployi doplnit `CONTRACT_ADDRESSES.md` a `DEPLOY.md` o produkční adresy a tx hashe.

## Závěr

WARP Stellar adaptér je na testnetu funkční a prokázal schopnost poslat ZION z relaye (= issuer) na cílový account. Solana a Bitcoin adaptéry správně komunikují s veřejnými testnet endpointy, ale potřebují externí funding a reálné kontrakty/minty pro plný live test. Workspace `V31` je po těchto změnách kompilovatelný a všechny testy procházejí.
