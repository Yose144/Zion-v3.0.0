# V3 Revenue System - Kompletní dokumentace

Status: aktivni V3 implementace (pool-centric revenue control)

## 1) Cíl systemu

Revenue system ve V3 ma oddelit:

- uzivatelskou tezbu (ZION-first)
- backend revenue streamy pro projekt

Pri pripojeni mineru na pool rozhoduje pool, kam se share pripise. Miner nemusi znat interni revenue logiku.

Hlavni princip:

- user sessions jsou defaultne pinute do ZION skupiny
- backend sessions mohou jit do auto multistream scheduleru
- auto session je prirazena lane pri connectu (session pinning), ne per-share rotace

## 2) Kde je implementace

- Pool runtime a scheduler: V3/L1/pool/src/bin/server.rs
- Revenue source enum + accounting: V3/L1/core a V3/L1/pool crate API
- Profit routing fallback logika: V3/L1/cosmic-harmony/src/profit_router.rs
- DCR/Blake3 miner runtime: V3/L1/miner/src/dcr_worker.rs
- DCR GPU backend: V3/L1/miner/src/dcr_gpu.rs

## 3) Architektura

### 3.1 Session classification (pool)

Pri prijmu hello zpravy pool urci SessionGroup:

- zion
- revenue
- ncl
- auto

Rozhodovaci poradi:

1. explicitni hint v miner_id nebo worker_name:
   - g=zion, g=revenue, g=ncl, g=auto
   - group=zion, group=revenue, group=ncl, group=auto
2. backend allowlist podle miner_id
3. backend hint substring podle worker_name
4. fallback na ZION_USER_DEFAULT_GROUP (default zion)

### 3.2 Lane routing (pool)

Pool ma RevenueScheduler a lane plan.

- Single lane mode: vse jede jednim source/value
- Multistream mode: weighted round robin pres lane plan

Pinning podle SessionGroup:

- zion -> RevenueSource::Zion
- revenue -> RevenueSource::Blake3External
- ncl -> RevenueSource::NclAi
- auto -> lane assignment pri connectu (assign_auto_group), pak pinning

Poznamka:

- defaultne je backend auto assignment bez ZION lane (`ZION_BACKEND_AUTO_INCLUDE_ZION=false`), aby user sessions zustaly ZION-first a backend smeroval do revenue/ncl streamu.

Tohle drzi uzivatele v ZION streamu, zatimco backend muze bezet revenue lanes.

### 3.3 Submission flow

Pri submit:

1. pool vybere lane/source podle session group
2. share validuje pool + optional node submit_candidate (kdyz je ZION_NODE_RPC_ADDR)
3. vysledek jde zpatky mineru jako Result
4. revenue source se propise do accounting flow

## 4) Telemetrie routingu

Pool drzi in-memory routing stats:

- total submits/accepted/rejected
- per-group submits/accepted
- per-source submits/accepted

Log output:

- routing_snapshot ... (periodicky)
- routing_final ... (pri shutdown)

KPI, ktere z toho ihned vidis:

- kolik share jde od user sessions vs backend sessions
- kolik share je pripisano do zion/blake3/ncl source lanes
- acceptance ratio po skupinach a lane source

Volitelny endpoint:

- pokud nastavis ZION_ROUTING_METRICS_BIND (napr. 127.0.0.1:9550), pool vraci po TCP pripojeni jeden JSON snapshot s aktualnimi counters.

## 5) Env konfigurace

### 5.1 Pool routing a multistream

- ZION_REVENUE_MULTISTREAM
- ZION_STREAM_ZION_PCT
- ZION_STREAM_ZION_USD
- ZION_STREAM_BLAKE3_PCT
- ZION_STREAM_BLAKE3_USD
- ZION_STREAM_NCL_PCT
- ZION_STREAM_NCL_USD
- ZION_USER_DEFAULT_GROUP
- ZION_BACKEND_MINER_IDS
- ZION_BACKEND_WORKER_HINTS
- ZION_BACKEND_AUTO_INCLUDE_ZION
- ZION_ROUTING_LOG_EVERY
- ZION_ROUTING_METRICS_BIND

### 5.2 Pool network/runtime

- ZION_POOL_BIND
- ZION_NODE_RPC_ADDR
- ZION_ACCEPT_LIMIT
- ZION_POOL_LOOP_COUNT
- ZION_JOB_TTL_MS
- ZION_START_NONCE
- ZION_NONCE_COUNT
- ZION_NONCE_STRIDE
- ZION_TIMESTAMP
- ZION_TARGET
- ZION_REVENUE_SOURCE
- ZION_REVENUE_USD

### 5.3 Miner revenue-related knobs

- ZION_POOL_ADDR
- ZION_MINER_ID
- ZION_WORKER_NAME
- ZION_DCR_ENABLED
- ZION_DCR_POOL
- ZION_DCR_THREADS
- ZION_DCR_BACKEND (auto/cpu/gpu)
- ZION_DCR_ONLY
- ZION_DCR_RUN_SECS
- ZION_BTC_WALLET
- ZION_GPU_WORK_SIZE
- ZION_GPU_AUTOTUNE
- ZION_GPU_AUTOTUNE_SECS

### 5.4 Profit router preference knobs

- ZION_POOL_PREFERENCE (nicehash/herominers/zpool/default)
- ZION_POOL_REGION (eu/us/auto podle provideru)

Poznamka:

- NiceHash endpointy jsou vhodne pro cast alg, ale Blake3 (DCR/ALPH) neni garantovan v NH endpoint mapovani, proto fallbackuje hierarchy nicehash -> herominers -> zpool -> default.

## 6) Doporucena produkcni konfigurace

Pro model user ZION + backend revenue:

- ZION_REVENUE_MULTISTREAM=true
- ZION_STREAM_ZION_PCT=50
- ZION_STREAM_BLAKE3_PCT=25
- ZION_STREAM_NCL_PCT=25
- ZION_USER_DEFAULT_GROUP=zion
- ZION_BACKEND_WORKER_HINTS=backend,revenue,ncl
- ZION_BACKEND_AUTO_INCLUDE_ZION=false
- ZION_ROUTING_LOG_EVERY=25

Backend miner sessions znac worker_name napr.:

- backend-revenue-01
- backend-ncl-01

User miners nech bez group hintu, nebo explicitne g=zion.

## 7) E2E runbook (lokalni)

### Krok A - spust pool

Priklad:

1. nastav env pro multistream + session routing
2. spust server bin
3. over startup log: revenue_mode, plan, session_default_group, routing_log_every

### Krok B - pripoj user miner session

- worker bez backend hintu
- ocekavani: session_group=zion

### Krok C - pripoj backend miner session

- worker obsahuje backend nebo revenue
- ocekavani: session_group_requested=auto a session_group=revenue nebo ncl (podle lane assignu)

### Krok D - over logy

- routing_snapshot ukaze narust revenue/ncl skupin a blake3/ncl source podilu
- routing_final po ukonceni potvrdi totals

### Krok E - over acceptance

- sleduj share_status v pool logu
- acceptance ratio v routing snapshots

## 8) Test coverage (aktualni)

Pool server testy pokryvaji:

- stale/upstream rejection mapping
- weighted scheduler
- group pin override
- session group resolution
- routing stats counters

Aktualni stav (2026-03-16):

- `cargo test --manifest-path V3/Cargo.toml -p zion-pool --bin server --no-run` -> compile OK
- `cargo test --manifest-path V3/Cargo.toml -p zion-pool` -> lib tests 13/13 pass
- plne spusteni `--bin server` test executable je na tomto hostu blokovane lokalni AV politikou (Windows os error 225), proto je runtime potvrzeni provedeno E2E smoke scenarem niz

Runtime smoke (manual E2E):

- backend session (`miner_id=backend-smoke`, `worker=backend-revenue`) byla klasifikovana jako `session_group=revenue`
- `routing_snapshot` potvrdil `revenue={submits:1,accepted:1}` a `src_blake3={submits:1,accepted:1}`
- share byla accepted a session se ukoncila korektnim `bye`

## 9) Operacni poznamky

- Routing stats jsou in-memory. Pro dlouhodoby reporting je dalsi krok export do metrics endpointu nebo Prometheus.
- Session klasifikace je umyslne jednoducha, aby byla auditovatelna (hint -> allowlist -> default).
- Pokud je potreba striktni oddeleni user/backend, doporuceno drzet backend minery v explicitnim allowlistu + oddelenych worker naming pravidlech.

## 10) Troubleshooting

### Vse jde do zion lane

- zkontroluj ZION_REVENUE_MULTISTREAM=true
- zkontroluj backend hint/allowlist match
- zkontroluj ZION_BACKEND_AUTO_INCLUDE_ZION=false
- over session_group log pro dany worker

### Auto lane se toci, ale blake3 lane nema accepted

- over externi endpoint DNS/connectivity
- over fallback endpoint profile (profit_router)
- over share_status a upstream reject duvody

### Routing snapshot se nevypisuje

- ZION_ROUTING_LOG_EVERY muze byt 0
- nebo nebyl dosazen pocet submitu pro interval

## 11) Co je hotove vs co chybi

Hotove:

- pool-centric session routing
- zion-first default pro user sessions
- weighted multistream lane assignment + session pinning pro backend auto sessions
- basic routing telemetry a test coverage

Dalsi prirozene kroky:

- persistent metrics endpoint (Prometheus text / JSON)
- daily aggregation report na lane utilization + acceptance
- policy guardrails (napr. max revenue pct cap)

## 12) Paralelni nasazeni na DE server (canary)

Cil: spustit revenue konfiguraci paralelne bez dopadu na stavajici produkcni endpoint.

Canary postup:

1. Priprav DE host a spust samostatny pool bind na alternativnim portu (napr. 9444), neprepisuj stavajici 8444 endpoint.
2. Nastav revenue env stejne jako v produkcni doporucene konfiguraci, navic:
   - `ZION_ROUTING_LOG_EVERY=1` po dobu canary okna
   - `ZION_ROUTING_METRICS_BIND=127.0.0.1:9550` pro remote check snapshotu
3. Posli jen backend canary workery na DE endpoint (user workery nech na puvodnim endpointu).
4. Sleduj 30-60 min:
   - acceptance ratio
   - `routing_snapshot` group/source rozdeleni
   - reject reasons (stale/invalid/upstream)
5. Pokud je acceptance stabilni a source split odpovida planu, presmeruj zbytek backend workeru.
6. Teprve potom zvaž user traffic migration, pokud je to soucast planu.

Minimalni rollback:

- vrat backend minery na puvodni endpoint
- vypni DE canary pool instanci
- ponech logy/snapshoty pro postmortem
