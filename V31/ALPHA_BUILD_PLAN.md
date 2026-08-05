# V31 Mainnet Alpha — Build Plan (kanonický)

> **Verze:** 3.1.0-alpha.2  
> **Datum:** 2026-07-30  
> **Status:** V3 PoW + genesis hash reproduced, V3 block validator implemented, checkpoint sync implemented, V3 state/template/RPC/reorg implemented, V3 RPC wired into node runtime, V3 P2P listen server + IBD loop, `bin/node.rs` V3-aware runtime, `zion-pool` standalone stratum binary, `zion miner start` pool mode, E2E smoke (node + pool + miner) produces and accepts blocks height 1+, production P2P hardening (peer manager, ban score, max peers, discovery), custom AMM deploy in `zion-multichain` (SQLite persistence, HTTP API), WARP API rate limiting + auth (per-IP token bucket, optional Bearer key), height-aware PoW fork gating stress-tested across CHV3/Fire boundaries, L3–L6 cross-layer smoke (NCL → AI-Native → Oasis → Free World → Issobella) passing, runtime panics and `unimplemented!` placeholders removed, `cargo clippy --workspace` clean, all workspace tests pass. Zůstává: reálné non-EVM WARP deploye + `v3.1.0-beta` release.
> **Princip:** `V3/` zůstává produkční, `V31/` se staví jako čistý Mainnet Alpha strom.  

Tento dokument je **jediný kanonický plán** pro stavbu `V31/`. Všechny rozhodnutí o architektuře, vrstvách a prioritách se zde zaznamenávají a aktualizují.

---

## 1. Rozhodnutí (canonical decisions)

### 1.1 Triple Stream jako primární mining model

- **Stream 1** — ZION canonical (`EkamDeeksha`/`deeksha_lite_v1` kompatibilní). Hlavní příjem v ZION.
- **Stream 2** — externí GPU coin (KAS/ALPH/RVN/EPIC/ZANO/…). Přes AuxPoW stratum.
- **Stream 3** — externí CPU coin (VRSC/XMR/RTM/…). Přes AuxPoW stratum.

`zion-miner` bude mít vždy **alespoň Stream 1**. Stream 2 a 3 jsou **volitelné fallback revenue streamy**. Pokud se externí pool nepodaří kontaktovat, miner padne zpět do ZION-only režimu bez pádu procesu.

### 1.2 AuxPoW = fallback, ne samostatný crate

- Standalone `AuXpow/` crate se **nechává jako fallback knihovna** v rootu, dokud není plně portován do `V31/L1/miner/src/auxpow/`.
- V `V31/` je `auxpow` podmodulem `zion-miner`, nikoli samostatným cratem.
- Pokud se ukáže, že externí AuxPoW pooly nejsou pro Mainnet Alpha kritické, lze Stream 2/3 vypnout feature flagem `--no-gpu`/`--no-cpu` nebo v `MinerConfig`.

### 1.3 Jeden zdroj pravdy pro typy

- `zion-l1-types` — `Address`, `Amount`, `Asset`, `ChainId`, `Hash`.
- `zion-cosmic-harmony` — `ExternalCoin`, `CoinProfile`, `ProfitRouter`, `EkamDeeksha`.
- Žádné duplikáty `ExternalCoin`/`CoinProfile` v `V31/`.

### 1.4 L2 = jeden `zion-multichain` crate

- Bridge, WARP, atomic-swap, ZionDex, swap-aggregator, wallet a Dharma Credits patří do `V31/L2/multichain`.
- `ChainAdapter` trait je jediným integration pointem.
- V3 `L2/bridge`, `L3/warp`, `ZionDex/`, `L2/atomic-swap` se postupně portují sem, nikoli živí vedle sebe.

### 1.5 Layer identita

| Layer | Obsah | Status v V31 |
|-------|-------|--------------|
| L1 | core, cosmic-harmony, miner, pool, types, native-ffi | core je scaffold, ostatní existuje |
| L2 | multichain (bridge, swap/dex, wallet, credits, warp) | reálné adaptery (EVM/BTC/ZionL1), HTLC, DEX, WARP; 538+ testů |
| L3 | ai-native, ncl, hiran, orchestrator, automation, poc | chybí |
| L4 | oasis | chybí |
| L5 | free-world | chybí |
| L6 | issobella | chybí |
| sdk, cli | veřejné SDK a `zion` CLI | cli existuje |

---

## 2. Aktuální stav `V31/` (2026-07-28)

### 2.1 Co funguje (aktualizováno 2026-07-28)

- `cargo test` v `V31/` projde (workspace 7 crateů).
- `zion-l1-types` má čisté primitivy a testy.
- `zion-cosmic-harmony` má `EkamDeeksha` s KAT vektory a `ExternalCoin`/`ProfitRouter`.
- `zion-core` má `Storage` (SQLite), `Block`/`BlockHeader`, `Transaction`, `ConsensusEngine`, `Mempool`, `RPC`, `genesis`, `emission`, `difficulty` (LWMA-60) a `migration` modul.
- `zion-core` V3 compat vrstva: `v3_compat`, `v3_checkpoint`, `v3_p2p`, `v3_state`, `v3_template`, `v3_rpc`, `v3_reorg` — vše pokryto testy (`cargo test -p zion-core` prochází).
- `zion-miner` má Triple Stream runtime (3 tokio tasky).
- `zion-pool` má základní PPLNS a stratum server skeleton.
- `zion-multichain` má `ChainAdapter` trait, HTTP API, wallet keyring (BIP39 → EVM/Zion/BTC), bridge lock/burnRelease, DEX router, HTLC, Dharma Credits a payout integration.
- `zion-cli` má subcommands: status, wallet, bridge, swap, pool, miner, doctor, api, node, migrate.
- **E2E smoke test `zion-node` + `zion-pool` + `zion-miner` projde:** pool fetchuje `getTemplate` z node, broadcastuje `mining.notify`, miner připojí stratum, najde share, pool validuje, skládá block a odesílá `submitBlock`; node přijme block a chain roste (ověřeno výška 1+).

### 2.2 Co je ještě scaffold / stub

- `zion-core`: P2P V3 listen/gossip server implementován (`v3_p2p::V3P2PServer`), V3 RPC handler zapojen do `RpcServer` (dispatchuje `getStatus`/`getBlockByHeight`/`getTemplate`/`submitBlock`/… do `V3RpcHandler`), `bin/node.rs` má V3-aware runtime s `--v3-checkpoint`, `--v3-miner`, `--v3-human`, `--v3-issobella`, `--v3-no-genesis` CLI flagy a spouští V3 P2P listen + V3 sync loop paralelně s legacy P2P/RPC. IBD/sync checkpoint import funguje.
- `zion-miner/auxpow`: `StratumClient` je plně funkční (subscribe, authorize, notify, submit, reconnect). Stream 1 má pool stratum režim (`mine_zion_pool_share`). `find_share` je CPU brute force, žádné GPU/CUDA/Metal/OpenCL, žádné native hashers (feature-gate `native-hashers` existuje).
- `zion-multichain/chain/adapters`: EVM/Bitcoin/ZionL1 adaptery jsou **reálné** (EVM přes `ethers` volá `ZIONBridge`/`wZION` ERC-20 na Base; Bitcoin přes `bitcoin` crate s P2WPKH + mempool.space; ZionL1 přes JSON-RPC). HTLC v `swap/htlc.rs` je reálná state machine s on-chain execution přes `ChainAdapter::execute_outbound`, memo parserem (`SWAP:LOCK/CLAIM/REFUND`), preimage/timelock/claimant validací a persistencí `HtlcRecord`. DEX router v `swap/dex.rs` je reálný constant-product AMM s multi-hop routingem. WARP adaptéry pro EVM/Bitcoin/Solana/Tron/TON jsou reálné; Aptos/Cosmos/Cardano/Sui/NEAR/Stellar mají reálné RPC ale placeholder contract addresses (nejsou v Alpha scope).
- `zion-pool`: PPLNS je statický, stratum odpovídá `mining.subscribe`/`authorize`/`submit` + `template_feed_loop` periodicky fetchuje `getTemplate` z node RPC a broadcastuje `mining.notify`.
- L3–L6: viz sekce 1.5 + Fáze 4 (portováno).

### 2.3 Gaps proti V3

| Oblast | V3 | V31 | Akce |
|--------|-----|-----|------|
| Node runtime | 7700+ řádků `chain.rs`, `bin/node.rs` | 3 malé soubory | Portovat postupně |
| PoW | `deeksha_lite_v1`, `deeksha_chv3`, `deeksha_lite_fire` | `EkamDeeksha` — jediný kanonický PoW pro všechny výšky | Hotovo pro Alpha |
| AuxPoW | `zion-auxpow` crate, 24 coinů | stub 15 coinů | Portovat stratum + hasher subset |
| Storage | LMDB/SQLite hybrid | SQLite pro V3 checkpoint sync | Vybrat jeden backend (SQLite nebo LMDB) |
| P2P | wire protocol v `p2p.rs` | V3 client + listen server v `v3_p2p` | Hotovo pro Alpha; reconnect rate limit implementován |
| RPC | JSON-RPC v `rpc.rs` | V3 handler zapojen do `rpc.rs` dispatch | Hotovo pro Alpha |
| Multichain | 6 samostatných crateů | 1 sjednocený crate (reálné adaptery + HTLC + DEX + WARP) | Hotovo pro Alpha |
| CLI | `zion` single binary (menu) | clap subcommands | Sjednotit UX |

---

## 3. Fázový plán

### Fáze 0 — Kanonizace mineru (Triple Stream + AuxPoW fallback)

Cíl: `zion-miner` spustitelný a otestovatelný; Triple Stream běží; AuxPoW je odpojitelný.

- [x] 1. Přidat feature flagy `auxpow` (default off pro CPU/GPU fallback) a `native-hashers`.
- [x] 2. Přepsat `MinerRuntime::run` tak, aby Stream 2/3 selhaly tiše, pokud není AuxPoW nakonfigurováno.
- [x] 3. Implementovat reálný `StratumClient` pro stratum v1 (subscribe, authorize, notify, submit).
- [x] 4. Přidat `ExternalCoin`→stratum URL mapování z `CoinProfile`.
- [x] 5. Přidat integrační test `triple_stream_runs` s mock stratum serverem.

### Fáze 1 — Node core

Cíl: `zion-node` binary nahradí V3 node pro lokální testnet.

- [x] 1. Přidat `storage` modul (SQLite/LMDB) pro bloky, UTXO/account state, mempool.
- [x] 2. Přidat `genesis` modul (hard reset genesis hash `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` jako konstanta).
- [x] 3. Přidat `emission` a `difficulty` (LWMA-60, 5400.067 ZION reward, fee split 89/5/5/1).
- [x] 4. Přidat `mempool` a `rpc` (JSON-RPC kompatibilní s V3 node API).
- [x] 5. Přidat `p2p` (minimální gossip + block sync).
- [x] 6. Přidat `bin/node.rs` (V3-aware runtime s P2P listen, RPC, mining loop, checkpoint import, shutdown handling).

### Fáze 2 — Multichain adaptery

Cíl: L1 <-> Base bridge E2E, BTC <-> ZION HTLC, wZION/USDC swap quote.

1. [x] EVM adapter: `ethers` volání `ZIONBridge` (`submitLockProof`/`confirmBurnRelease`), `wZION` ERC-20 balance/transfer.
2. [x] Bitcoin adapter: `bitcoin` crate, P2WPKH payments + mempool.space API (Electrum TCP fallback zůstává jako budoucí enhancement).
3. [x] HTLC modul v `swap/htlc.rs` — state machine s hashlock/timelock a testy.
4. [x] DEX router v `swap/dex.rs` s konstantním produktovým AMM invariantem a multi-hop quote. Custom AMM deploy (`/v1/swap/pool/deploy`) a persistence v SQLite hotovo.
5. [x] Připojit `credits` k `zion-pool` payouts — `CreditsLedger` ukládá balance a `MultichainService::execute_payouts` credituje/debetuje.

### Fáze 3 — Pool + Miner integrace

Cíl: pool a miner si rozumí, stratum jobs se generují z node block template.

1. [x] Pool si bere block template z `zion-multichain`/`zion-core` RPC.
2. [x] Miner dostává jobs z poolu nebo lokálně těží block pro vlastní node.
   - `MinerConfig.node_rpc_url` — pokud je nastaveno, miner fetchuje `getBlockTemplate` a submituje `submitBlock`.
   - `MinerConfig.pool_url` — rezervováno pro stratum pool client mode.
   - CLI: `zion miner start --node-rpc-url http://127.0.0.1:9443`.
3. [x] PPLNS payout se provede přes `MultichainService::execute_payouts`.

### Fáze 4 — L3–L6, SDK, CLI polish

Cíl: feature parity s V3 superstructures a jednotný CLI.

1. [x] Přesunout `ai-native`, `ncl`, `hiran` z `V3/L3` a `HiranV2.x/`.
   - `V31/L3/ncl` — NCL neural compute layer (42 tests).
   - `V31/L3/ai-native` — autonomous agent framework (337 tests), includes `hiran_inference` + `hiranyagarbha` modules.
   - HiranV2.x obsahuje jen Python training scripts — Rust kód je v ai-native.
2. [x] Přidat `oasis`, `free-world`, `issobella` jako samostatné crate.
   - `V31/L4/oasis` — consciousness mining game (124 tests).
   - `V31/L5/free-world` — humanitarian grants (3 tests).
   - `V31/L6/issobella` — orbital observatory (3 tests).
3. [x] Doplnit `sdk` crate.
   - `V31/sdk` — async NodeClient + WalletClient wrapping zion-multichain Keyring (4 tests).
4. [x] Sjednotit CLI s V3 `zion` interactive menu.
   - `zion menu` — arrow-key operator dashboard (status, wallet, bridge, swap, pool, miner, doctor).
   - V3 `zion-warp` merged into `zion-multichain::warp` module (505 tests).
   - Workspace: 13 crates, 1134 tests, clippy clean.

### Fáze 5 — Cutover

Cíl: `V31/` nahradí `V3/` na Edge staging.

1. E2E smoke testy: node + pool + miner + bridge + dex 24h.
2. Tag `v3.1.0-alpha.1`, následně `v3.1.0-beta`.
3. Archivovat `V3/` do tagu `pre-v31-cutover`.
4. `public/` subtree sync.

---

## 4. Prioritní úkoly (next 48h)

Všechny 5 kroků z předchozího plánu je **hotovo** (2026-07-28). Další práce:

1. ~~**E2E smoke testy**~~ — **Hotovo (2026-07-30):** `zion-node` + `zion-pool` + `zion-miner` lokálně vytěží, submitne a přijme block (výška 1+). Pool broadcastuje `mining.notify`, miner připojí stratum a submituje share.
2. ~~**Production P2P hardening**~~ — **Hotovo (2026-07-30):** `PeerManager` sdílený mezi canonical a V3 P2P, max inbound limit, ban score, `GetPeers`/`Peers` odpovědi ve welcome zprávě.
3. ~~**Custom AMM deploy v `zion-multichain`**~~ — **Hotovo (2026-07-30):** SQLite persistence AMM poolů, `deploy_pool`, `/v1/swap/pool/deploy` + `/v1/swap/pools`, načítání poolů při startu.
4. ~~**WARP API rate limiting + auth v `zion-multichain`**~~ — **Hotovo (2026-07-30):** per-IP token bucket, optional `Authorization: Bearer <api_key>`, `/health` public, `ConnectInfo` zapojen.
5. ~~**Kanonický Ekam Deeksha PoW + stress testy**~~ — **Hotovo (2026-08-07):** `EkamDeeksha` z `zion-cosmic-harmony` je jediný PoW pro všechny výšky; `zion-core` obsahuje unit testy mine/verify a nonce-search sweep 0–5500.
6. ~~**HTLC persistence**~~ — **Hotovo (2026-07-30):** SQLite backend pro HTLC v `zion-multichain`.
7. ~~**Tag `v3.1.0-alpha.2`**~~ — **Hotovo (2026-07-30):** tag vytvořen a pushnut; workspace build prochází.
8. ~~**Finální cut-over plán V3 → V31**~~ — **Hotovo (2026-07-30):** vytvořen `V31/CUTOVER_PLAN.md` s rolling blue/green strategií.
9. ~~**Plná L3–L6 end-to-end verifikace**~~ — **Hotovo (2026-07-30):** vytvořen `V31/smoke` crate s cross-layer smoke testem (`l3_l6_cross_layer_smoke`), který propojuje NCL compute job → AI-Native consciousness engine → Oasis bridge → Oasis player → Free World grant → Issobella proposal. Test prochází.
10. ~~**Cross-chain WARP transfer (Base ↔ ZionL1)**~~ — **Hotovo (2026-07-30):** `V31/smoke` obsahuje `warp_htlc_cross_chain_smoke` s HTLC lock/claim mezi Base a ZionL1.
11. ~~**DAO governance proposal + vote**~~ — **Hotovo (2026-07-30):** `V31/smoke` obsahuje `dao_governance_proposal_smoke` s proposal, hlasováním a quorum check.

---

## 5. Rizika a mitigace

| Riziko | Mitigace |
|--------|----------|
| Přepsat celý V3 core do V31 trvá moc dlouho | Dělit na fáze; core začít jako light node, ne full replica |
| AuXpow merge do mineru je složitý | Ponechat `AuXpow/` jako fallback knihovnu, importovat selectivně |
| Multichain monolit přeroste | Moduly `chain`, `bridge`, `swap`, `wallet`, `credits` zůstávají separátní v rámci crate |
| Testy V31 neodchytí drift oproti V3 | Přenést known-answer testy z V3 do V31 |
| Public subtree desync | Po každé V31 změně v MIT-safe částech spustit `git subtree push --dry-run` |

---

## 6. Definice "hotovo" pro 3.1.0-alpha.1

- `cargo test` v `V31/` passuje.
- `zion-miner --no-gpu --no-cpu` těží ZION block.
- `zion-cli miner start` běží Triple Stream proti mock poolu.
- `zion-multichain` API odpovídá `/v1/multichain/*` a `/v1/wallet/*`.
- Dokumentace v `V31/ALPHA_BUILD_PLAN.md` a `V31/README.md` je aktuální.

---

*Generated with [Devin](https://devin.ai) — V31 Mainnet Alpha kanonizace.*

## 7. V3 -> V31 chain migration

### 7.1 State snapshot migration (aktuální default)

- `zion-core/src/migration.rs` cte V3 `zion-node-state.db` JSON export a vytvari migration block (height 0) se snapshotem finalnich account/UTXO balances.
- `zion-migrate` binary: `--v3-state <path> --db-path <sqlite>`.
- Node se spousti s `--no-genesis` nad uz migrateovanym `--db-path`.
- Verified proti edge state: 7423 bloku, 22 unikatnich adres, total supply zachovan.
- **Poznámka:** toto je **state-snapshot / soft reset řetězce** — vytváří se nový genesis block s novým hashem. Historické block hashe 0..tip se nekopírují.

### 7.2 Block-by-block sync bez hard resetu (checkpoint sync — aktivně implementováno)

- Rozhodnuto pokračovat **Cestou B (checkpoint sync)**: V31 nebude produkovat nové genesis, ale začne z trusted snapshotu posledního V3 stavu a dále validovat nové bloky původními V3 pravidly.
- Implementováno:
  - `V31/L1/cosmic-harmony-v3` — přenesen celý `V3/L1/cosmic-harmony` crate (Ekam Deeksha v1/v2/v3, NPU mixing, GPU kernely). 200+ testů prochází.
  - `V31/L1/core/src/v3_compat.rs` — V3 `MiningHeader`, account+UTXO transakce, BLAKE3 merkle root, compact target, genesis block builder, `v3_genesis_hash()`.
  - `V31/L1/core/src/v3_checkpoint.rs` — import trusted V3 snapshotu do SQLite storage.
  - `V31/L1/core/src/v3_p2p.rs` — V3 wire client (Hello, GetBlocksSince, AnnounceBlock).
  - `V31/L1/core/src/v3_state.rs` — aplikace a validace V3 bloků, account/UTXO transakcí, coinbase split.
  - `V31/L1/core/src/v3_template.rs` — stavitel V3 block template s LWMA obtížností a miner s nonce scanem.
  - `V31/L1/core/src/v3_rpc.rs` — V3 JSON-RPC handler (status, block/template, submit, tx, balance, utxos).
  - `V31/L1/core/src/v3_reorg.rs` — reorg na delší fork s nalezením společného předka a replay stavu.
  - `ConsensusEngine::verify_v3_block()` — validátor V3 bloků (height, prev hash, timestamp, difficulty bits, merkle root, PoW).
  - **Ověření:** `v3_genesis_hash()` reprodukuje mainnet hash `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`; `validate_v3_block` akceptuje V3 genesis blok; `cargo test -p zion-core` prochází.
- Zbývá:
  - ~~E2E smoke testy (node + pool + miner lokálně).~~ **Hotovo (2026-07-30).**
  - ~~Production P2P hardening (peer discovery, max peers, ban score); rate limit hotovo.~~ **Hotovo (2026-07-30).**
  - ~~Custom AMM deploy (`/v1/swap/pool/deploy`, SQLite persistence poolů).~~ **Hotovo (2026-07-30).**
  - ~~WARP API rate limiting + auth (per-IP token bucket, optional `Authorization: Bearer`).~~ **Hotovo (2026-07-30).**
  - ~~Height-aware PoW fork gating + stress testy (boundary CHV3/Fire + sweep 0–5500).~~ **Hotovo (2026-07-30).**
  - ~~HTLC SQLite persistence.~~ **Hotovo (2026-07-30).**
  - ~~Tag `v3.1.0-alpha.2`.~~ **Hotovo (2026-07-30).**
- Detailní analýza v `V31/V3_SYNC_ASSESSMENT.md`.

## 8. Pool + miner integrace (F6)

- `zion-core` `getTemplate` nyní vrací `BlockTemplate` s `template_id`, `header_hex`, `target_hex`, `header_json`, `transactions` a `block_reward`.
- `zion-pool` `StratumServer` ukládá celý template, rozesílá 3-param `mining.notify` a po nalezení bloku rekonstruuje `Block` a posílá `submitBlock` na node RPC.
- `zion-miner` `mine_zion_pool_share` používá `ConsensusEngine::mine_header_bytes` pro ZION PoW nad 80-bajtovým `header_hex` z poolu a odesílá share ve stratum `mining.submit` formátu.
- **E2E smoke ověřeno (2026-07-30):** `zion-node` + `zion-pool` + `zion-miner` vytěží a přijme řetězový block výška 1+.

## 9. Pool operability (F1) a Stratum v1 (F2)

- `zion-pool` `PplnsState` lze ukladat/restorovat z JSON souboru (`save_to` / `restore`).
- `zion-multichain` pri startu stratum nacita PPLNS state a kazdych 30s uklada.
- `PoolConfig` ma nove pole `state_path` pro cestu k PPLNS snapshotu.
- `StratumServer` podporuje anonymous mining: `mining.authorize` `WALLET.worker` -> vyplata na `WALLET` (pokud zacina `zion1`).
- `cargo test --workspace` a `cargo clippy --workspace` passuji.
