# ZION Pool v2.9 – Výplatní systém (Payouts) – CZ dokumentace

Tento dokument shrnuje implementovanou logiku výplat z poolu na externí peněženky ("jako jiné mining pooly") a dává praktický návod, jak to lokálně/provozně ověřit.

## 1) Cíl a princip

Cíl: aby pool po nalezení bloku spravedlivě připsal odměny minerům (podle sdílené práce v okně PPLNS) a následně automaticky posílal on-chain výplaty z pool peněženky na peněženky minerů.

Základní tok:
1. Miner posílá shares do Stratum poolu.
2. Pool ukládá shares do DB.
3. Pool při přijetí (accepted) bloku spustí rozdělení odměny (PPLNS okno) → připíše minerům `pending`.
4. Payout worker periodicky:
   - vybere kandidáty (splňující threshold)
   - uzamkne částku (`pending → locked`)
   - odešle transakci přes chain RPC
   - sleduje stav transakce (`sent → confirmed`)
   - po potvrzení přesune `locked → paid`

## 2) Stav implementace (co je hotové)

### ✅ Pool-side účetnictví
- Per-miner stav balancí: `pending / locked / paid`
- Záznamy o blocích, kde už došlo k rozdělení (ochrana proti dvojímu creditu)
- Tabulka odchozích výplat s lifecycle stavem

### ✅ Payout worker
- Automatické odesílání výplat přes RPC
- Automatické potvrzování (na základě `gettransaction` → `block_height`)
- Ochrana proti „zaseklým locked“ (timeout unlock), pokud transakce není dohledatelná

### ✅ RPC kompatibilita a potvrzování
- RPC klient umí posílat `params` jako dict i list (kompatibilita)
- RPC server `gettransaction` umí vracet:
  - `status=pending, block_height=None` pro tx v mempoolu
  - `status=confirmed, block_height=<výška>` pro potvrzenou tx

### ✅ Lokální E2E demo potvrzené
- Ověřeno v izolované lokální chain instanci na portu `18082` (kvůli kolizím `18081` s Docker/WSL)
- Proveden kompletní cyklus `sendtransaction → pending → mine block → confirmed → DB přepočet balances`

## 3) Klíčové soubory

### Pool
- `src/pool/zion_pool_v2_9.py`
  - inicializace poolu
  - wiring: `protocol_handler.database`, `protocol_handler.payout_manager`
  - start payout manageru
  - Windows-safe signal handling

- `src/pool/network/protocol_handler.py`
  - ukládání shares do DB
  - trigger rozdělení odměny při accepted bloku

- `src/pool/payout/payout_manager.py`
  - PPLNS rozdělení a payout worker loop
  - timeout unlock pro missing tx

- `src/pool/database/models.py`
  - schéma a helper metody pro balances/events/payouts

### Chain RPC
- `src/core/zion_rpc_server.py`
  - `sendtransaction`, `gettransaction` (pending+confirmed)
  - ochrana proti nechtěnému dual-port bindení při custom portu (např. 18082)

### Konfigurace a nástroje
- `config/pool_local_payout_test_win.json`
  - doporučený Windows test config (chain port 18082 + separátní DB)

- `tools/payout_sanity_check.py`
  - rychlý přehled DB: counts + top balances + poslední payouts

- `tools/payout_reconcile_once.py`
  - jednorázové odblokování payoutů, které jsou `sent`, ale tx není dohledatelná po timeoutu

- `tools/payout_e2e_demo.py`
  - deterministická demo sekvence (používá DB + RPC) pro ověření stavových přechodů

- `tools/run_local_chain_rpc.py`
  - spustí lokální chain RPC z workspace kódu na zvoleném portu

## 4) Datový model (DB – zjednodušeně)

### `miner_balances`
- `wallet_address` (PK)
- `pending` – připraveno k výplatě
- `locked` – uzamčeno pro právě odesílanou výplatu
- `paid` – potvrzeně vyplaceno on-chain
- `last_updated`

### `reward_events`
- `block_height` (PK)
- `block_hash`
- `total_reward`, `miner_reward`, `pool_fee`, `tithe`
- `timestamp`

Smysl: blok se nesmí rozdělit 2×.

### `payouts_v2`
- `id` (PK)
- `wallet_address`
- `amount`
- `tx_id`
- `status` (např. `created/sent/confirmed/failed`)
- `error`
- `created_ts`, `updated_ts`

## 5) Konfigurační klíče (doporučené)

V `config/pool_local_payout_test_win.json` (a obdobně v produkci) jsou relevantní tyto parametry:

- `payout.enabled`: zap/vyp payout worker
- `payout.min_payout_amount`: minimální částka pro payout
- `payout.payout_interval_seconds`: perioda odesílání
- `payout.confirm_interval_seconds`: perioda potvrzování
- `payout.payout_confirm_timeout_seconds`: po jaké době od `sent` uvolnit `locked → pending` pokud tx není dohledatelná
- `payout.pplns_window_size` (nebo ekvivalent): velikost okna pro PPLNS výpočet

Poznámka: názvy klíčů se mohou lišit dle finálního JSON; pro test používej win test config v repu.

## 6) Jak to spustit a ověřit (Windows – doporučený postup)

### A) Spusť izolovanou chain RPC na 18082

```powershell
& .\.venv\Scripts\python.exe tools\run_local_chain_rpc.py --port 18082 --db data\zion_local_chain_18082.db
```

Ověření:
```powershell
Test-NetConnection 127.0.0.1 -Port 18082
& .\.venv\Scripts\python.exe tools\rpc_ping.py --rpc http://127.0.0.1:18082
```

### B) Spusť pool proti 18082 configu

```powershell
$env:POOL_CONFIG = "config/pool_local_payout_test_win.json"
& .\.venv\Scripts\python.exe start_native_pool.py
```

### C) Ověř DB stav

```powershell
& .\.venv\Scripts\python.exe tools\payout_sanity_check.py --config config\pool_local_payout_test_win.json
```

### D) Připoj minera

Připoj externí miner na `stratum+tcp://127.0.0.1:3333`.

Očekávané:
- roste počet `shares`
- po accepted bloku přibyde `reward_events`
- minerům poroste `pending`
- po dosažení thresholdu vznikne řádek v `payouts_v2` a dojde k `pending→locked→paid`

## 7) Troubleshooting (nejčastější problémy)

### 7.1 Port 18081 je „cizí“ (Docker/WSL)
- Symptom: `localhost:18081` vrací jinou verzi RPC (např. HTML „ZION 2.8.5 RPC Interface“), tx se „nenajde“ apod.
- Řešení: testuj přes `18082` + explicitní config, nebo uvolni 18081 a spouštěj jen jeden RPC server.

### 7.2 „Zaseklé locked“ balíky
- Symptom: v DB `locked > 0`, payout `sent`, ale chain `gettransaction` hlásí „not found“.
- Řešení: timeout unlock + reconcile:

```powershell
& .\.venv\Scripts\python.exe tools\payout_reconcile_once.py --config config\pool_local_payout_test_win.json
```

### 7.3 Windows asyncio signal handlers
- Symptom: crash při startu se signály
- Stav: ošetřeno fallbackem (na Windows se signály ignorují).

## 8) Doporučení a další návrhy (roadmap pro payouty)

### P0 – aby to bylo „produkčně použitelné“
1. **Převést částky z `float` na integer atomické jednotky** (např. `amount_atomic: int`) – zabrání rounding chybám.
2. **Idempotence výplat**: zabránit tomu, aby stejný miner dostal 2× payout při restartu v nevhodný čas.
3. **Silnější „payout state machine“**: jasně definované stavy a přechody (created→sent→confirmed / failed).
4. **Hardening RPC**: timeouts, retries, jasný handling „mempool vs confirmed“.

### P1 – monitoring a provoz
1. **Prometheus metriky pro payouty**: počty payoutů, pending/locked sumy, průměrný čas potvrzení.
2. **Admin endpointy** (read-only): payout queue, balances, poslední chyby.
3. **Log korelace**: `payout_id`, `tx_id`, `miner_address` ve všech logách.

### P2 – spravedlnost a ekonomika
1. **PPLNS parametrizace**: okno podle času/počtu shares, ne jen „N posledních“.
2. **Zohlednění difficulty/varDiff**: vážení shares podle skutečné difficulty (pokud ještě není plně konzistentní).
3. **Odložené výplaty**: batchování tx (více minerů v jedné tx) – pokud chain podporuje.

## 9) Co je ještě potřeba ověřit (integračně)

- Miner-driven E2E: reálný miner → shares → pool najde blok → reward_events → pending credit → payout tx → confirmed
- Produkční instance: zajistit, že pool míří na správnou RPC instanci (a ne na Docker/WSL forward)

## 10) Budoucí plán (prakticky, krok za krokem)

Tady je doporučený plán tak, aby se payouty daly bezpečně provozovat na produkci a zároveň se daly jednoduše ověřit.

### Milník A (dnes/zítra): Stabilní integrační E2E s reálným minerem

- Cíl: bez ručního seedování DB prokázat tok „miner → shares → pool found block → credit → payout → confirmed“.
- Kroky:
  - Spustit pool proti izolované chain RPC (`18082`) a připojit reálného minera.
  - Nechat proběhnout alespoň 1 accepted blok a ověřit:
    - `reward_events` přibyde přesně 1× na výšku (žádné dvojité creditování)
    - miner dostane `pending` (PPLNS okno)
    - po dosažení thresholdu vznikne payout a dojde k `confirmed`
- Výstup: krátký log/report (timestamp, výška bloku, počet shares, payout tx_id, stav confirmed).

### Milník B (1–2 dny): Produkční hardening minimem změn

- Cíl: minimalizovat riziko zaseknutých stavů a nejednoznačných přechodů.
- Doporučené změny:
  - Přidat/zkontrolovat idempotenci pro payout send (stejný payout_id nesmí poslat 2×).
  - Zpřesnit „state machine“ payoutů (jasná pravidla přechodů a kdy se unlockuje).
  - Nastavit rozumné RPC timeout/retry (a logovat `tx_id` + `payout_id` konzistentně).
- Akceptační kritéria:
  - po restartu poolu se nerozjedou duplicity payoutů
  - „stuck locked“ se automaticky uvolní po timeoutu + je k dispozici reconcile

### Milník C (3–7 dní): Správné částky a numerika

- Cíl: odstranit riziko rounding/float chyb.
- Doporučení:
  - Migrace částek v DB a výpočtech na atomické jednotky (integer), např. `amount_atomic`.
  - Doplnit migrační skript pro existující DB (pokud se má převádět produkční DB).
- Akceptační kritéria:
  - součet vyplacených částek sedí s očekáváním (žádné „-0.00000001“)
  - konzistentní zaokrouhlení na všech místech (reward calc, payout calc, reporting)

### Milník D (1–2 týdny): Observabilita a provoz

- Cíl: aby šlo rychle poznat, co se děje a proč.
- Doporučení:
  - Prometheus metriky: počet payoutů dle stavu, suma `pending/locked`, průměrný čas potvrzení.
  - Read-only admin přehled (minimálně CLI skripty): top balances, poslední chyby, poslední payouts.
  - Runbook pro incidenty: „tx not found“, „RPC down“, „DB locked“, „reorg“.

### Milník E (později): Efektivita a ekonomika

- Batchování payoutů (pokud chain podporuje), aby se snížil počet tx.
- Vylepšené PPLNS: okno podle času nebo work, ne pouze „N posledních“.
- Přesné vážení VarDiff shares a kontrola zneužití (abuse/whitelist/rate limit).

## 11) Produkční runbook (server 91.98.122.165)

Tato část je praktická provozní příručka: co zkontrolovat, jak bezpečně restartovat pool, a co dělat při problémech s výplatami.

### 11.1 Rychlá kontrola stavu stacku

Na serveru:

```bash
cd /root/zion-v2.9

# Stav služeb
docker compose ps

# Rychlé logy (nahraď názvy služeb dle compose)
docker logs --tail 200 zion-pool-v2.9
docker logs --tail 200 zion-blockchain-v2.9
```

Checklist „vypadá to zdravě“:
- Pool běží a poslouchá na 3333 (Stratum)
- RPC chain běží a odpovídá (pool se k němu připojuje)
- DB poolu je přístupná (žádné chyby typu „database is locked“)

### 11.2 Ověření, že pool míří na správnou RPC instanci

Problém, který už se objevil na Windows, existuje i na serveru: pool může mluvit na jinou RPC, než čekáš (proxy/port/konflikt).

Na serveru (uvnitř hosta):

```bash
# Zkus ping RPC (pokud je dostupný curl)
curl -s http://127.0.0.1:18081/ | head
```

Pokud RPC vrací HTML stránku s jinou verzí, nebo se metody chovají jinak, je potřeba zkontrolovat:
- port mapping v docker-compose
- zda na portu neběží jiná služba
- jaký endpoint používá pool (host/port v configu a env)

### 11.3 Kontrola výplat (DB a stavové přechody)

Z lokálního vývojového stroje (nebo přímo na serveru, pokud je tam venv/kód):

```bash
python tools/payout_sanity_check.py --config config/pool_production.json
```

Co sledovat:
- `locked` dlouhodobě > 0 bez potvrzení → typicky problém v RPC / tx dohledání
- `payouts_v2` roste, ale statusy zůstávají `sent` → potvrzování nefunguje

Pokud existují payouty `sent`, ale tx se po čase nedá dohledat:

```bash
python tools/payout_reconcile_once.py --config config/pool_production.json
```

### 11.4 Bezpečný restart poolu (bez double-creditu a bez duplicitních payoutů)

Cíl: restartovat pool tak, aby se:
- znovu nerozdělila stejná bloková odměna
- neposlaly duplicitní payouty

Doporučený postup:

```bash
cd /root/zion-v2.9

# 1) Ulož si poslední logy (volitelné)
docker logs --tail 300 zion-pool-v2.9 > /root/zion-v2.9/logs/pool_tail_$(date +%F_%H%M).log

# 2) Restart pouze poolu
docker compose restart pool

# 3) Sleduj start
docker logs -f --tail 200 zion-pool-v2.9
```

Po restartu ověř:
- pool se připojil k RPC
- payout worker běží (v logu jsou periodické tick/info)
- nevznikají nové `reward_events` pro staré výšky (ochrana proti double-creditu musí držet)

### 11.5 Incident playbooky (rychlé řešení)

#### A) „Transaction not found“ / payout `sent` ale tx neexistuje

Možné příčiny:
- pool míří na jinou RPC instanci (tx se poslala jinam)
- RPC ztratila mempool / restart bez persistence
- chyba v odeslání tx (RPC vrátila tx_id, ale reálně neacceptla)

Postup:
1) Ověř správnou RPC (11.2)
2) Zkontroluj chain logy při odesílání
3) Po timeoutu spusť reconcile (11.3)

#### B) `locked` roste a nesnižuje se

Postup:
1) Zkontroluj, zda běží potvrzovací smyčka (confirm loop)
2) Ověř `gettransaction` na RPC vrací `block_height` po potvrzení
3) Pokud RPC neukazuje pending tx, zkontroluj verzi a implementaci `gettransaction`

#### C) RPC down / timeouts

Postup:
1) `docker compose ps` + `docker logs` chain služby
2) restart chain služby (opatrně) a ověř, že pool se znovu připojí
3) po návratu RPC zkontroluj payout queue a případně reconcile

#### D) SQLite „database is locked“

Postup:
1) ověř, že DB soubor nepoužívá více procesů mimo pool
2) zkontroluj WAL režim a přístupová práva
3) jako krátkodobý workaround restart poolu; jako fix prověřit write patterns a busy_timeout

---

Poznámka: pokud chceš, můžu udělat i samostatný „PROD_CHECKLIST.md“ (kratší než tento runbook) a přidat do něj konkrétní názvy kontejnerů ze serverového compose (aby příkazy seděly 1:1).

---

