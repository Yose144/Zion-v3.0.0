# QUANTUS (QTC) × ZION — plán nativního propojení

Status: **NÁVRH — ke schválení** · Datum: 2026-10-08 · Autor: Devin
Vize (operátor): nativní QTC v ZIS + wallet + desktop agentu, most ZION↔QTC,
Trinity engine = ZION/QTC primárně i ve veřejných releasech, pool payouty
v QTC i ZION, dual-mining pro miners komunitu, profit na pool fee.

---

## 1. Co je Quantus — tvrdá fakta (ověřeno 2026-10-08)

- **Substrate chain** (Polkadot SDK fork), mainnet **Planck**, token **QTC**
  (12 decimals), ss58 prefix: heisenberg testnet = 189; Planck ověřit ve spike.
- Consensus **QPoW** = Poseidon2 nad Goldilocks polem — **už máme bit-exact
  implementaci** (CPU + OpenCL + CUDA, KAT ověřené).
- Podpisy **ML-DSA-87 (Dilithium)** — post-quantum; podpis ~4.6 KB/tx.
- P2P: libp2p s ML-KEM-768 + ML-DSA-87 peer identity.
- Pallety: System/Balances/Timestamp, QPoW, Mining Rewards, **Wormhole**
  (ZK burn→claim, Plonky2), Reversible Transfers, Multisig, Governance,
  Treasury, Vesting. **Žádný contracts pallet, žádný HTLC pallet.**
- **Veřejný RPC:** `wss://a1-planck.quantus.cat` (standardní Substrate WS RPC).
- **Toolchain existuje jako crates:**
  - `qp-poseidon-core 3.1.0` — už v workspace (mining)
  - `qp-rusty-crystals-dilithium` — pure-Rust ML-DSA-87 keygen/sign/verify
  - `qp-dilithium-crypto` — Substrate crypto traits (MultiSignature apod.)
  - `qp-rusty-crystals-hdwallet` — HD derivace pro Dilithium
  - `quantus-cli` (GitHub Quantus-Network) — obsahuje `QuantusClient`
    = `subxt::OnlineClient` wrapper, který už řeší jejich custom
    SignedExtensions a signer; použitelné jako knihovna (LIBRARY_USAGE.md).

## 2. Klíčové architektonické rozhodnutí — typ mostu

| Model | Proveditelnost | Poznámka |
|---|---|---|
| **Trustless HTLC atomic swap** | ❌ dnes ne | Quantus runtime nemá hashlock; Reversible Transfers jsou sender-cancellable (špatný směr); wormhole = ZK důkaz znalosti preimagem — protistrana secret nedozví → nejde navázat na náš `SWAP:CLAIM` |
| **Watchtower bridge (kustodiální)** | ✅ **DOPORUČENO** | Stejný model jako naše existující bridge infra (`deposits.rs`/`withdrawals.rs`/`ledger.rs`/`solvency.rs` dostaneme zdarma). Otevřené ledger + solvency reporting místo trustless |
| **Jednosměrný provable-burn QTC→ZION** | ✅ později (F3b) | QTC burn do wormhole adresy `H(H(salt\|secret))` je on-chain proveditelný a nezvratný → releasovatelný ZION bez custody na QTC straně |

**Závěr:** stavíme watchtower bridge přes `ChainAdapter` trait — plně
konzistentní se stávajícím multichain designem. Trustless variantu lze
navrhnout upstream (HTLC pallet) nebo přes wormhole-burn směr QTC→ZION.

## 3. Naming — ticker kolize (ROZHODNUT POŽADOVÁNO)

- Quantus oficiálně obchoduje jako **QTC**; v našem `ExternalCoin` enumu je
  `QTC` obsazené **Qubitcoinem** (qhash) → interně používáme **QTU**.
- **Doporučení:** interní env/RPC ticker nechat `QTU` (netříštit
  `ZION_STREAM*_FORCE_COIN` parsing), v UI a marketingu zobrazovat
  **„QTC (Quantus)"**. Desktop registry už má `QTC→qhash` (Qubitcoin) —
  přidat `QUANTUS` label s tickery `QTU` interně / `QTC` display.
- ⚠️ Pokud má být ve wallet/bridge vrstvě kanonický ticker `QTC`, řešit
  migrací Qubitcoin→`QBC` aliasem (větší diff, ale čistší uživatelsky).

## 4. Stav dneška — co už funguje

- **Mining:** `ExternalCoin::Quantus` na Trinity Stream 2 — CPU fast-path,
  OpenCL kernel, CUDA kernel (vše KAT-ověřené vs `qp-poseidon-core 3.1.0`);
  pool bridgy na k1pool/qelvhash/suprnova LIVE (`job_fresh`).
- **Pool:** 10 AuxPoW bridgů vč. QTU, per-session coin routing
  (`CoinPreference`), `coin_details` v public API, profit-switch katalog 33.
- **Desktop agent:** one-click algo/coin switching, QTU v selectech,
  auto-Trinity, `resources/zion-miner.bin` fresh build.
- **L2 multichain:** `ChainAdapter` trait + registry, `zion_l1`/`bitcoin`/
  `evm`/`solana` adaptéry, HTLC koordinátor, ledger/reconciliation/solvency,
  `zis_auth` (ZIS session + API key), `multichain_wallet` (custodial
  per-user deposit adresy z jednoho keyring seedu).
- **Desktop wallet:** `wallet-generator.js` (Ed25519 zion1), `zis-client.js`
  (session + API).

## 5. Implementační fáze

### F0 — Spike: ověření kompatibility ✅ HOTOVO (2026-10-09)

Cíl: nepsat nic do produkce, dokud neověříme reálný chain.

- [x] Připojeno na `wss://a1-planck.quantus.cat` + **HTTPS JSON-RPC na
  stejném endpointu funguje** → adapter používá `reqwest`, žádný WS klient.
  `system_chain`=Planck, ss58=**189**, decimals=**12**, on-chain symbol=**PLK**
  (tržní ticker QTC), spec=153, txVer=6, 28 peerů, synced.
- [x] Metadata V14 dekódovány (101 KB): Balances[2] `transfer_keep_alive`=3,
  `transfer_all`=4, `burn`=10; System[0]; Utility[9]; Wormhole[20];
  ReversibleTransfers[11]. **12 signed extensions, custom
  `ReversibleTransactionExtension`/`WormholeProofRecorderExtension` jsou unit
  typy → standardní extrinsic v4 encoding funguje** — rozhodnutí: hand-rolled
  SCALE (`parity-scale-codec` jen pro storage decode), **bez subxt dep stromu**.
- [x] Finalita: `chain_getFinalizedHead` ≠ best head (finality gadget) —
  konzervativně `QUANTUS_MIN_CONF=30` bloků. Header má custom `zkTreeRoot`
  → čteme jen `number`, plný decode nepotřebujeme.
- [x] Krypto ověřeno na live chainu: `qp-rusty-crystals-dilithium` Keypair ≡
  `DilithiumPair::from_seed`; **AccountId32 = `poseidon2(pubkey)[0..32]`**;
  podpis wire = **sig(4627)‖pubkey(2592)** = 7219 B, enum variant 0x00.
- [x] Testnet Heisenberg `wss://a1-heisenberg.quantus.cat` žije (spec 148).
- [x] Výstup: `docs/quantus-spike.md` — verdict **GO**.

### F1 — `QuantusAdapter` (`V31/L2/multichain`) 🚧 ROZPRACOVÁNO

Nový adaptér `chain/adapters/quantus.rs` implementující `ChainAdapter`:

- [x] `ChainFamily::Substrate` + `ChainId::Quantus` (`as_str()="quantus"`,
      decimals 12) v `zion_l1_types::chain.rs`; exhaustivní matchy
      doplněny (derivation `m/44'/189'/{a}'/0/{i}`, ZIS chain type, assets).
- [x] Deps: `reqwest` (HTTPS JSON-RPC) + `qp-rusty-crystals-dilithium` +
      `qp-poseidon-core` — **bez subxt** (F0 rozhodl: hand-rolled SCALE).
- [x] `health_check` — `system_health`.
- [x] `current_height` — `chain_getFinalizedHead` → `chain_getHeader`.
- [x] `watch_addresses` — scan finalized blocks → parse extrinsics →
      `Balances::transfer_keep_alive`/`transfer_allow_death` filtr na deposit
      adresy → `DepositEvent` (tx_hash = blake2_256(ext), confs = fin−num+1).
      `watch_events` čte `QUANTUS_DEPOSIT_ADDRESSES` env.
- [x] `send_payment` — ruční extrinsic v4: `CheckMortality`(era 64) +
      `CheckNonce` + `ChargeTransactionPayment`(tip 0) + `CheckMetadataHash`(0x00),
      ML-DSA-87 podpis, `author_submitExtrinsic`. Seed z `QUANTUS_SEED`.
- [x] `confirmations` — lookback scan 128 finalized bloků po tx hash.
- [x] `balance` — `System.Account` storage (twox128 + blake2_128_concat),
      decode AccountInfo { nonce, consumers, providers, sufficients, data{free…} }.
- [x] Env: `QUANTUS_RPC`/`rpc_url` (default `https://a1-planck.quantus.cat`),
      `QUANTUS_SEED`, `QUANTUS_DEPOSIT_ADDRESSES`, `QUANTUS_MIN_CONF`.
- [x] Registrace v `service.rs`: `build_adapter` + `chain_id_by_name`
      (`"quantus"|"qtc"|"qtu"`).
- [ ] **PENDING:** live gated test na Heisenbergu (`QUANTUS_LIVE=1`):
      deposit detect + send tx acceptance — vyžaduje testnet HEI.
- [ ] **PENDING:** `payment_queryInfo` fee estimate; `transfer_all`/`batch`
      decode (množné legální deposit cesty mimo keep_alive).

### F2 — Keyring + multichain wallet QTC support

- [ ] `wallet/mod.rs`: `ChainId::Quantus` branch — derivace ML-DSA-87
      keypairu z BIP39 seedu přes `qp-rusty-crystals-hdwallet`
      (derivation path ověřit v F0 — quantus používá `m/44'/…'` Substrate
      path nebo jejich vlastní scheme; `quantus-node key quantus` CLI je
      reference).
- [ ] `zion_seed`-ekvivalent `quantus_seed(account, index)` → 32B seed →
      `Keypair` → `AccountId32` → SS58 adresa.
- [ ] `multichain_wallet::derive_deposit_address` — bez změny logiky,
      automaticky funguje pro nový ChainId (per-user account_index).
- [ ] ZIS: `ZisLinkedAddress.chain_type` přijmout `"quantus"`; verify
      adresy = validace ss58 checksum + prefix.

### F3 — Bridge ZION↔QTC (watchtower)

Přes existující `bridge/` + `multichain_wallet` flow:

- [ ] **QTC→ZION:** user pošle QTC na svou custodial deposit adresu (ZIS) →
      `watch_addresses` detekuje deposit s `QUANTUS_MIN_CONF` confirmations
      → ledger credit → release ZION z bridge walletu (`send_payment` na
      zion1 adresu). Rate feed: `profit.rs` fallback estimate + později
      market API (QTC je na MEXC/XeggeX — zdroj ceny ověřit).
- [ ] **ZION→QTC:** user lock/burn ZION (existující HTLC lock nebo burn
      memo `BRIDGE:QTC:<quantus_addr>`) → watcher → adapter `send_payment`
      QTC na jejich Quantus adresu.
- [ ] Reconciliation + solvency: Quantus hot wallet balance přes
      `system.account` — přidat do `solvency.rs` reporting.
- [ ] F3b (opce): provable-burn — user spálí QTC do wormhole adresy
      `H(H(salt|secret))` s `remark` `BRIDGE:ZION:<zion_addr>` (ověřit, že
      wormhole burn extrinsic přijímá remark) → bridge po konfirmaci
      release ZION. Žádná custody na QTC straně pro tento směr.
- [ ] Dashboard: `/multichain` UI — přidat QTC chain card (deposit adresy,
      bridge status, fee, min/max).

### F4 — Pool payouty v QTC i ZION

Dnes: upstream AuxPoW earnings padají na náš bridge wallet, minery
dostávají jen ZION PPLNS. Cíl: **per-coin attribution + volitelné payouty**.

- [ ] `ShareStore`: záznam `(miner, coin, share_diff_weight, ts)` pro každý
      forwarded accepted share — `record_external_share` už bucketuje per
      coin; rozšířit o durable per-miner váhy (SQLite tabulka
      `ext_share_credits`).
- [ ] Miner identity na payout adresu: V3 `Hello` rozšířit o
      `payout_addresses{qtu: "qz…", …}` nebo per-coin suffix ve worker
      jménu (`worker.qz…`); canonical: nastavení v dashboardu via ZIS.
- [ ] `QtcPayoutSweeper` (paralelně k `PayoutSweeper`): periodický sweep —
      sesumarizovat ext credits coin=QTU, přepočet na QTC dle upstream
      výnosu (upstream pool payout → naše QTC wallet → rozdělení
      proporcionálně), odečíst `ZION_POOL_AUXPOW_FEE_PCT` (pool fee —
      transparentně v dashboardu), `QuantusAdapter.send_payment` na
      registrované adresy, min threshold (`QUANTUS_MIN_PAYOUT`).
- [ ] Alternativa pro early phase: payout jen v ZION s interním rate +
      „withdraw in QTC" opt-in per miner.
- [ ] **Pool fee model:** explicitní `auxpow_fee_pct` config (např. 1–2 %),
      vykreslen v `miners-dashboard` (profi pooly to ukazují) + fee ledger
      pro reconciliation.

### F5 — Nativní QTC wallet pod ZIS + desktop agentem

Dvě vrstvy:

- [ ] **Custodial (ZIS):** uživatel má QTC deposit adresu automaticky
      (F2) — receive + balance + history funguje ihned po F1/F2 v
      `/multichain` API + dashboard UI. Withdraw → F3 bridge nebo přímý
      `send_payment` (withdrawals.rs flow).
- [ ] **Non-custodial (desktop):** desktop agent generuje QTC keypair
      lokálně. Problém: v JS není ML-DSA-87 → možnosti:
      a) **WASM build `qp-rusty-crystals-dilithium`** (crate je no-std,
         kompiluje do wasm32) — preferované: `quantus-wallet-wasm` mini
         crate (keygen z 32B entropy → pubkey → ss58, sign) → bundlovat
         do `APP&WEB/desktop-agent/src/`; 
      b) shell-out na `quantus` CLI binary (bundle jako resource —
         ~10 MB, jednoduché, ale závislost na upstream binary);
      c) HD seed pod ZIS accountem: agent drží jen mnemonic, derivace
         on-demand.
      → Spike v F0 ověří wasm build; fallback = (b).
- [ ] `wallet-generator.js` rozšířit: `generateQuantusWallet()` →
      `{mnemonic?, qtcAddress, pubkey}`; store pod `wallets[].quantus`.
- [ ] UI: Wallet sekce — QTC tab (adresa + QR + balance přes RPC proxy
      `/api/multichain/quantus/balance/:addr` + send form → IPC →
      `QuantusAdapter.send_payment` přes multichain service nebo přímý
      ws submit s lokálně podepsaným extrinsicem).
- [ ] Receive flow: `wormhole` adresa pro mining rewards není potřeba —
      pool payout jde na transparent adresu; ale umožnit import
      existující Quantus 24-word phrase.

### F6 — Dual mining + „Triple engine" ZION/QTC primární preset

- [ ] Desktop agent: preset **„ZION + QTC"** jako primární volba v Home
      (algo=zion + gpuCoin=QTU + cpuCoin=off/auto) — one-click už funguje
      z předchozí práce; jen zvednout QTU na top seznamu + default preset
      v public buildu.
- [ ] Miner: ověřit QTU stream jako **primary external** v default
      profit-switch tabulce na poolu (pool side `AUXPOW_COIN` default QTU —
      už je), dokumentovat `ZION_STREAM2_FORCE_COIN=QTU`.
- [ ] SMOS zip / public release notes: „Dual mine ZION + QTC, jeden miner".
- [ ] Když bude vlastní quantus-node: možnost **solo mining QTC přes náš
      pool jako upstream** (pool = QTC stratum + template z node) —
      separate epic, `pool/src/` nový `qtc_stratum` modul (devel level:
      reuse AuxPowClient inverzí — náš stratum serve, miner connect).

### F7 — Miners community rollout

- [ ] Release: desktop-agent packaged installer + SMOS image s presetem.
- [ ] Dokumentace: „Mine ZION + QTC" guide (EN+CZ), payout options
      (ZION / QTC / split), pool fee disclosure.
- [ ] Dashboard: „Supported coins" stránka z `/api/v1/profit-switch`
      katalogu (máme) + per-coin payout status.
- [ ] Announcement: Quantus Discord/forum — první pool s native
      QTC payouts + dual mining (unikátní pozice: Quantus nemá
      multisig-pool ecosystem zatím zdaleka tak bohatý).

## 6. Cross-cutting

- **Secrets:** `QUANTUS_SEED`/keypair nikdy v repo/env souborech commitu —
  pouze `upload-secrets` / `/etc/zion/edge-environment.sh` placeholder.
- **Ticker:** interně `QTU`, UI/marketing `QTC (Quantus)` — viz §3.
- **Konfirmace:** `QUANTUS_MIN_CONF` default 30 (QPoW probabilistický —
  spike potvrdí; revidovat po mainnet zkušenosti).
- **Fee transparency:** pool fee i bridge fee vždy ve veřejném API/UI.
- **Testnet first:** celý F1–F3 validovat na Heisenbergu před Planckem.
- **Fallback RPC:** vlastní `quantus-node` na Edge jako sekundární
  (současně připraví solo-pool epic F6).

## 7. Acceptance matrix (shrnutí "hotovo" per fázi)

| Fáze | Done = |
|---|---|
| F0 | spike doc: metadata OK, testnet tx podepsaná+přijatá, finality rozhodnutá |
| F1 | adapter unit zelený + gated live test na testnetu (deposit detect + send) |
| F2 | `derive_deposit_address(Quantus)` vrací validní ss58, sign roundtrip |
| F3 | E2E na testnetu: QTC dep → ZION credit; ZION burn → QTC release; solvency report zahrnuje QTC |
| F4 | test miner s qtc payout addr dostane mainnet mikro-payout; fee ledger |
| F5 | desktop: QTC wallet create/balance/send na testnetu; ZIS linked address |
| F6 | public preset „ZION+QTC" one-click v release buildu |
| F7 | release notes + guide + dashboard coins page live |

## 8. Rizika a blockery

| Riziko | Mitigace |
|---|---|
| Trustless swap nemožný (runtime) | watchtower + open solvency; upstream návrh HTLC palletu; wormhole-burn pro QTC→ZION |
| subxt nesnáší jejich custom SignedExtensions | fallback `quantus-cli` dep nebo hand-rolled SCALE (spike F0) |
| ML-DSA v JS neexistuje | WASM build `qp-rusty-crystals-dilithium`; fallback bundled `quantus` CLI |
| QPoW reorgy (young chain) | 30+ conf, idempotent ledger, reorg watch v adapteru |
| QTC likvidita/cena feed slabá | fallback rate estimate v `profit.rs`, fee konzervativně |
| Upstream RPC výpadek | vlastní quantus-node na Edge (mining už máme — node navíc znamená i solo-pool future) |
| Ticker kolize QTC/QTU | interně QTU, display QTC — rozhodnout v §3 |

---

## 9. Předpokládané soubory (mapa změn)

```
V31/L1/types/src/chain.rs                    + Substrate/Quantus varianty
V31/L2/multichain/src/chain/adapters/quantus.rs   NOVÝ (hlavní kus)
V31/L2/multichain/src/chain/adapters/mod.rs       + registrace
V31/L2/multichain/src/chain/unified_registry.rs   + ChainId::Quantus
V31/L2/multichain/src/wallet/mod.rs               + ML-DSA derivace
V31/L2/multichain/src/multichain_wallet/*          deposit/ledger rozšíření
V31/L2/multichain/src/solvency.rs                  + QTC hot wallet
V31/L1/pool/src/payout.rs | qtc_payout.rs          NOVÝ sweeper
V31/L1/pool/src/v3_protocol.rs                     + payout_addresses hello
V31/L1/pool/src/store.rs                           + ext_share_credits tabulka
V31/L1/cosmic-harmony/src/profit.rs                (příp. QBC re-ticker)
APP&WEB/desktop-agent/src/wallet-generator.js      + generateQuantusWallet
APP&WEB/desktop-agent/src/ui/renderer.js + index.html  QTC wallet tab + preset
APP&WEB/desktop-agent/src/zis-client.js            + chain_type quantus
edge-deploy/config/edge-environment.sh             + QUANTUS_* placeholders
docs/quantus-spike.md                              NOVÝ (F0 výstup)
```

**Další krok:** F1 dokončení — live gated test na Heisenberg testnetu
(deposit detect + `author_submitExtrinsic` acceptance), `payment_queryInfo`,
pak F2 keyring/HD derivace. F0 spike = GO.
