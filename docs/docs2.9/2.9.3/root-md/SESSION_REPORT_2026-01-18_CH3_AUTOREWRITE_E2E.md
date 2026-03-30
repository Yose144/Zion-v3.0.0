# SESSION REPORT: CH v3 Autorewrite + E2E (job → mine → submit)
**Date:** 18. ledna 2026  
**Focus:** postupné odstranění TODO/stubů (Rust), reálné napojení na pool, profit router na WhatToMine, a E2E flow; drobný fix logování v Python poolu  
**Status:** ✅ Implemented, unit-tested, pushed to `main`

---

## 🎯 Cíl dne
- Dovést CH v3 od „mock/stub“ stavu k reálnému provoznímu flow:
  - pool connect + job ingest + share submit
  - profit routing z reálných WhatToMine dat
  - revenue účtovat jen za exporty, které splní difficulty
  - engine helper: pool job → mining → submit (E2E)
- Udržet „git hygiene“: malé cílené commity, průběžné testy

---

## ✅ Hotovo (shrnutí změn)

### 1) CH v3: Profit router na WhatToMine (bez mocků)
- ProfitRouter byl přepnut na reálný backend `WhatToMineClient`.
- Přidány guardy na nulové hodnoty (např. `current_profit == 0`).

**Commit:** `607ff0c` – "feat(chv3): real pool manager + whattomine router"

### 2) CH v3: PoolManager „naostro“ (Stratum/XMRig JSON-RPC)
- Implementováno:
  - TCP connect
  - login fallback (XMRig `login` → fallback `mining.subscribe` + `mining.authorize`)
  - čtení `mining.notify` a udržování “aktuálního jobu”
  - `submit_share`/`mining.submit`
  - best-effort `getjob` (když pool podporuje)
- Debug fixy během integrace:
  - `error: null` není error
  - lifetimes/borrow okolo watch receiveru

**Commit:** `607ff0c`

### 3) CH v3: Revenue gating podle difficulty + wiring PoolManager do engine
- `RevenueCollector::track_export()` ignoruje exporty, které nesplnily difficulty.
- Engine drží `pool_manager: Arc<PoolManager>` a umí:
  - připojit pooly z configu (best-effort)
  - získat job pro pool/algo
  - odeslat share přes PoolManager

**Commit:** `42540ca` – "feat(chv3): wire PoolManager into engine + gate revenue by difficulty"

### 4) CH v3: E2E helper (job → mine → submit)
- Přidány helpery pro:
  - dekódování job blobu (hex)
  - sestavení vstupu pro hash (blob bytes + appended nonce LE)
  - volbu hash/resultu dle algoritmu
- Nová metoda:
  - `mine_and_submit_from_pool(pool_id, nonce, difficulty)`
- Přidán E2E test s lokálním mock stratum serverem.
- Fix v testu: oneshot sender se nesmí použít vícekrát → `Option<Sender>` + `take()`.

**Commit:** `ee83b38` – "feat(chv3): engine e2e mine+submit via PoolManager"

### 5) Universal miner: NCL wiring (bez TODO)
- `zion-universal-miner` předává `NCLClient` a po connect posílá `ncl.register`.

**Commit:** `d7535fd` – "feat(universal-miner): wire NCL client to stratum"

### 6) Python pool: fix CH3 init logging
- Drobný fix logování CH3 init (stdlib).

**Commit:** `baeb88a` – "Fix CH3 init logging (stdlib)"  
**Soubor:** `src/pool/zion_pool_v2_9.py`

---

## 🧩 „Pod jakými algo?“ (CH v3 keys)
CH v3 používá `AlgorithmType` (Rust enum). Relevantní pro configy:
- Native: `Keccak256`, `Sha3_512`, `GoldenMatrix`, `CosmicFusion`
- GPU: `Autolykos2`, `KawPow`, `KHeavyHash`, `Blake3`, `Ethash`, `Equihash`, `ProgPow`
- CPU: `RandomX`, `Yescrypt`, `Argon2d`

WhatToMine mapping (profit router) aktuálně pokrývá:
- `Etchash` → `Ethash` (ETC)
- `Autolykos` → `Autolykos2` (ERG)
- `KawPow` → `KawPow` (RVN)
- `kHeavyHash` → `KHeavyHash` (KAS)
- `Blake3` → `Blake3` (ALPH)
- `Equihash` → `Equihash` (ZEC)

---

## 🧪 Testování
- Cílené `cargo test -p zion-cosmic-harmony-v3` (včetně E2E testu s mock pool serverem) ✅
- Cílené `cargo test -p zion-universal-miner` ✅

---

## ⚠️ Známé otevřené body / rizika
- Nonce placement / share layout:
  - E2E je zatím minimální a deterministické (append nonce na konec blobu).
  - Pro reálné pooly může být potřeba `nonce_offset`/layout per pool/algo.

---

## 📌 Doporučené next steps
- Přidat do pool/algo configu podporu `nonce_offset` (+ případně `nonce_size`) a upravit `build_job_input_bytes()`.
- Udělat krátký real-world smoke test na externím poole pro alespoň 1 GPU coin (ERG/RVN) a ověřit submit formát.

---

## 🧾 Reference (commity dne)
- `baeb88a` Fix CH3 init logging (stdlib)
- `ee83b38` feat(chv3): engine e2e mine+submit via PoolManager
- `42540ca` feat(chv3): wire PoolManager into engine + gate revenue by difficulty
- `607ff0c` feat(chv3): real pool manager + whattomine router
- `d7535fd` feat(universal-miner): wire NCL client to stratum
