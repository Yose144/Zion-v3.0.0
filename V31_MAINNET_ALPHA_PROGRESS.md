# V31 Mainnet Alpha — průběžný report (2026-07-27)

> **Poznámka k rozsahu:** Tato práce probíhá v `V31/` jako čistá přípravná větev pro budoucí migraci. Dle `AGENTS.md` je aktivní mainnet-track zatím `V3/` a plná V31 migrace je plánována až po `3.0.9`. Všechny změny v tomto souhrnu jsou v `V31/`; `V3/`, `AuXpow/` a `APP&WEB/` zůstaly nedotčené.

## Co bylo dnes hotovo

### 1. `V31/L1/miner` — Triple Stream merged mining
- Nový crate `zion-miner` s `MinerRuntime`.
- **Stream 1:** ZION blokový mining přes `EkamDeeksha`.
- **Stream 2:** GPU external AuxPoW (KAS/ALPH/RVN/ZANO/Flux...).
- **Stream 3:** CPU external AuxPoW (XMR/VRSC/EPIC...).
- Profit router vybírá nejvýnosnější coin podle zařízení (`Device::Cpu/Gpu/Both`).
- Per-stream statistiky (`StreamId`, `StreamStats`) a test `triple_stream_runs`.

### 2. `V31/L2/multichain` — ZionDex AMM router
- `swap/dex.rs` nahradil placeholder `DexRouter` reálnou constant-product AMM logikou.
- `num-bigint` matematika pro přesné quote/execution bez overflow.
- Direct swap + one-intermediate route discovery (aggregator preview).
- `MultichainService` má `add_dex_pool`, `dex_quote`, `dex_swap`.

### 3. `V31/L1/pool` — stratum pool s PPLNS
- Nový crate `zion-pool`.
- `PplnsState` s fee-aware výpočtem `Payout`.
- `ShareValidator` validuje ZION i AuxPoW share.
- `Pool` přijímá `submit_zion` a `submit_auxpow`.
- Minimální stratum v1 TCP server `StratumServer` (`mining.subscribe`, `mining.authorize`, `mining.submit`).

### 4. `V31/L2/multichain` — Bridge (lock/mint, burn/release)
- `Bridge` koordinuje `Transfer` mezi dvěma `ChainAdapter`.
- Poll `watch_events` na source chain, `execute_outbound` na target chain.
- Fallback placeholder hash pro scaffold fázi, když adaptéry ještě nemají real RPC/signing.
- Testy s mock registry pro `LockMint` a `BurnRelease`.

### 5. `V31/L2/multichain` — Wallet / Keyring
- `Keyring` z jednoho BIP39 seedu.
- EVM adresy a podpis přes `ethers::signers::MnemonicBuilder` (BIP44 `m/44'/60'/...`).
- Zion adresy a Ed25519 podpis.
- Deterministické testy pro známý mnemonic.

### 6. Integrace do `MultichainService`
- Sdílený `Arc<ChainAdapterRegistry>`.
- `MultichainService` vystavuje:
  - `bridge_submit(...)`
  - `wallet_address(chain, account, index)`
  - `wallet_sign(chain, message, account, index)`
  - `add_dex_pool`, `dex_quote`, `dex_swap`

### 7. `V31/cli` — `zion` CLI příkazy
- `zion status` — seznam a health registrovaných chainů.
- `zion wallet address/sign/balance` — odvození adresy a podpis přes `Keyring`.
- `zion bridge lock/burn` — vytvoření a submit bridge `Transfer`.
- `zion swap quote/execute` — DEX quote a execution.
- `zion api` — spuštění HTTP API serveru (Axum) pro dashboard.

### 8. V3 contract addresses v `zion-multichain`
- Nový modul `contracts.rs` s kanonickými adresami 3.0.4/3.0.5: wZION, ZIONBridge, AtomicSwap, Staking, Farm, Governance, Treasury.
- `ZionContracts::base_mainnet()` a `ZionContracts::non_base()` pro generic EVM bridge proxy.
- Exponováno přes `/v1/multichain/contracts` a `/v1/multichain/contracts/:chain`.

### 9. V31 HTTP API gateway
- Rozšířen `ApiServer` v `server.rs` o endpointy:
  - `/v1/wallet/address`, `/v1/wallet/sign`
  - `/v1/swap/quote`, `/v1/swap/execute`
  - `/v1/bridge/submit`
  - `/v1/multichain/contracts`
- Přidán `CorsLayer` pro integraci s externím dashboardem (`dashboard.zionterranova.com`).

### 10. `Dash31/` — statický dashboard pro V31 Alpha
- `index.html` + `app.js` volající V31 HTTP API.
- Sekce: status, kontrakty, wallet, bridge, swap, pool placeholder.
- Default API base `http://127.0.0.1:8453` (konfigurovatelné v UI).

### 11. Real `EvmAdapter` s `ethers`
- `EvmAdapter` nyní drží `Provider<Http>`, volitelný `LocalWallet` a `ZionContracts`.
- `send_payment` odesílá nativní EVM transfer přes `SignerMiddleware`.
- `watch_events` scanuje posledních 100 bloků a dekóduje `BridgeBurn` / `BridgeMint` eventy z `wZION`.
- `execute_outbound` pro `LockMint` volá `ZIONBridge.submitLockProof`, ale jen když je wallet oprávněným validátorem (`hasRole` check).
- `MultichainService` předává EVM adaptérům wallet z `Keyring` a V3 contract addresses.

### 12. `ZionL1Adapter` pro bridge lock/unlock
- Adapter nyní přijímá `Keyring` pro podepisování `submitBridgeUnlock`.
- `watch_events` volá RPC `getBridgeLocks` a mapuje je na `DepositEvent`.
- `execute_outbound` pro `BurnRelease` sestaví validator proof (secp256k1 ECDSA přes `evm_wallet`) a volá `submitBridgeUnlock`.
- `Bridge` matching nyní podporuje mema `BRIDGE:<chain>:<recipient>` z V3 a po detekci eventu přepíše `transfer.id` na source tx hash.
- `Keyring` je `Clone`, aby ho mohl service sdílet s adaptéry.
- `EvmAdapter` převádí ZION flowers (6 dec) na wZION wei (18 dec) při `submitLockProof` pro `LockMint`.

### 13. Pool integrace do `zion-multichain` API
- `zion-pool` přidán jako dependency `zion-multichain`.
- `MultichainConfig` nyní obsahuje volitelnou `[pool]` konfiguraci (`PoolConfigFile`).
- `MultichainService` drží instanci `zion_pool::Pool` a exportuje `pool_stats()`.
- Nový HTTP endpoint `GET /v1/pool/stats` vrací `accepted`, `rejected`, fee a PPLNS okno.
- `Dash31` dashboard pool panel načítá statistiky z `/v1/pool/stats`.

### 14. TCP stratum server
- `zion-pool::StratumServer` rozšířen o `tokio::sync::broadcast` pro `mining.notify` broadcast.
- `ApiServer::run` při `[pool]` enabled bindne TCP port a spustí `StratumServer`.
- Každých 10s se broadcastuje dummy job `zion_1` s 80-byte headerem a max targetem, aby se mohli minerové připojit a submitovat share.

## Verifikace

```bash
cd V31
cargo test      # 55 testů OK
cargo clippy -- -D warnings   # OK
cargo fmt       # OK
```

Rozpis testů:
- `zion_core`: 2
- `zion_cosmic_harmony`: 27
- `zion_l1_types`: 4
- `zion_miner`: 4 (vč. Triple Stream)
- `zion_multichain`: 14 (DEX, bridge, wallet) + 1 `service.rs` test
- `zion_pool`: 18
- **celkem: 70**

## Commity dnes

- `0678e164` — původní `main` před dnešní prací.
- `48fd9cf1` — `feat(v31): add unified miner with AuxPoW and DEX inside multichain`
- `df4d30b4` — `feat(v31): add Triple Stream support to zion-miner`
- `9e720dc4` — `feat(v31): add pool, bridge and wallet modules for Mainnet Alpha`
- `23e8ecec` — `docs: add V31 Mainnet Alpha progress report and next plan`
- `91bdd696` — `feat(v31): add CLI commands for wallet, bridge and swap`
- `eb7bcda7` — `feat(v31): add V3 contracts, HTTP API, CORS and Dash31 dashboard`
- `49b8e76c` — `feat(v31): wire EvmAdapter with ethers provider, signer and V3 contracts`
- `0f2eef54` — `feat(v31): ZionL1 bridge locks + submitBridgeUnlock with validator proof`
- `441e327f` — `fix(v31): decimal scaling in EvmAdapter submitLockProof + fmt`
- `18405d25` — `feat(v31): integrate zion-pool stats into HTTP API + Dash31`
- `ff2b8840` — `feat(v31): TCP stratum server with mining.notify broadcast`

## Další plán (Mainnet Alpha milestones)

1. **Pool server live**
   - Bind `StratumServer` na TCP port (Edge: `62.171.141.136:8444` nebo podobně podle `AGENTS.md`).
   - Generovat reálné `mining.notify` joby z `zion-core` / `zion-node`.
   - Propojit PPLNS payouts se skutečnými block rewards.
   - `Dash31` `/v1/pool/stats` ✅.
   - TCP stratum ✅ — `ApiServer` spouští `StratumServer` na portu z `[pool]` configu a každých 10s broadcastuje dummy `mining.notify` job (`zion_1`) s max target.

2. **Real chain adapters (další kroky)**
   - `EvmAdapter` ✅ — provider + wallet + contract addresses; zbývá nasadit validator wallet a testovat `submitLockProof` na Base.
   - `ZionL1Adapter` ✅ — `getBridgeLocks` a `submitBridgeUnlock` s proofem; zbývá testovat na živém L1 RPC.
   - `BitcoinAdapter`: UTXO lock/mint a burn/release.
   - Testovací bridge end-to-end mezi `zion-l1` a `base` (nejprve na testnet fork).

3. **Bridge watcher finalizace**
   - Kontraktní adresy pro Base (wZION) a ZION L1 bridge vault.
   - Event filters (`Deposit`, `Burn`) místo placeholderu.
   - Quorum / guardian signatures pro L1 → L2 mint.

4. **DEX deployment**
   - Real AMM pool contracts na Base.
   - Multi-hop execution hop-by-hop s aktualizovanými rezervami.
   - Intent-based routing mezi chainy.

5. **CLI rozšíření**
   - Přidat `zion pool` příkazy (status, shares, payouts).
   - `zion miner` start/stop Triple Stream.
   - `zion doctor` pro ověření konfigurace a připojení.

6. **V31 workspace v `public/` subtree**
   - Až bude V31 stabilní, připravit subset pro public repo (`public/V31/`).
   - Two-step push: `origin` (private) → `public` (subtree).

7. **Deploy runbook pro V31 Edge node**
   - `ZION_OS/infra/` scripts a systemd services pro `zion-node-v31`, `zion-pool-v31`, `zion-multichain-v31`.
   - Migrace dat z V3 na V31 cutover block.

## Bezpečnost / provozní poznámky

- Žádné privátní klíče, mnemonics ani server credentials nebyly commitnuty.
- `V3/`, `AuXpow/`, `APP&WEB/` zůstaly beze změn; všechny náhodné subagent-edity v těchto stromech byly před commitem vráceny.
- Pool TCP server a bridge outbound txs jsou zatím scaffoldy — před mainnet nasazením je potřeba real RPC + signer.
