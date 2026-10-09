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
  upstream = **suprnova** (`quantus.suprnova.cc:7071`, 2026-10-09 přepnuto
  z k1pool — viz F8 ops note).
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
- [x] **LIVE ověřeno na Plancku (`QUANTUS_LIVE=1`):** `health_check` → synced,
      finalized height 1 229 291, `balance()` ss58→storage→decode celá cesta OK.
      **`payment_queryInfo` na ručně postaveném extrinsicu vrátilo
      `partialFee=1015602500` + weight → extrinsic dekódován chainem, encoding
      a signature layout validní.** `system_dryRun` je na public RPC disabled
      (unsafe) — podpisová validace se potvrdí prvním reálným submitem.
- [ ] **PENDING:** Heisenberg send test (`QUANTUS_LIVE=1` + faucet HEI) —
      `author_submitExtrinsic` acceptance end-to-end.
- [ ] **PENDING:** `transfer_all`/`batch` decode (jiné legální deposit cesty).
- [x] **2026-10-08 MAINNET SIGNING — ROOT-CAUSE OPRAVENO (2 bugy):**
      Live `--qtc-send` proti mainnetu padal `1010 bad signature`. Wire-level
      rekonstrukce skutečné mainnet transfer extrinsice (blok 11042, sqm
      indexer → raw bytes z vlastního nodu) + offline ML-DSA verify izolovalo
      přesnou příčinu:
      1. **`QUANTUS_EXTRINSIC` ctx** — Quantus doménově odděluje extrinsic
         podpisy FIPS-204 kontextem `b"QUANTUS_EXTRINSIC"`
         (`primitives/dilithium-crypto/src/signing_context.rs` v chain repu;
         jejich `Pair::sign` = `sign_with_context`). Sign bez ctx = runtime
         reject. Náš `QuantusKeypair::sign` nově předává `Some(QUANTUS_EXTRINSIC_CTX)`.
      2. **Era anchor na finalized head** — Quantus mainnet má finality lag
         ~105 bloků > era period 64 → `era.birth(current)` při validaci doběhne
         za anchor → checkpoint hash mismatch. `signing_context` nově anchuruje
         na **best head** (`chain_getHeader` + `chain_getBlockHash`), validity
         okno 64 bloků dopředu.
      **Důkaz:** reálný podpis z bloku 11042 verifikuje offline nad námi
      rekonstruovaným payloadem (call‖extra‖spec‖txv‖genesis‖checkpoint‖opt)
      s ctx=QUANTUS_EXTRINSIC → `VERIFY=true`; náš self-built extrinsic test
      `extrinsic_sig_self_verifies` interně konzistentní; live `--qtc-send`
      nově hlásí `Inability to pay some fees` (= podpis VALIDNÍ, selhává až
      platba poplatku na nefunded účtu). **Zbývá: první funded mainnet submit.**
      Pozn.: payload formát (extra=era‖nonce‖tip‖mode, additional=spec‖txv‖
      genesis‖checkpoint‖Option, mortal_era quantize=period>>12) byl celou
      dobu správně — spec 152 vs 153 metadata identická (12 extensions).

### F2 — Keyring + multichain wallet QTC support 🚧 ZÁKLAD HOTOV

- [x] `wallet/mod.rs`: `ChainFamily::Substrate` branch — `substrate_seed`
      = `keccak256("m/44'/189'/a'/0/i" ‖ master_seed)` →
      `QuantusKeypair::from_seed` (stejná konstrukce jako `zion_seed`;
      Dilithium není BIP32, oficiální HD scheme ověřit vůči `quantus key`
      CLI při prvním interoperabilita testu).
- [x] `keyring.address(Quantus)` → ss58-189 adresa; `keyring.sign(Quantus)`
      → 4627B ML-DSA-87 podpis; `quantus_keypair(a,i)` export pro adaptér.
- [x] `multichain_wallet::derive_deposit_address` — funguje automaticky
      (volá `keyring.address`), deposit finality = 30 bloků, ticker QTC.
- [x] `QuantusAdapter::with_keyring` — custodial signer (0,0), fallback env.
- [ ] ZIS: ověřit `ZisLinkedAddress.chain_type="quantus"` end-to-end
      (zis_auth mapping hotový, API cesta neověřená).

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

### F4 — Pool payouty v QTC i ZION 🚧 PIPELINE IMPLEMENTOVÁNO (2026-10-09)

Dnes: upstream AuxPoW earnings padají na náš bridge wallet, minery
dostávají jen ZION PPLNS. Cíl: **per-coin attribution + volitelné payouty**.

**Implementováno — chain-aware payout pipeline:**

- [x] `PayoutEntry.payout_chain: Option<String>` + `chain()` helper;
      `PplnsEngine` drží `chains[]` paralelně k `addresses[]`,
      `register_address_with_chain`, `payout_chain_for`; snapshot pole
      `payout_chains` (`#[serde(default)]` — zpětně kompatibilní).
- [x] Worker→payout routing (`pool.rs`): `qtc:<ss58>` / `qtu:<ss58>` /
      bare `qz…` SS58-189 → chain `"quantus"`; `zion1…` → `"zion"`;
      jiné → pool wallet fallback. Funguje pro stratum `mining.authorize`
      (`register_worker`), per-share (`record_share` →
      `worker_payout_target`) i v3 Hello `payout_address`
      (`register_payout_address` — pole se dřív ignorovalo!).
- [x] `Pool::take_pending_payouts` drainuje jen ZION entries (externí
      zůstávají); `take_external_payouts(chain)` + `pending_external_payouts`.
- [x] Admin API: `GET/POST /admin/external-payouts?chain=quantus`
      (X-Admin-Key auth) — GET preview, POST atomicky drainuje a vrací
      `{height, miner_id, address, amount_flowers, share_count}[]`.
- [x] **`QtcPayoutSweeper`** (`zion-multichain/src/qtc_payout.rs`, spawn v
      `server.rs`): env `QTC_PAYOUT_ENABLED=1` + `QTC_PAYOUT_POOL_API` +
      `QTC_PAYOUT_ADMIN_KEY` + **`QTC_PLANKS_PER_FLOWER`** (kurz flowers→
      planks, povinný — žádný default) + interval/min/max-attempts.
      Ledger `ext_payout_records` (sqlite): `queued → submitted →
      confirmed | stalled`. **Fail-closed:** `queued` rows přeživší
      restart → `stalled` (crash mezi submit a ledger-write je
      nerozlišitelný → manuální review, žádné auto-retry double-pay).
      Pool fee zůstává v ZION (amount je post-fee miner share).
- [x] Testy: 4 nové v `pool.rs` (parse prefix, ext registrace, v3
      payout_address routing, drain partitioning) — 185/185 pool,
      714/714 multichain PASS.

**Operátorský env (Edge `/etc/zion/edge-environment.sh`, necommitovat):**

```sh
# QTC payout leg — multichain (warpd) service
QTC_PAYOUT_ENABLED=1
QTC_PAYOUT_POOL_API=http://127.0.0.1:<pool-api-port>
QTC_PAYOUT_ADMIN_KEY=<same value as pool ZION_ADMIN_KEY>
QTC_PLANKS_PER_FLOWER=<rate: planks per 1 flower of pool reward — REQUIRED>
QTC_PAYOUT_INTERVAL_S=60        # default 60
QTC_PAYOUT_MIN_PLANKS=0         # dust threshold
QTC_PAYOUT_MAX_ATTEMPTS=3       # → 'stalled' po N submit chybách
QTC_PAYOUT_FEE_BPS=0            # pool fee na QTC legu (200 = 2 %)
QTC_PAYOUT_MAX_FEE_PLANKS=0     # fee-cap přes payment_queryInfo (0 = bez capu)
                              #   mainnet observed fee ≈ 0.8–1.0e9 planks/tx
# Quantus signing/RPC (sdílené s adaptérem — payout účet = wallet keyring (0,0)
# nebo QUANTUS_SEED hex 32B; MUSÍ být funded, jinak InsufficientFunds)
# MAINNET: žádný public RPC neexistuje — náš node je endpoint:
QUANTUS_RPC=http://127.0.0.1:9944      # Edge (nebo https://rpc.zionterranova.com/qtc)
# QUANTUS_SEED=<hex — jen pokud není wallet keyring; 600 perms!>
```

**Zbývá:**

- [ ] Per-coin share attribution pro AuxPoW zdroje (credits) — ZION-share
      reward konverze je model „ZION mined → vyplaceno v QTC dle
      `QTC_PLANKS_PER_FLOWER`"; upstream-earnings passthrough (QTC z QTU
      bridgů) je navrch.
- [x] Fee na QTC legu — `QTC_PAYOUT_FEE_BPS` + `fee_native` ledger sloupec
      (backfill migrace). **2026-10-09**
- [x] `payment_queryInfo` fee estimate (`estimate_transfer_fee`) +
      `QTC_PAYOUT_MAX_FEE_PLANKS` cap — over-cap rows čekají další tick.
      **2026-10-09**
- [x] Admin surface: `GET /v1/admin/ext-payouts?chain&status&limit` +
      `POST /v1/admin/ext-payouts/resolve` (`resubmit`/`dismiss` — jen
      'stalled' rows, fail-closed). Pool `/stats` expose
      `external_payouts.quantus.pending`. **2026-10-09**
- [x] **Payout chain E2E live ověřen (2026-10-08, do queue):**
      v3 Hello `payout_address="qtc:qz…"` → `v3_payout chain=quantus`;
      reálný miner `--wallet qtc:qz…` → 6 valid shares accepted →
      `unpaid` pod `quantus` chain tagem → `payout_chains` persist v
      `pool-pplns.json` → admin `GET /admin/external-payouts?chain=
      quantus` → `pending:0` (správně — unpaid 0.18 Z < min 10 ZION).
      Zbývá už jen organický unpaid threshold → drain → sweeper submit.
- [ ] První reálný QTC payout submit — čeká na unpaid ≥ min +
      `QTC_PAYOUT_ENABLED=1` + funded payout účet (`warpd` Oct-8 redeploy
      má `QUANTUS_EXTRINSIC` fix).
- [x] **Kurz + treasury gate (2026-10-09, `32467e141`):**
      `QTC_PLANKS_PER_FLOWER` přijímá **decimal** přes exact ratio
      (`"1.2386"` → 12386/10000 — integer u128 by ztratil ~19 % při
      sub-1 rate). Konfigurováno na Edge: **1.2386** (CoinGecko
      `quantus` = $161.47; ZION $0.0002 → 1 QTC ≈ 807 350 ZION;
      1 flower = $2e-10 → 1.2386 planks). Re-derive:
      `planks_per_flower = (0.0002 / qtc_usd) * 1e12 / 1e6`.
      **Treasury balance gate:** před submitem sweeper čte free balance
      payout účtu; `amount+fee > free` → row se parkne jako **'deferred'**
      (attempts=0, nikdy submitted → přežije restart) místo pálení
      attempts na deterministický InsufficientFunds. Deferred→queued
      přechod se zapíše před submitem (crash-window fail-closed).
      Mainnet fee změřen z indexeru: **0.8–1.0e9 planks/tx** → cap 2e9.
      Treasury `qzpnKFmb…` = 0 → enable bezpečné: vše se queueuje jako
      deferred, vyplatí se až po collectu prvního bloku.
      **ENABLED 2026-10-09:** warpd redeploy (`32467e141`, atomic swap +
      backup), `QTC_PAYOUT_ENABLED=1`, sweeper running (60s).
- [x] Desktop payout routing (2026-10-09): `payoutCoin` config
      ('zion'|'qtc') + **Pool payout select** v QTC kartě → miner start
      posílá `--wallet qtc:<linked qz…>` (pool crediting do quantus
      queue). Chybějící link → fail-closed dialog, ne tichý ZION.
- [ ] E2E na Heisenberg s funded test účtem — gated test
      `quantus_live_send_testnet` připraven (`QUANTUS_LIVE=1` +
      `QUANTUS_RPC=…heisenberg` + `QUANTUS_SEED`), potřebuje HEI faucet.

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
- [x] ~~`wallet-generator.js`~~ → `quantus-wallet.js` (2026-10-08):
      `generate-quantus-wallet` / `derive-quantus-address` /
      `validate-quantus-address` / `quantus-get-balance` IPC; derivace přes
      bundled `zion-derive-addr` helper (možnost (b), stejná derivace jako
      ZIS custodial); `qtcAddress` persistováno ve wallet JSON.
- [x] UI: Wallet overview — **QTC karta** (2026-10-09): linked qz… adresa +
      live balance (`quantusGetBalance`, 12-dec precision string) + copy +
      refresh; unlinked stav: link input (`wallet-set-qtc` IPC) nebo
      generate (`generate-quantus-wallet` → 24-word mnemonic reveal +
      auto-link); `list-wallets` vrací `qtcAddress`; **Pool payout**
      select (ZION/QTC → `payoutCoin` config).
- [x] **Generate-fix (2026-10-09, `32467e141`):** root cause selhání „nejde
      generate" = unhandled IPC rejection na starém procesu
      (`No handler registered` → status řádek zůstal prázdný, tiché „nic
      se neděje"). `deriveQuantusAddressDetailed` vrací konkrétní důvod
      (helper path/spawn/exit-status/stderr tail, `sk=`/`pk=` redacted);
      renderer chytá invoke chyby a hlásí „restart the app".
- [x] UI: Wallet → **Quantus network tab** (2026-10-08, `955a086ce`):
      `quantus-network.js` agreguje node status (`system_health`/`version`),
      pool native leg (`coin_details[].native`), wormhole rewards
      (sqm `minerRewards`), network feed + adresní lookup
      (balance + transfer history); IPC `qtc-network-status`,
      renderer `initQtcView` s 15s pollem. Public RPC default
      `rpc.zionterranova.com/qtc` (náš node — Safe methods, unsafe
      z proxy zamítnuty). Market řádek: CoinGecko `quantus` USD +
      odvozený cross (zion_per_qtc, planks/flower).
- [x] Send flow (non-custodial): `native-send` IPC →
      `NativeWallet.sendQuantus` → bundled `derive_addr --qtc-send`
      (mnemonic jen stdin). **Wire+signing live-validováno mainnet:**
      extrinsic s `QUANTUS_EXTRINSIC` ctx + tip-anchored era projde
      podpisem → runtime hlásí `InsufficientFunds` (ne Bad signature)
      pro unfunded sender — `f7422d661`. Bundled helper rebuildnutý
      2026-10-08 (ctx + mainnet RPC + `--qtc-balance`). Gated: reálný
      funded submit.
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
- [ ] Když bude vlastní quantus-node: viz **F8 — nativní QTC pool**.

### F8 — Nativní QTC pool (hybrid native + upstream) — **ROZHODNUTO 2026-10-09**

**Protokol (zjištěno ze spike + docs.quantus.com/deep-dives/miner-protocol):**
Quantus mining je **invertovaný proti stratenu** — node je block-author:
staví blok (včetně reward adresy) a jako QUIC server (`--miner-listen-port`,
default 9833) rozesílá miner-klientům `NewJob{job_id, mining_hash,
difficulty(U512 dec)}`. Miner hledá `poseidon2_squeeze_twice(header_hash‖nonce)
< target` a vrací `JobResult{job_id, nonce, work(64B hex), hash_count}`.
Žádný getWork/stratum RPC. Autentizace: `Ready{token}` + QUIC ALPN
`quantus-miner`, insecure cert verifier (self-signed node cert).

**Architektura (žádný externí pool — jen náš node + náš pool):**

```
quantus-node (Edge, Planck sync, --miner-listen-port, reward → pool QTC účet)
   │ QUIC NewJob ─────────────────────────────┐
   ▼                                         │
QtcJobSource (pool/src/qtc_native.rs)         │ JobResult (net-diff nonce)
   │ v3 stratum jobs (QPoW kernel existuje)   │
   ▼                                         │
mineři → shares (share-diff validace) ────────┘
   │
   ▼ block found → reward na náš payout účet
QtcPayoutSweeper (F4 ✅) → PPLNS výplata v QTC, fee zůstává
```

**⚠️ Korekce topologie (2026-10-08, live probe):**
- `--chain mainnet` je **nový řetězec** (`system_chain`="Quantus", symbol
  `QTC`, 7 bootnodů `a{1-7}-p2p-mainnet.quantus.com`);
  `a1-planck.quantus.cat` = **retired public testnet** (symbol `PLK`).
- **Žádný public mainnet node RPC neexistuje** (privacy-first chain —
  explorer/mobile jedou čistě přes indexer) → **náš Edge node JE náš
  endpoint**: vystaveno `https://rpc.zionterranova.com/qtc` →
  `127.0.0.1:9944` (nginx `location = /qtc`, POST-only,
  `Host: 127.0.0.1:9944` — node host-whitelist chce port-formu) + node
  `--rpc-methods Safe` (unsafe RPC i z localhost proxy zamítnuty — ověřeno
  `system_addReservedPeer`/`author_rotateKeys` → -32601). Defaults
  přepnuty: adapter `DEFAULT_RPC_URL`, derive_addr, desktop
  `quantus-wallet.js`.
- **Indexer duality:** `sqm.quantus.com` = **mainnet** squid
  (miner_reward ~0.31 QTC/blok (310e9 planks, 12 dec), height ≡ našemu tipu);
  `sub2.quantus.com` = **Planck testnet** (~1.23M blk). `collect-rewards`
  default je sub2 → na Edge script předává explicitně `--subsquid-url
  https://sqm.quantus.com/v1/graphql`. **Lag:** sqm indexer běží ~200–300
  bloků (~20–90 min) za node tipem (ověřeno 2026-10-08: node 189293 vs
  indexer 189029) → history v UI je záměrně zpožděná; pro real-time
  nonce/balance vždy node RPC (`system_accountNextIndex`/`state_getStorage`),
  indexer jen pro přehled.
- **Mining rewards jdou POUZE na wormhole adresy** — node dostává
  `--rewards-inner-hash <32B>` (preimage → wormhole adresa). Sweep =
  wormhole **exit** přes ZK proof (`wormhole prove` → verify extrinsic),
  ne plain transfer.
- Nový protokol: `Ready { token }` — node generuje `miner-auth-token`
  soubor (0600) + `miner-tls-cert-sha256` pro pinning.
- **⚠️ ALPN je verzovaný** — v1.0.2-Qm vyžaduje `quantus-miner/2`
  (bare `quantus-miner` → TLS error 120, ověřeno live).

**Wormhole spend-chain (live ověřeno 2026-10-08):**
`secret = hash(seed)` z `WormholePair`; `inner_hash = poseidon("wormhole"‖secret)`
= náš `--rewards-inner-hash`; `wormhole_addr = poseidon(inner_hash)` =
`poseidon²("wormhole"‖secret)` = `qzk8Rna5…`. Leaf `secret` pro
`wormhole prove` = `pair.secret()` — derivovatelné z keygen mnemonic přes
`derive_wormhole_from_mnemonic` (hdwallet 4.1.1). Nástroj:
`derive_addr --qtc-wormhole-secret [idx]` — **E2E ověřeno**: test key →
`address`+`inner_hash` ≡ node output, `quantus wormhole address
--secret-file` → identická adresa. Spend secret na Edge:
`/opt/quantus/rewards-spend.secret` (0600).

**Kroky:**

- [x] **F8.1 Node deploy (Edge):** `quantus-node v1.0.2-Qm` z GitHub
      release → `/opt/quantus/bin`; node key + wormhole vygenerováno
      (secret `/opt/quantus/wormhole-key.secret` 0600); rewards wormhole
      **`qzk8Rna5KBtuqb5g6eEzEVRAsdbpCo5Mhn7k6eggeR4ZVn2aP`**; systemd
      `zion-quantus-node` (`--validator --miner-listen-port 9833 --chain
      mainnet --sync full`); ufw 30333; token file
      `/opt/quantus/data/chains/mainnet/miner-auth-token`; RPC localhost
      :9944. Sync probíhá — **mining paused dokud node není na tipu**
      (joby nechodí, správně). **2026-10-08**
- [x] **F8.2 `QtcJobSource` (pool):** `qtc_native.rs` — vendored protokol
      (Ready{token}/NewJob/JobResult, 4B-BE len+JSON, QUIC ALPN
      `quantus-miner/2`, insecure verifier); JobPackage `qtun:` prefix;
      local share validation `get_nonce_hash` vs share_target;
      net-target → `JobResult` do node. Config `QTC_NATIVE_ENABLED` +
      `_NODE_ADDR` + `_TOKEN_FILE` + `_SHARE_PCT` + `_SHARE_DIFF`.
      **2026-10-08, `caaf52008`** — live handshake OK (fixy: rustls
      CryptoProvider explicit ring `b820c2dfa`, ALPN `/2` `a4f17f96a`,
      token file `root:zion 640` + ExecStartPost).
- [x] **F8.3 Hybrid policy:** per-**job** `serve_native` flag
      (`job_seq %100 < pct` — každý miner dostane stejný zdroj per-block,
      fingerprint-safe); stale native (>90s) → auto upstream fallback.
      Env na Edge: `QTC_NATIVE_ENABLED=1`, `_SHARE_PCT=5` (lottery).
      **2026-10-08** + fix `d3fb50f88` (target inversion).
      **E2E OVĚŘENO:** při `_SHARE_PCT=50` stratum probe viděla
      `external_stream.job_id="qtun:N"` v broadcast Job lines; desktop
      miner (1070 Ti, QPoW CUDA) joby přijal a **native shares accepted
      live** (`qtun:188…193`, pool lokálně validoval hash < share_target
      → Accepted/PPLNS). Dial zpět na 5 (lottery split).
- [~] **F8.4 Reward→payout wiring:** block rewards akumulují jako **ZK-trie
      leaves** na wormhole `qzk8Rna…`. Sweep = `quantus wormhole
      collect-rewards` (CLI 2.3.0 — interně: subsquid dotaz na pending
      transfery → per-leaf ZK proof → verify extrinsic → mint spendable
      QTC na exit account). **Live ověřeno:** `generated-bins` circuits
      (284K, deterministické — postaveny lokálně kvůli Edge OOM při
      prvním buildu, rsyncnuty; ~5.9GB vm / ~30s build), subsquid
      `sub2.quantus.com` indexuje mainnet live (miner_reward tabulka,
      ~0.27–0.31 QTC/blok), `--dry-run` → 0 pending (žádné bloky zatím).
      Provisioned: `rewards-spend.secret` (0600), `payout-destination.txt`
      = **`qzpnKFmb96enuCGmxnmW45n3F57xuwwwabyCeLA9fLv8sFaec`** (keyring
      (0,0) — stejný signer jako QtcPayoutSweeper). ⚠️ destination MUSÍ
      být transparentní účet — wormhole adresa nemá Dilithium klíč.
      Installed: `/opt/quantus/collect-rewards.sh` (flock+guard) +
      `zion-quantus-collect.timer` (hodinový, **neaktivní** — zapnout po
      prvním mined bloku). **`zion-quantus-reward-watch.timer`** (10 min,
      sqm `minerRewards` probe → journald `pending_leaves=N`) běží —
      detekce prvního bloku bez collectu. **`warpd` redeployed Oct-8**
      @`2cf818fa1` — má `QUANTUS_EXTRINSIC` signing fix (předchozí Oct-7
      binárka by produkovala Bad signature). Zbývá: první live collect +
      ledger credit wiring do QtcPayoutSweeper účetnictví.
- [~] **F8.5 Měření a rozhodnutí:** ~~dashboard `coin_details[].native`~~ ✅
      `{enabled,connected,share_pct,job_id,job_age_ms}` (`dcc651fd3`).
      **2026-10-08 post-sync fakta:**
      - Node fully synced: `currentBlock=highestBlock=189215`,
        `isSyncing:false`, 28 peers. `NewJob` streamuje (`qtun:N`),
        dashboard `native{connected:true, job_id:"qtun:21"}`.
      - **`difficulty` v `MiningRequest` je DIFFICULTY (expected
        hashes/block), NE target** — `qpow_math::is_valid_nonce`:
        `target = U512::MAX / difficulty; hash < target`. Náš kód
        porovnával `hash < difficulty` → **kritický bug** (winning
        nonce by se nikdy neforwardoval; `d3fb50f88` fix).
      - `QPoW.CurrentDifficulty` storage (mainnet) =
        **622 135 548 984 111** (~6.2e14 expected hashes/block);
        bloky jdou ~5–20s ⇒ implikovaný network hashrate **~5×10¹³ H/s
        (~50 TH/s)** — náš ~40–73 MH/s je ~7–8 řádů pod ⇒ **native
        leg = čistá loterie** (odhad ~100–360 dní/blok při současném
        hashrate). Upstream pool zůstává povinný earnings floor;
        `QTC_NATIVE_SHARE_PCT` držet nízké (1–5 %) jako lottery +
        protokolová validace, ne jako výdělečná cesta.
      - **Změřeno live (2026-10-08, 3min okno):** 12.0 s/blok, 7195
        bloků/den ⇒ network ~5.18e13 H/s (**~52 TH/s**). Očekávaný
        výnos native legu: 30 MH/s → **~240 dní/blok**, 73 MH/s →
        **~99 dní/blok**. Potvrzuje: pct zůstává 5, upstream floor
        povinný — nativní = lottery + protokolová připravenost.
      - **Upstream přepnut k1pool → suprnova (2026-10-09):** kandidáti
        pro „vyplácí hned" otestováni live login probem (všechny mluví
        stejným miningcore `login`/`job`/`submit` dialektem — bridge
        kompatibilní bez změny kódu): suprnova :7071 (1% PPLNS,
        **min 0.01 QTC**, hourly — NEJNIŽŠÍ práh), luckypool
        `eu.lproute.com:5660` (1%, min 0.11 QTC, 30min maturity,
        hourly), qelvhash :4444 (1%, min 0.10 QTC, hourly, 110 confs),
        kryptex :7049 (3% PROP, statická diff 18.2e9 — příliš vysoká
        pro náš hashrate). **⚠️ Wallet gotcha:** k1pool login byl
        account-name `KrUVFgKLb…` (off-chain balance → payout přes
        jejich UI); suprnova login = přímo `qz…` adresa → on-chain
        výplata. **Canonical QTC wallet =
        `qzjoHwaJ2GfiRSHyYkYcpoJFbHct9pb9EAbs7sE51Uhj8r2zb`**
        (SS58-189 ✓, externí — secret mimo Edge) → suprnova vyplácí
        pool revenue tam; sweeper hot treasury zůstává `qzpnKFmb…`
        (keyring (0,0), signuje miner payouty) → deferred řádky se
        zafundují převodem canonical→treasury po prvním upstream
        payoutu (nemusí se čekat na lottery blok). Edge env:
        `ZION_POOL_AUXPOW_POOL_QTU=quantus.suprnova.cc:7071` +
        `ZION_POOL_AUXPOW_WALLET_QTU=qzjoHwa…`; code default
        `ExternalCoin::Quantus::default_pool()` přepsán (`779116a27`).
        E2E ověřeno: shares `Accepted` na suprnově, API
        `/api/pools/quantus/miners/<addr>` → `pendingShares`, worker
        `zion-pool` ~0.9 GH/s.
      - ⚠️ **Ops gotcha (2026-10-08):** pool čte `miner-auth-token`
        **jen při startu**. Node při restartu přegeneruje token file
        na `600` (ExecStartPost `sleep 2` může předběhnout zápis) →
        pool bez práva čtení → `cannot read token file` → **prázdný
        token na všechny reconnecty** → node `invalid auth token`
        loop. Postup po restartu nodu: ověřit `ls -l` (očekáváno
        `-rw-r----- root zion`), jinak `chmod 640` + restart poolu.
- [~] **F8.6 Testy:** ~~codec roundtrip unit testy~~ ✅ (3 varianty +
      oversize/truncated reject); ~~mock QUIC server~~ ✅
      `mock_node_ready_newjob_result_e2e` — rcgen self-signed + quinn server
      vs **reálný `connect()`** (ALPN `/2`, insecure verifier): Ready auth →
      NewJob → JobResult E2E. **9/9 qtc_native testů**. Live ověření po
      syncu (pct bump → joby do minerů → JobResult → wormhole credit).

**Hashrate strategie (variance):** native leg má variance (platíme jen
z bloků) → hybrid drží upstream (suprnova) leg jako guaranteed-earnings
floor.
Bootstrap: 0 % fee / ZION bonus pro native-leg minery zvažte.

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
| F8 | native-leg blok nalezen na Heisenbergu; Planck: reward připsán na payout účet, miner vyplacen v QTC přes sweeper; hybrid split měřitelný v dashboardu |

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
V31/L1/pool/src/v3_pplns.rs                        + payout_chain (✅)
V31/L1/pool/src/pool.rs                            + qtc:/qz routing (✅)
V31/L1/pool/src/api.rs                             + /admin/external-payouts (✅)
V31/L2/multichain/src/qtc_payout.rs                NOVÝ sweeper (✅)
V31/L2/multichain/src/db.rs                        + ext_payout_records (✅)
V31/L1/pool/src/store.rs                           + ext_share_credits tabulka
V31/L1/cosmic-harmony/src/profit.rs                (příp. QBC re-ticker)
APP&WEB/desktop-agent/src/wallet-generator.js      + generateQuantusWallet
APP&WEB/desktop-agent/src/ui/renderer.js + index.html  QTC wallet tab + preset
APP&WEB/desktop-agent/src/zis-client.js            + chain_type quantus
edge-deploy/config/edge-environment.sh             + QUANTUS_* placeholders
docs/quantus-spike.md                              NOVÝ (F0 výstup)
```

**Další krok:** F4 dokončení — funded Heisenberg E2E (deposit detect +
`author_submitExtrinsic` + mikro-payout přes sweeper), `payment_queryInfo`
fee-cap, `QTC_PAYOUT_FEE_PCT`, payout-history admin endpoint. F0 spike = GO,
F1/F2 základ + F4 pipeline hotovy.
