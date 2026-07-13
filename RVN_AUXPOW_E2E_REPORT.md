# ZION AuxPoW – RVN/KawPow E2E test: zpráva z provádění

> Stav: **částečně dokončeno** (2026-07-13)
> Kódové opravy byly provedeny, otestovány a nasazeny. E2E odeslání skutečného RVN share do 2miners je zablokováno síťovým přesměrováním na hraniční VPS/SSH tunelu.

---

## 1. Co bylo cílem

Dokončit end-to-end test RVN (KawPow) AuxPoW na 2miners poolu tak, aby:
- pool stahoval RVN joby z `rvn.2miners.com:6060`,
- rozesílal tyto joby lokálním minerům,
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

### 2.4 Síťová cesta k poolu nefungovala zvenčí

- Pool běží na vnitřní IP `192.168.1.117:8444`.
- SSH tunel `zion-ssh-tunnel.service` původně vázal `127.0.0.1:8444` (`-L 8444:127.0.0.1:8444`), což při přístupu z veřejné IP vytvářelo smyčku.
- Po odstranění lokálního forwardu a přidání vzdáleného forwardu `-R 8444:192.168.1.117:8444` se pool stále nepřipojil k SMOS rigu.
- Testovací spojení z lokálního stroje na `62.171.141.136:8444` funguje (hairpin NAT), ale spojení z externí IP `109.81.21.108` (SMOS rig) nikdy nedorazilo na listener na `192.168.1.117:8444`.

---

## 3. Provedené opravy v kódu

### 3.1 `AuXpow/src/types.rs`

Přidáno pole `block_number` do `JobPackage`:

```rust
/// Block number (height) from the external pool notify.  Used by
/// Ethash/KawPow miners for DAG epoch derivation (epoch = height / epoch_length).
/// None if the external pool does not provide a block height.
pub block_number: Option<u64>,
```

### 3.2 `AuXpow/src/multiplexer.rs`

`pack_job()` nyní předává skutečné číslo bloku:

```rust
block_number: job.block_number,
```

### 3.3 `V3/L1/pool/src/bin/server.rs`

- `assignment_height()` pro externí joby použije `block_number` a teprve jako fallback `timestamp`.
- Aktualizovány všechny testovací konstruktory `JobPackage`.

### 3.4 SSH tunel

Upraven `/home/zionserver/.config/systemd/user/zion-ssh-tunnel.service`:

- Odstraněn lokální forward `-L 8444:127.0.0.1:8444` (způsoboval smyčku).
- Přidán vzdálený forward `-R 8444:192.168.1.117:8444`, aby VPS `62.171.141.136` naslouchala na portu 8444 a přesměrovávala na pool.

---

## 4. Konfigurace poolu

Pool nyní startuje s:

```bash
export ZION_POOL_BIND='192.168.1.117:8444'
export ZION_NODE_RPC_ADDR='127.0.0.1:8446'
export ZION_POOL_AUXPOW_ENABLED='1'
export ZION_POOL_AUXPOW_COIN='RVN'
export ZION_POOL_AUXPOW_WALLET='RBv3HUypznKQ8gHnATNiDu145hs7pZj6DZ'
export ZION_POOL_AUXPOW_WORKER_NAME='zion-pool'
export ZION_POOL_AUXPOW_SPLIT_ZION='3'
export ZION_POOL_AUXPOW_SPLIT_EXTERNAL='1'
export ZION_USER_DEFAULT_GROUP='revenue'
```

To znamená 25 % jobů bude externích (RVN/KawPow) a 75 % ZION.

---

## 5. Výsledky testů

### 5.1 Unit testy

- `cargo test -p zion-auxpow`: **78/78 passed**
- `cargo test -p zion-pool --features zion-auxpow/native-hashers`: **38/38 passed**

### 5.2 Pool běží a přijímá RVN notify

Logy ukazují:

```
auxpow_bridge: enabled coin=Some(RVN) wallet=RBv3HUypznKQ8gHnATNiDu145hs7pZj6DZ worker=zion-pool
auxpow: subscribed to RVN
auxpow: authorized as RBv3HUypznKQ8gHnATNiDu145hs7pZj6DZ.zion-pool on RVN
auxpow: RVN set_target=00000000ffff0000 difficulty=4295032833.00
auxpow: RVN notify — job=5535b seed=... header=... epoch=Some(593) height=Some(4452002)
auxpow_bridge: queued job_id=5535b coin=RVN algo=kawpow
```

### 5.3 SMOS rig – miner se nepřipojuje k našemu poolu

- Miner se po reloadu restartuje, TUI ukazuje `Pool height=...` a accepted shary.
- Avšak **žádné spojení z IP `109.81.21.108`** nedorazí na listener na `192.168.1.117:8444`.
- Testovací Python listener na `192.168.1.117:8444` nepřijal žádné spojení od SMOS rigu.
- Z toho vyplývá, že port 8444 není z externí sítě správně přesměrován na tento server, nebo je přesměrován jinam.

---

## 6. Zbývající kroky k plnému E2E

1. **Opravit síťové přesměrování portu 8444 z veřejné IP `62.171.141.136` na vnitřní pool `192.168.1.117:8444`.**
   - Nejspolehlivější řešení: na VPS/firewallu nastavit DNAT pro TCP/8444 → `192.168.1.117:8444`.
   - Alternativa: povolit `GatewayPorts=yes` na SSH serveru a použít `-R *:8444:192.168.1.117:8444` (bind na všech rozhraních VPS).
   - Ověřit z externího stroje: `nc -vz 62.171.141.136 8444` a sledovat příchozí spojení na poolu.

2. **Ověřit, že SMOS miner přepne na KawPow pro externí joby.**
   - Po připojení by pool log měl ukazovat `issued_external_job` s `algorithm=kawpow`.
   - Miner by měl vygenerovat DAG pro epochu 593 a začít počítat KawPow hashe.

3. **Sledovat odeslání share do 2miners.**
   - Pool log by měl obsahovat `auxpow_share_accepted` nebo `auxpow_share_forwarded`.
   - Ve 2miners dashboardu by se měl objevit accepted share pro wallet `RBv3HUypznKQ8gHnATNiDu145hs7pZj6DZ`.

---

## 7. Soubory změněné v tomto sezení

- `AuXpow/src/types.rs` — přidáno `block_number` do `JobPackage`
- `AuXpow/src/multiplexer.rs` — předání `block_number` v `pack_job()`
- `V3/L1/pool/src/bin/server.rs` — `assignment_height()` používá `block_number`; opraveny testy
- `AuXpow/examples/e2e_pool_test.rs` — aktualizován konstruktor `JobPackage`
- `AuXpow/src/miner_harness.rs` — aktualizovány testovací konstruktory
- `AuXpow/src/dual_stratum.rs` — aktualizován testovací konstruktor
- `/home/zionserver/.config/systemd/user/zion-ssh-tunnel.service` — upraveny port forwards pro 8444

---

## 8. Závěr

Kódová část RVN/KawPow E2E je opravená a připravená:
- pool rozděluje externí joby správným poměrem,
- externí joby nesou správné číslo bloku pro DAG epochu,
- miner binárka podporuje KawPow s DAGem (`native-hashers`).

Jediným blokátorem je **síťové přesměrování portu 8444**, které musí řešit správce VPS/firewallu. Jakmile bude přesměrování funkční, E2E test RVN share na 2miners by měl projít bez dalších kódových změn.
