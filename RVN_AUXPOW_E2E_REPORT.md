# ZION AuxPoW – RVN/KawPow E2E test: zpráva z provádění

> Stav: **částečně dokončeno** (2026-07-13)
> Kódové opravy byly provedeny, otestovány a nasazeny na produkční pool. Externí RVN joby jsou vydávány a počítány pod správným zdrojem (`src_kawpow`). Čeká se na opětovné připojení SMOS rigu a potvrzení prvního share na `rvn.2miners.com:6060`.

---

## 1. Co bylo cílem

Dokončit end-to-end test RVN (KawPow) AuxPoW na 2miners poolu tak, aby:
- pool stahoval RVN joby z `rvn.2miners.com:6060`,
- rozesílal tyto joby minerům,
- miner řešil skutečný KawPow hashe (s DAGem a mix_hash),
- a pool odesílal nalezené shary zpět do 2miners.

Předchozí sezení skončilo s tím, že SMOS rig sice hlásil accepted shary, ale ty byly **ZION shary**, nikoliv RVN shary z externího poolu.

---

## 2. Nalezené kořenové příčiny

### 2.1 Pool nikdy neposílal externí joby

- `ZION_POOL_AUXPOW_SPLIT_ZION` a `ZION_POOL_AUXPOW_SPLIT_EXTERNAL` nebyly nastaveny.
- Funkce `should_issue_external_job()` proto vracela vždy `false` (`SplitConfig::None`).
- Pool posílal pouze ZION joby.

### 2.2 Minery byly ve skupině `Zion`

- Výchozí `ZION_USER_DEFAULT_GROUP=zion` znamená, že každý nový session automaticky dostával jen ZION práci.
- Externí mince se zvolí pouze pro skupiny `Revenue` / `Auto`.

### 2.3 Chybná výška bloku pro externí joby

- `JobPackage.timestamp` obsahuje UNIX timestamp z notify (pro KAS).
- Pro Ethash/KawPow miner potřebuje **číslo bloku** (`block_number`) pro výpočet epochy: `epoch = height / 7500`.
- Pool posílal místo výšky bloku timestamp → miner počítal epochu z ~1 700 000 000 / 7500 = ~230 000 místo správné epochy 593.
- To způsobilo chybnou/neplatnou DAG generaci.

### 2.4 Pool na produkčním VPS nebyl nakonfigurován pro RVN

- Produkční pool na `62.171.141.136:8444` běžel s nastavením pro DCR (`ZION_POOL_AUXPOW_COIN=DCR`).
- Wallet pro payout byl BTC adresa, ale testovací RVN wallet (`RXe23wF9o9DYqodxG3V2qmRau92gd4o7oP`) nebyl validní pro 2miners (`Invalid address`).
- Revenue stream konfigurace obsahovala `ZION_STREAM_BLAKE3_PCT=25`, nikoliv KawPow lane.

### 2.5 Routing statistiky ukazovaly externí shary pod špatným zdrojem

- Revenue scheduler vybíral lane (`Blake3External`) a `routed_source` zůstávalo na tomto lane bez ohledu na skutečnou těženou minci.
- RVN shary se proto počítaly pod `src_blake3` místo `src_kawpow`.

### 2.6 Welcome message uváděl nativní algoritmus

- Pro revenue session s `force_coin=RVN` welcome vracel `algorithm=deeksha_lite_fire` (z minera), i když následně přišel job s `algorithm=kawpow`.
- To mohlo zmást miner, který se připravoval na špatný algoritmus.

---

## 3. Provedené opravy v kódu

### 3.1 Předchozí opravy (z minulého sezení)

- `AuXpow/src/types.rs` — přidáno pole `block_number` do `JobPackage`.
- `AuXpow/src/multiplexer.rs` — `pack_job()` předává `block_number`.
- `V3/L1/pool/src/bin/server.rs` — `assignment_height()` používá `block_number` před `timestamp`.
- Aktualizovány všechny testovací konstruktory `JobPackage`.

### 3.2 Nové opravy v tomto sezení (`V3/L1/pool/src/bin/server.rs`)

- Přidána funkce `external_coin_to_revenue_source()` a opraveno `routed_source` pro externí joby, aby se shary počítaly pod skutečnou mincí (`src_kawpow` pro RVN).
- Welcome message pro revenue session nyní uvádí algoritmus nastavené externí mince (`kawpow` místo `deeksha_lite_fire`).
- Pro externí AuxPoW joby se neprovádí lokální vardiff retarget — target řídí upstream pool.

### 3.3 Produkční konfigurace na VPS `62.171.141.136`

- Aktualizován `/etc/zion/edge-environment.sh`:
  - `ZION_POOL_AUXPOW_COIN=RVN`
  - `ZION_POOL_AUXPOW_WALLET=bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh` (BTC payout wallet, validní pro 2miners)
  - `ZION_POOL_AUXPOW_WORKER_NAME=zion-pool`
  - `ZION_POOL_AUXPOW_SPLIT_ZION=4`
  - `ZION_POOL_AUXPOW_SPLIT_EXTERNAL=1`
  - `ZION_USER_DEFAULT_GROUP=revenue`
  - `ZION_STREAM_BLAKE3_PCT=0`
  - `ZION_STREAM_KAWPOW_PCT=25`
- Nahrazen binární soubor `/usr/local/bin/zion-pool-server` novým buildem.
- Restartována služba `zion-pool.service`.

---

## 4. Konfigurace poolu (produkční VPS)

Pool nyní startuje s:

```bash
export ZION_POOL_BIND='0.0.0.0:8444'
export ZION_POOL_NODE_RPC='http://127.0.0.1:9443'
export ZION_POOL_AUXPOW_ENABLED='1'
export ZION_POOL_AUXPOW_COIN='RVN'
export ZION_POOL_AUXPOW_WALLET='bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh'
export ZION_POOL_AUXPOW_WORKER_NAME='zion-pool'
export ZION_POOL_AUXPOW_SPLIT_ZION='4'
export ZION_POOL_AUXPOW_SPLIT_EXTERNAL='1'
export ZION_USER_DEFAULT_GROUP='revenue'
export ZION_STREAM_ZION_PCT='50'
export ZION_STREAM_NCL_PCT='25'
export ZION_STREAM_KAWPOW_PCT='25'
```

To znamená 20 % revenue jobů bude externích (RVN/KawPow) a zbytek ZION/NCL.

---

## 5. Výsledky testů

### 5.1 Unit testy

- `cargo test -p zion-auxpow`: **82/82 passed**
- `cargo test -p zion-pool --lib`: **73/73 passed**
- `cargo test -p zion-pool --bin server`: **38/38 passed**
- `cargo build --release -p zion-pool`: úspěšně

### 5.2 Pool běží a přijímá RVN notify

Logy ukazují:

```
auxpow_bridge: enabled coin=Some(RVN) wallet=bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh worker=zion-pool
auxpow: subscribed to RVN
auxpow: authorized as bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh.zion-pool on RVN
auxpow: RVN set_target=00000000ffff0000 difficulty=4295032833.00
auxpow: RVN notify — job=5537f seed=... header=... epoch=Some(593) height=Some(4452033)
auxpow_bridge: queued job_id=5537f coin=RVN algo=kawpow
```

### 5.3 Externí RVN joby se vydávají

```
wire_welcome={"type":"welcome","protocol_version":"zion-v3-stratum/0.2","algorithm":"kawpow","job_ttl_ms":15000}
issued_external_job miner=workrr job_id=5215098765743511546 coin=RVN algorithm=kawpow height=4452033
```

### 5.4 Routing statistiky nyní správně zobrazují `src_kawpow`

```
routing_snapshot submits=175 accepted=175 rejected=0 stale=0 accept_rate=100.00%
  revenue={submits:175,accepted:175,pct:100.0%}
  src_kawpow={submits:175,accepted:175,pct:100.0%}
```

### 5.5 SMOS rig – zatím se nepřipojil po posledním restartu

- `vega-smos` dostal první externí RVN job v 17:37:24, ale poté se odpojil a od posledního restartu poolu (17:44:26) se nepřipojil.
- Externí IP `109.81.21.108` není v aktivních spojeních na portu 8444.
- Pravděpodobně je potřeba provést reload / restart mineru na SMOS rigu, aby se znovu připojil k `62.171.141.136:8444`.

---

## 6. Zbývající kroky k plnému E2E

1. **Reload/restart SMOS rigu**
   - Ujistit se, že miner v SMOS ukazuje `Pool: 62.171.141.136:8444` a že se zobrazí spojení z `109.81.21.108` v logu poolu.

2. **Ověřit, že SMOS miner dostává externí RVN joby**
   - Pool log by měl obsahovat `issued_external_job miner=vega-smos ... coin=RVN algorithm=kawpow`.
   - Welcome message by měl obsahovat `algorithm=kawpow`.

3. **Sledovat odeslání share do 2miners**
   - Pool log by měl obsahovat `auxpow_share_accepted` nebo `auxpow_bridge: share_forwarded ... result=Accepted`.
   - Ve 2miners dashboardu by se měl objevit accepted share pro wallet `bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh`.

---

## 7. Soubory změněné v tomto sezení

- `V3/L1/pool/src/bin/server.rs`
  - `external_coin_to_revenue_source()`
  - oprava `routed_source` pro externí joby
  - oprava welcome algoritmu pro revenue session
  - zakázání vardiff retargetu pro externí joby
- `/etc/zion/edge-environment.sh` na VPS `62.171.141.136` — přepnutí na RVN + KawPow lane
- `/usr/local/bin/zion-pool-server` na VPS — nasazen nový build

---

## 8. Závěr

Kódová část RVN/KawPow E2E je opravená a připravená:
- pool rozděluje externí joby správným poměrem,
- externí joby nesou správné číslo bloku pro DAG epochu,
- revenue statistiky reflektují skutečnou těženou minci,
- welcome message správně indikuje algoritmus,
- produkční pool běží s RVN konfigurací a úspěšně se připojuje k `rvn.2miners.com:6060`.

Zbývá pouze **reload SMOS rigu** a potvrdit první accepted RVN share na 2miners.
