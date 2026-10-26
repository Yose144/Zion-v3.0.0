# Pool DoS layers — `zion-v31-pool` (EDGE, 8444/8445/8080)

> A4.6 — inventarizace obranných vrstev + kernel/conntrack tuning.
> Stratum **není** za nginx — přímý TCP záměrně (per-IP limity potřebují
> reálnou IP minerů). Edge je tedy fronta sama.

## Vrstvy (vnější → vnitřní)

| Vrstva | Mechanismus | Limity / default |
|---|---|---|
| L0 edge | fail2ban (`sshd`), nftables, ISP | sshd-only; stratum nechrání — zbytek je na poolu |
| L1 TCP accept | `TcpListener` per listener (plain/TLS/extra) | backlog = tokio default (1024), `somaxconn=8192` ≥ |
| L2 session admission | ban check → reconnect rate → per-IP cap → global cap | viz níže |
| L3 protocol | request/line caps, auth throttle | `MAX_HTTP_LINE` 8 KiB, `MAX_HTTP_HEADERS` 64 |
| L4 submit | share rate limiter, dedup cap | `ZION_POOL_SHARE_RATE_PER_SEC` = 10/s/session |
| L5 state | bounded tables | dedup 512 jobů × 500k tagů fail-closed; rate tabulky capped |

## L2 — session admission (stratum.rs `run()`)

Pořadí checků na každém `accept()` — levné → dražší:

1. **NoSolution ban** — `ip_sessions` tabulka banů; `ZION_POOL_MAX_NO_SOLUTION`
   (10) po sobě jdoucích session bez validního share → ban
   `ZION_POOL_NOSOLUTION_BAN_SECS` (300 s).
2. **Reconnect rate** — `IpRateLimiter`: max **20 reconnectů/min/IP**
   (`RateLimitConfig::default`).
3. **Per-IP session cap** — `ZION_POOL_MAX_SESSIONS_PER_IP` (**10**).
4. **Global session cap** — `ZION_POOL_MAX_SESSIONS` (**2048**) — refuse
   před spawnem session tasku.

Pořadí fail-fast: ban → rate → per-IP → global. Overflow cesty dropnou
socket bez alokace session objektu.

## L3 — HTTP API (:8080, loopback + tunel)

- **Public tier** (`/public/v1/*`): `PUBLIC_RATE_LIMIT` **120 req / 60 s /
  IP**; tabulka `PUBLIC_RATE_TABLE_MAX` **4096** — plná tabulka **fail
  closed** pro nové IP (není memory-DoS přes spoofing).
- **Auth tier** (`/api`, `/admin`): `AUTH_FAIL_LIMIT` **20 / 60 s / IP** —
  opakované špatné klíče = connection drop, ne další 401.
- **XFF trust**: `X-Forwarded-For` se akceptuje jen od **loopback** peera
  (nginx/tunel hop); externí XFF se ignoruje → rate-limit podvod nemožný.
- Bounded parsing: 8 KiB request-line/headers, 64 headerů, `Connection: close`.

## L4+L5 — submit & state caps

- `ShareRateLimiter`: **10 share/s/session** (`ZION_POOL_SHARE_RATE_PER_SEC`).
- Share dedup: in-memory 512 job bucketů × `SHARE_DEDUP_TAG_CAP` 500k tagů;
  **saturated bucket = fail closed** (share = duplicate), ne růst bez meze.
  Persisted kopie (schema v7, A4.1) se maže s FIFO evicty — disk drží
  proporcionalitu.
- PPLNS/history tabulky: 24h retence, 60s cadence (bounded by design).

## Kernel / conntrack (EDGE, změřeno 2026-10-26)

| sysctl | hodnota | poznámka |
|---|---|---|
| `net.core.somaxconn` | **8192** | ≥ accept backlog; pool accept smyčka dřina okamžitě |
| `net.ipv4.tcp_max_syn_backlog` | **8192** | SYN flood headroom |
| `net.ipv4.tcp_syncookies` | **1** | SYN flood ochrana |
| `net.ipv4.tcp_tw_reuse` | **1** | TIME-WAIT reuse (miner reconnect churn) |
| `net.netfilter.nf_conntrack_max` | **262144** | ~64× current load; 2048 session cap = nikdy limit |

**Verifikace:** `sysctl net.core.somaxconn net.ipv4.tcp_max_syn_backlog
net.ipv4.tcp_syncookies net.netfilter.nf_conntrack_max` · `conntrack -C`
(current) · `ss -s` (estab/timewait rozpis).

**Sledovat:** `ss -tn state syn-recv | wc -l` (SYN backlog zaplnění),
`conntrack -C` vs `nf_conntrack_max` (>70 % = raise limit nebo
`nf_conntrack_tcp_timeout_time_wait` zkrátit), `ss -s` timewait burst.

### Když DoS dorazí

- **Stratum SYN flood**: syncookies drží; když `syn-recv` roste →
  `nftables` rate-limit per /24 před 8444/8445 (stratum je veřejný port —
  nelze IP-allowlist, mineri jsou dynamičtí).
- **API flood**: loopback/tunel only — `:8080` není public-facing;
  veřejné `/public/v1/*` jede přes EDGE2 nginx → tunel (nginx rate limit
  je další vrstva tam).
- **Session churn**: `ZION_POOL_MAX_SESSIONS_PER_IP` snížit (env, bez
  rebuildu) + NoSolution ban agresivněji (`ZION_POOL_NOSOLUTION_BAN_SECS`).
- **Dead upstream leg** = miner grief: A4.4 stale-job alert (Telegram) +
  `zion_pool_leg_job_age_ms` prometheus rule (A4.5).

## Ops checklist při incidentu

1. `ss -s` + `ss -tn state syn-recv | wc -l` — SYN flood vs normální churn
2. `journalctl -u zion-v31-pool | grep -cE 'reconnect rate limit|NoSolution|session cap'` — L2 limity pracují?
3. `sqlite3 /opt/zion/data/v31/pool-store.db 'SELECT COUNT(*) FROM share_dedup'` — dedup tabulka nebublá?
4. `conntrack -C` vs 262144 — conntrack saturovaný?
5. Restart = graceful drain (A4.3): `final pplns flush persisted` musí být
   v journalu před `Stopped` — jinak SIGKILL path (diagnostikovat).

## Otevřené rezidua

- Žádný per-IP limit na **TLS handshake** (CPU cost před session caps) —
  mitigace = TLS port je vedlejší; kdyby se stal cílem → nftables connlimit.
- `active_sessions` counter je sdílený cross-listener (správně), ale per-IP
  cap je per-listener `ip_sessions` — extra/TLS porty mají vlastní mapy.
  Residuální: attacker obchází cap přes 3 porty (10×3 sessions max — pořád
  bounded pod global 2048).
- nftables stratum rate-limit neexistuje — první obrana je L2 v poolu.
