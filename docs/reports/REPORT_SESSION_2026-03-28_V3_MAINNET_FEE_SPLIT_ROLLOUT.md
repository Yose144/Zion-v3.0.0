# ZION V3 Mainnet Fee-Split Rollout Report

**Datum:** 28. března 2026  
**Rozsah:** V3 core rollout na Prague, USA a Singapore mainnet nodech  
**Cíl:** dostat 89/5/5/1 reward split z pool accounting vrstvy přímo na chain a ověřit live payout workflow

---

## 1. Shrnutí

Rollout fee-split změny do `V3/L1/core` byl dokončen a live ověřen.

Po finálním fixu deployment manifestu začaly nové bloky obsahovat čtyři coinbase transakce přímo on-chain:

- miner: `89%`
- humanitarian: `5%`
- issobella: `5%`
- pool fee: `1%`

První jednoznačně ověřený split-enabled blok byl výška `465`. Následné bloky `471` a `472` stejný model potvrdily i na auditovaných USA a Singapore nodech.

---

## 2. Nasazené soubory

- `V3/Cargo.toml`
- `V3/L1/core/src/bin/node.rs`
- `V3/L1/core/src/discovery.rs`
- `V3/L1/core/src/emission.rs`
- `V3/L1/core/src/genesis.rs`
- `V3/L1/core/src/lib.rs`
- `V3/L1/core/src/node_builder.rs`
- `V3/L1/core/src/rpc.rs`
- `docker/docker-compose.v3-mainnet.yml`

Lokální release build `zion-core` před rolloutem proběhl úspěšně.

---

## 3. Root Cause a Fix

První rebuild a restart všech tří nodeů proběhl bez pádu, ale chain dál produkoval legacy single-output coinbase bloky.

Skutečný root cause nebyl v Rust implementaci, ale v nasazení:

- na serverech byla stale kopie `docker/docker-compose.v3-mainnet.yml`
- fee wallet env proměnné byly přítomné u pool služby, ale chyběly v `core`
- live `zion-core` tedy dostal pouze `ZION_MINER_ADDRESS`

Fix:

- na Prague, USA a Singapore byla synchronizována aktuální verze `docker/docker-compose.v3-mainnet.yml`
- `core` a `seed1` byly znovu recreated přes `docker compose --env-file .env -f docker/docker-compose.v3-mainnet.yml up -d core seed1`
- ve všech třech běžících `zion-core` kontejnerech bylo následně potvrzeno:
  - `ZION_MINER_ADDRESS`
  - `ZION_HUMANITARIAN_WALLET`
  - `ZION_ISSOBELLA_WALLET`
  - `ZION_POOL_FEE_WALLET`

---

## 4. Ověřený On-Chain Výsledek

### Proof block 465

První potvrzený split-enabled blok obsahoval čtyři coinbase transakce a vyplněné fee adresy.

Rozdělení `subsidy_zion = 5400067000000000`:

- miner: `4806059630000000`
- humanitarian: `270003350000000`
- issobella: `270003350000000`
- pool fee: `54000670000000`

Součet odpovídá přesně `89/5/5/1`.

### Následné potvrzení

- USA audit log zachytil announce a akceptaci bloku `471` se stejným čtyřvýstupovým coinbase modelem
- Singapore audit log zachytil announce a akceptaci bloků `471` a `472` se stejným modelem

To potvrzuje, že nejde o jednorázový blok, ale o stabilní runtime chování po rolloutu.

---

## 5. Stav Nodeů Po Rolloutu

### Prague

- split bloky začaly po manifest fixu vznikat normálně
- pool `/stats` ukázal zdravý provoz po restartu:
  - `shares.valid=128`
  - `shares.invalid=2`
  - `shares.total=130`
  - `routing.accept_rate_pct=98.461538...`
- v pool a miner logu se objevily jen očekávané transientní restart jevy:
  - jedno dočasné `Connection refused` na upstream RPC
  - jedno `UpstreamRejected`
  - jedno `JobMismatch`
- po restartu se share flow stabilizoval a akceptované share pokračovaly přes další výšky bloků

### USA

- kontejnery po auditu: `zion-core` healthy, `zion-seed-1` running
- `getChainInfo` vracel `chain_height=471` a `tip_hash=0002b00fd0315d7c7bd0d5197e70489eb847d02ebcd419651d4b6c997292c5b5`
- core log potvrzuje relay a akceptaci split bloku `471`
- neobjevily se opakované runtime chyby ani sync divergence

### Singapore

- kontejnery po auditu: `zion-core` healthy, `zion-seed-1` running
- `getChainInfo` vracel `chain_height=472` a `tip_hash=0001744b4d55140ec0ce72d1ba58fb15625b6b7cf8d96d1ab8cb465b105c73d1`
- core log potvrzuje relay a akceptaci split bloků `471` a `472`
- peer sync i outbound sync byly v auditu v pořádku

---

## 6. Závěr

Fee split už není pouze pool-side accounting. Po tomto rolloutu je reward split vynucen přímo v block template a validaci V3 core a je potvrzen live mainnet bloky.

Nasazení je považováno za úspěšné s těmito potvrzenými výsledky:

- V3 core na všech třech nodech běží se správnými fee wallet env proměnnými
- nové bloky obsahují čtyři coinbase transakce s rozdělením `89/5/5/1`
- Prague pool zůstal po restartu stabilní
- USA a Singapore zůstaly synchronizované a split-enabled bloky přijímají bez divergence

Hlavní provozní lesson learned: u V3 rolloutů vždy ověřit server-side kopii `docker/docker-compose.v3-mainnet.yml`, ne pouze lokální workspace verzi.