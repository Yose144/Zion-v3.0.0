# Pool + pool.zionterranova.com — audit report

> **Datum:** 2026-10-26 · **Stav:** všechny nálezy P-01…P-06 **opraveny a nasazeny do produkce** (§4, §5)
> **Pin:** `b1d4caeb0` (audit) → remediace `103be4e6a` · produkce: pool @ `103be4e6a` (Edge), web @ EDGE2 `/var/www/pool`
> **Metoda:** manuální code review money/credit-paths + live probe veřejného povrchu.
> Navazuje na `AUDIT-REPORT.md` (2026-10-25) — payout/deferred atomika už opravena;
> tento audit cílil na **stratum, share accounting, auxpow, API povrch a statickou appku**.

## 0. Topologie ověřená live

- `pool.zionterranova.com` (EDGE2 nginx) = statický export `apps/pool-ui` z `/var/www/pool`.
- Jediný proxied prefix: `/public/v1/` → `127.0.0.1:8080` (edge2→edge SSH tunel → pool API na Edgi).
  `/api/*` a `/admin` = hard 404 na nginx — ověřeno live (`/api/v1/stats`, `/admin` → 404).
- Pool API `:8080` na Edgi bind **127.0.0.1** — není veřejně dosažitelné (ověřeno zvenčí).
- Stratum `:8444` (plain) / `:8445` (TLS) bind `0.0.0.0` — veřejný povrch, to je správně.
- `/health`+`/metrics` na :8080 bez auth — interní telemetry, OK v rámci loopback/tunel scope.

## 1. Nálezy

### P-01 · CRITICAL — Share replay: chybí (job_id, nonce) dedup → PPLNS inflace

`handle_submit` (v1) i `PoolMessage::Submit` (v3-plain, v3-TLS) validují hash proti
targetu a pak **bezpodmínečně** kreditují `record_share_with_diff_for_coin` —
žádný seen-set na `(job_id, nonce)`/`(job_id, nonce, worker)` nikde v cestě
(`stratum.rs:649-805`, `2556-2568`, `2989-3032`; `pool.rs:397-443` → `v3_pplns.rs:970-999`).
PPLNS okno je vážené na difficulty — opakovaný submit stejné platné share
= opakovaný kredit bez práce. Pearl gateway má `SeenJackpots` dedup
(`pearl_gateway.rs:47`), ale jen pro jackpot/block cestu — běžné accepted
shary dedup nemají ani tam, ani v QTU forward cestě.

**Dopad per cesta:**
- **v3-plain (`handle_v3_client`)**: *nejvážnější* — validace proti **statickému**
  `share_target` z jobs tabulky, ale kredit = `vardiff.current()`, který roste 4×
  každých 8 acceptů (`retarget_shares=8`, clamp ±4×, max 100 000). Replay drží
  validitu i když difficulty letí nahoru → po ~32 acceptech každý další submit
  kredituje 100 000 weight — **line-rate, ~tj. stovky submits/s × 60 s job TTL
  ⇒ kredit o řády nad všemi poctivými minery dohromady**. Útočník vyžere
  prakticky celé PPLNS okno. Žádný share-rate limiter v v3 cestě.
- **v3-TLS**: stejná chybějící dedup; kredit flat `start_difficulty` (1000),
  validace statická — line-rate replay, bez rate limiteru.
- **v1**: `ShareRateLimiter` 10/s + validace proti rostoucímu session targetu
  → self-limiting (~několik desítek extra acceptů na share, dokud nonce
  nepřestane stačit rostoucímu diff). Stále nenulový zisk.
- **Externí legs** (`qtu_handle_submit`, `process_pearl_submission`): kredit
  `auxpow_share_weight` (default 500) na `Accepted` **i `Unknown`/`StaleForward`**
  stavy; bez lokální dedup mapy — opakované odeslání téže proof = opakovaný kredit.

**Fix:** globální bounded seen-set `{(job_id, nonce)}` (např. ring 65k/hash-when-full),
odmítnout dřív než se volá validator; bonus: v3 cesty přidat share-rate limiter
a validovat proti **session** targetu jako v1.

### P-02 · HIGH — Submit není vázaný na autorizovanou identitu

- v1 `mining.submit` **nikdy nekontroluje `ctx.authorized`** — session může
  submitnout bez `mining.authorize`.
- Worker/miner id se bere z **params submitu**, ne ze session: v1 `arr[0]`
  (`stratum.rs:846`), v3-plain `submit_miner`/`submit_worker` (2990-2991),
  v3-TLS totéž (2556). PPLNS kredit jde na `worker` string verbatim
  (`pool.rs:248-255` → `worker_payout_target`).
- Směr krádeže je „donační" (kredit padá na wallet ve worker stringu), takže
  primární zneužití = **vlastní wallet + replay (P-01) bez authorize**, plus
  **telemetry poisoning** — cizí `miner_id` dostane rejected countery a worker
  jména útočníka (viz P-04), `/public/v1/miner/<wallet>` pak ukazuje cizí
  worker names/last_seen.

**Fix:** `handle_submit` → `if !ctx.authorized → unauthorized`; worker/musí
satisfy `split_worker(worker).0 == ctx.session.miner_id` (resp. prefix-match
na autorizovaný username); v3 totéž vůči Hello-bound `miner_id`.

### P-03 · MEDIUM — `/public/v1` rate limit je fakticky globální kvóta webu

`public_rate_limited` klíčuje `stream.peer_addr()` (`api.rs:222`) — přes
edge2→edge SSH tunel přichází všechen veřejný traffic s peer `127.0.0.1` →
**jeden sdílený bucket 120 req/60 s pro celý pool.zionterranova.com**. Jeden
abuser (nebo pár souběžných návštěvníků) vyčerpá kvótu → 429 pro všechny.
Obráceně: limit nikdy nerozliší skutečné klienty. Nginx `limit_req` nad tím
(30 burst) platí per-IP správně, ale pool-side limit je slepý.

**Fix:** respektovat `X-Forwarded-For` pouze když peer je `127.0.0.1`
(trusted proxy), jinak peer IP.

### P-04 · MEDIUM — JSON injection v `format!` serializerech

`format!("\"wallet\":\"{}\"", wallet)` a deriváty (`api.rs:396-399`,
`2127-2150`, `2156+` a `build_public_miner_payload` přes `json!` je OK — ale
ruční `format!` cesty neescapují): `coin`/`wallet` z URL path, a hlavně
**`worker_name`/`miner_id`/`status` z DB** — worker name je miner-controlled
přes stratum login bez charset validace → uložená injekce do `/api/v1/blocks`,
`/miners`, `/api/v1/payouts` i `/public/v1/miner/...` odpovědí. Rozbitá JSON
u klienta, případně forged fields.

**Fix:** všechny serializery přes `serde_json::json!`/`to_string`; `coin`/
`wallet`/`worker_name` whitelist `[a-zA-Z0-9._-]{1,64}` na vstupu.

### P-05 · MEDIUM — Chybějící dedup na externích legách

`record_external_share` se volá na `Accepted`, `Unknown` **i**
`StaleForward` (pearl `accepted_stale_upstream`). `Unknown` znamená
"upstream neodpověděl srozumitelně" — kredit bez verifikace. S P-01 dedupem
se to zmenší, ale stálo by za zvážení `Unknown`/`StaleForward` kreditovat
sníženou vahou nebo logovat do odděleného bucketu (počet unknown-creditů
je metrika kvality upstreamu).

### P-06 · LOW — HTTP vrstva :8080

- `read_line` na request line i každý header **bez délkového capu**
  (`api.rs:211-270`) — loopback scope to tlumí, ale tunel nese internet traffic
  (nginx sice omezuje header size, přesto lepší `take(8192)`).
- Žádný rate-limit na **401** path — `/api`/`/admin` brute-force (key compare
  je non-constant-time `==`). Prakticky jen loopback/tunel — nízké.
- `/stats`, `/miners` bez auth — OK jako interní telemetry (127.0.0.1 bind),
  ale dokumentované: kdokoliv s přístupem na EDGE2:8080 tunel vidí miner list.

## 2. Co je v pořádku

- **Payout path po 25.10 auditu drží:** persist-before-drain, strict
  `parse_payout_submit_response` (error/result.tx_id), `settle_payout`
  atomika, fee cap 10 % batch, coinbase maturity filtr, at-most-once ledger.
- **Block submit** server-side revaliduje hash vs `block_target` a staví
  blok z template — miner nemůže fabrikovat. `paid_block_heights` dedup.
- **Per-IP/session limity:** 10 sess/IP, 2048 global, reconnect limiter,
  NoSolution ban (10 consecutive → 5 min IP ban), TLS i plain.
- **Nginx vhost:** povolen jen `/public/v1/`, `/api`/`/admin` 404, security
  headers, HSTS, limit_req zóna.
- **pool-ui:** žádné `dangerouslySetInnerHTML`, React escaping všude,
  žádné client-side secret; ZIS přes same-origin cookie proxy.
- **ZIS auth cesta** (`zis_password_auth`, `verify` + `is_banned`, required
  mode nek-bypassable přes TLS) — konzistentní v1/v3/TLS.

## 3. Doporučené opravy (priority)

1. **P-01 hotfix:** seen-set `(job_id, nonce)` před validator + v3 share-rate
   limiter + v3 validace proti session target. Regresní test: replay stejné
   share → `duplicate`, žádný druhý kredit. **Nasadit přednostně — jde o
   přímý payout-theft vektor.**
2. P-02: authorize gate + worker↔session binding (v1 i v3).
3. P-03: XFF-aware rate limiter pro tunelovaný traffic.
4. P-04: serde_json serializery + input charset validace.
5. P-05/P-06: unknown-credit bucket, capped reads, 401 limiter.

## 4. Remediace (2026-10-26 — implementováno, testy PASS)

Soubory: `V31/L1/pool/src/pool.rs`, `stratum.rs`, `api.rs`. Build clean,
`cargo fmt --check` clean, `cargo test -p zion-pool --lib` **359/359 PASS**.

| ID | Stav | Implementace |
|---|---|---|
| P-01 | **FIXED** | `Pool::share_seen`/`mark_share_seen` — bounded dedup `HashMap<job_bucket → HashSet<tag>>` (512 job bucketů FIFO, 500k tagů/bucket, fail-closed). `submit_zion_with_target`/`submit_auxpow_with_target`: probe před validátorem, mark až po úspěšné validaci (invalid submit nepálí tag — vardiff legit resubmit přežije). Externí legs: `record_external_share(coin, dedup_job, dedup_tag)` — QTU `(job, nonce:result)`, PRL `(job, proof_b64)`, v3 `(external_job_id, nonce:nonce_hex:hash)`; duplicita → `false` → status `"duplicate"`, žádný druhý kredit. |
| P-02 | **FIXED** | v1 `handle_submit`: `!ctx.authorized` → `unauthorized` před jakoukoli prací; `split_worker(worker).0 != ctx.session.miner_id` → `worker not authorized`. v3 plain+TLS: `submit_miner`/`submit_worker` bound na Hello identitu (prázdný = session default, cizí = `unauthorized_miner`/`unauthorized_worker`). |
| P-03 | **FIXED** | `PoolApi::client_ip` — loopback peer → první hop `X-Forwarded-For`/`X-Real-IP`; non-loopback peer → peer IP (XFF nedůvěryhodné). Rate-limit tabulka bounded (`PUBLIC_RATE_TABLE_MAX=4096`, expired-entry GC, noví klienti při plné tabulce fail-closed). |
| P-04 | **FIXED** | `serialize_{public_,}blocks/payouts/miners_json`, `build_miners_payload`, block/payout route obálky přepsány na `serde_json::json!`/`Value` — veškerý miner-controlled string je escapován. Zůstávají jen Prometheus text exposition (labely sanitizovány) a numerická pole. |
| P-05 | **FIXED** | Externí dedup (P-01) pokrývá i `Unknown`/`StaleForward` cesty — replay téže proof už nemůže re-creditovat. `Unknown`-credit jako takový zůstává designová volba (snížená váha upstreamu = samostatná položka, §5). |
| P-06 | **FIXED** | Request line + každý header capnutý `take(MAX_HTTP_LINE=8 KiB)`, header count `MAX_HTTP_HEADERS=64`. Auth-fail throttle `/api`+`/admin`: `AUTH_FAIL_LIMIT=20`/`60 s` per client IP → connection drop (bounded tabulka). |

**Nové regresní testy** (`stratum.rs` mod tests): `rejects_replayed_share`
(v1 replay → duplicate/share error), `rejects_unauthorized_submit`,
`rejects_foreign_worker_submit`; `pool.rs`: external-share replay assert
v `external_payouts_partition_from_zion`.

**Deployment:** nasazeno 2026-10-26 ~06:58 UTC — viz §5.

## 5. Produkční nasazení remedií (2026-10-26 ~06:58 UTC)

- **Postup:** 3 změněné zdrojáky (`api.rs`, `pool.rs`, `stratum.rs`) nahrány do
  `/opt/zion/V31` na Edgi (sha256 ověřeny proti repu); release build
  `cargo build --release -p zion-pool` offline v resource-capped transient
  unit (`CPUQuota=300%`, `MemoryMax=6G`, 10m42s); backup
  `/root/audit-deploy-103be4e6a-pool-20261026T054251Z` (binárka
  `968f56aa…`, pplns + payouts sidecar, `pool-store.db` .backup, unit).
- **Nasazená binárka:** sha256 `9bedf4a2adc3389c17de8b0d70e98ed6985c16d963df1a6223a8b1d71c703b93`.
- **Live ověření po restartu:** unit active; stratum `0.0.0.0:8444` + TLS
  `:8445`, API `127.0.0.1:8080`; `/health` ok; minery se reconnectly
  (3 sessions do ~40 s, share accepted v3 cestou); PPLNS state restorován
  (214 minerů, 95 982 roundů, unpaid zachován); history 1440 samples.
- **Rollback:** `install /root/audit-deploy-103be4e6a-pool-*/0-zion-pool
  → /opt/zion/V31/target/release/zion-pool` + `systemctl restart
  zion-v31-pool` (state soubory zachovány vedle).

## 6. Zůstatková rizika

- **Restart ztratí dedup okno** — `share_dedup` je in-memory (512 jobů).
  Po restartu lze krátce replayovat staré joby dokud jobs tabulka nevyprší;
  dopad omezený (jobs se rotují s každým templatem), akceptovatelné.
- **`Unknown`/`StaleForward` external credit** zůstává (credited weight na
  unverifikovanou upstream odpověď) — od útoku ho dělí dedup, ale může
  přecenit minery při degradovaném upstreamu. Kandidát na oddělený bucket.
- **Auth-fail a public-rate tabulky** jsou per-IP; NATováni uživatelé sdílí
  kvótu, distribuovaný útok plní tabulku do `PUBLIC_RATE_TABLE_MAX` — pak
  noví klienti dostanou 429 (fail-closed, preferováno před OOM).
- **v1 share rate-limit 10/s** je per-session; aggregate DoS přes N session
  drží `ZION_POOL_MAX_SESSIONS_PER_IP=10` × reconnect limiter.
