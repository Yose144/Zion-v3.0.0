# V3 Mainnet Report — 2026-03-15

> Scope: V3 clean-room mainnet line only
> Workspace: 2.9.6-main / V3
> Focus: runtime hardening, RPC clarity, transaction-model convergence entrypoint

## Executive Summary

V3 mainnet line prošla další produkční hardening vlnou zaměřenou na tři oblasti:

- bloková validace a coinbase invarianty,
- JSON-RPC surface a operátorská srozumitelnost,
- první bezpečný krok ke konvergenci account runtime a připraveného UTXO modelu.

Aktivní runtime je stále account-style cesta v `V3/L1/core/src/lib.rs`, ale už nevisí čistě na account-only interních strukturách. Mempool, active template a journal flow nyní používají interní runtime adapter, zatímco veřejné RPC, accepted block reprezentace a persisted snapshot formát zůstávají kompatibilní se současným provozem.

## Co bylo dokončeno

### 1. Fee burn a coinbase konzistence

- miner reward byl dorovnán na subsidy-only model,
- fees zůstávají burned a nejsou připisovány coinbase transakci,
- template reward a accepted block reward už mají stejnou sémantiku.

### 2. Plná bloková validace pro lokálně vytěžené bloky

- lokálně submitnutý candidate už prochází stejnou blokovou validací jako peer-import path,
- coinbase je validována na pozici, amount, fee, nonce, miner address a deterministické tx id,
- přidány guardy proti duplicate tx id a duplicate sender+nonce v rámci bloku.

### 3. Timestamp bug ve full validation pipeline

- `validation.rs::validate_block()` už bere explicitní `block_timestamp`,
- odstraněno maskování timestamp checku přes `ctx.current_time`,
- přidán regresní test na future timestamp reject.

### 4. Pool a miner identity hardening

- pool ověřuje `algorithm` už v hello handshaku,
- submit payload už nemůže přepsat session identitu miner/worker,
- node-facing submit jde vždy přes session-bound identitu.

### 5. JSON-RPC surface cleanup

- přidány explicitní aliasy:
  - `getAccountBalance`
  - `getAccountTransaction`
  - `submitAccountTransaction`
- `submitTransaction` zůstává jako srozumitelný account-style alias,
- `sendRawTransaction` už jasně odmítá raw hex string payload,
- `getBalance` explicitně odmítá `zion1...` UTXO adresy, aby endpoint nepředstíral podporu, kterou aktivní runtime ještě nemá,
- `getChainInfo`, `getNodeInfo` a `getMempoolInfo` vrací metadata o aktivním transaction modelu.

### 6. První transaction-model unifikace uvnitř runtime

- zaveden `SubmittedTransaction` parser pro account i UTXO payload na boundary,
- zaveden interní `RuntimeTransaction` adapter,
- mempool už interně drží runtime adapter místo čistého `Vec<Transaction>`,
- active template už interně drží runtime adapter,
- chain journal už interně používá runtime adapter,
- persisted snapshot a public RPC zůstávají account-compatible.

## Produkční význam změn

Tyto změny neposouvají V3 do finálního UTXO mainnet runtime, ale výrazně snižují provozní riziko v aktuální fázi:

- veřejné RPC už méně mate operátora a automatizaci,
- lokálně vytěžený blok už nemůže obejít blokové invarianty,
- vnitřní runtime struktury jsou připravenější na další krok směrem k UTXO acceptance path,
- journal a snapshot cesty zůstaly kompatibilní, takže nehrozí zbytečný deploy break kvůli formátu stavu.

## Ověření

V této session bylo ověřeno:

- `cargo test --manifest-path V3/L1/core/Cargo.toml rpc::tests:: -- --nocapture`
  - 32/32 passed
- `cargo test --manifest-path V3/L1/core/Cargo.toml`
  - 358/358 passed
- `cargo test --manifest-path V3/L1/pool/Cargo.toml`
  - green v předchozí navazující validaci této hardening vlny

Focused regresní pokrytí zahrnovalo navíc:

- reject lokálně poškozené coinbase,
- journal recovery bez snapshotu,
- account alias RPC calls,
- explicitní reject UTXO payloadu na aktivní account runtime boundary,
- internal mempool adapter regression.

## Aktuální stav V3

### Silné stránky

- consensus a block acceptance jsou znatelně tvrdší než při vstupu do této vlny,
- peer import a local mining flow jsou sémanticky bližší,
- JSON-RPC surface je auditovatelnější a méně zavádějící,
- deploy docs už správně drží RPC jako host-local only,
- pool session flow je tvrdší proti spoofingu.

### Co ještě není hotové

- aktivní runtime stále neakceptuje UTXO transakce jako první-class path,
- accepted block reprezentace je stále account-style,
- active runtime zatím neumí journal replay UTXO transaction entry,
- HTTP JSON-RPC server a auth middleware z L1 testnet parity stále chybí,
- full async P2P a parallel multi-peer IBD stále chybí.

## Doporučené další kroky

1. Zavést skutečný bridge z `tx.rs` UTXO transaction do active mempool acceptance path místo dnešního explicitního rejectu.
2. Teprve potom řešit konvergenci accepted block reprezentace a block body serialization.
3. Po transaction path sjednocení přidat targeted deploy rehearsal se snapshot restore a journal replay na host-local RPC režimu.
4. Následně řešit HTTP/auth RPC vrstvu a async P2P jako další produkční vrstvu, ne předčasně.

## Závěr

V3 není po této session finální mainnet candidate, ale je výrazně blíž produkčnímu stavu než před synchronizací a auditem z 15. 3. 2026. Největší architektonický dluh už není skrytý: je explicitně oddělený, částečně adaptovaný a připravený na další řízený krok bez nutnosti rozbít současný runtime nebo persisted state.