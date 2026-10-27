# 7.B2 — Pool residuals: audit-scope assessment (2026-10-27)

Posouzení čtyř pool residuals z wave-7 auditu — stav ověřen proti živému kódu
a produkci (EDGE `cdbb8a29`, schema v9). Výstup = scope položky pro G9/RC
místo slepého fixování; žádná položka není nový money-path defekt.

## R1 — Share-dedup replay okno přes restart ✅ MITIGOVÁNO (residuum: nízké)

- **Stav:** dedup marky persistovány do SQLite (schema v6+), boot restore
  (`share dedup restored from store restored=1118` na `cdbb8a29` deployi).
  Writer = bounded async queue (lock-free hot path — wedge lekce z 26.10.).
- **Residuum:** queue overflow pod floody ⇒ drop marků → replay okno jen
  v řádu writer lag (sekundy), ne celá restart-era. Replayed share =
  job_id+nonce dedup na submit cestě kryje primární vektor.
- **Scope do G9:** potvrdit queue bound + metriku `dedup_marks_dropped`
  (pokud absent, přidat — lehký telemetry item, viz R5).

## R2 — `Unknown`/StaleForward credit ✅ MITIGOVÁNO (residuum: 👤 rozhodnutí)

- **Stav:** separátní bucket `unverified_shares` (`/miners` +
  `zion_pool_coin_shares_unverified` gauge) — commit `c731bf0ea`.
  Knob `ZION_POOL_UNVERIFIED_CREDIT_PCT` default 100 = žádná změna ekonomiky.
- **Residuum:** výchozí váha 100 % je audit-poznatek, ne bug — ekonomická
  volba (snížení při upstream degradaci) = 👤 operátorská páčka.
- **Scope do G9:** dokumentovat jako "operator-configurable trust weight",
  ne hard-coded.

## R3 — Submit-flood DoS ✅ MITIGOVÁNO vrstveně (residuum: NAT false-positive)

- **Stav (ověřeno v `stratum.rs`/`rate_limit.rs`):**
  - per-session `ShareRateLimiter` token bucket —
    `ZION_POOL_SHARE_RATE_PER_SEC` default **10/s**, call site ×3
    (v1 ~L696, TLS-v3 ~L2719, v3 ~L3253);
  - per-IP `IpRateLimiter` — 20 reconnect/60 s (loopback exempt);
  - F4-B NoSolution: max consecutive invalid → IP ban `ZION_POOL_NOSOLUTION_BAN_SECS` default 300 s.
- **Residuum:** (a) per-session bucket lze obejít N spojeními — částečně
  kryje reconnect limit, ale **NAT'd farma sdílí IP budget** → možný
  false-positive ban legit farmy (ops poznatek, ne defekt); (b) valid-share
  flood → dedup-writer backpressure → drop marků (vazba na R1); (c) submit
  path je lehký (dedup lookup + target check) — žádný amplifikační stav.
- **Scope do G9:** ban policy trade-off dokumentovat; žádný nový defekt.

## R4 — Watchdog restart-loop gaming ✅ REFRAMED (residuum: nízké)

- **Stav (ověřeno na EDGE):** `zion-pool-wedgewatch.sh` **NERESTARTUJE** —
  wedge pattern (`/health` ok + `/stats` timeout ×2) → dump thread state +
  gdb backtrace do `/var/log/zion-pool-wedge.log`, 1h cooldown. Restart
  provádí jen systemd (`Restart=always RestartSec=10`, default
  `StartLimitIntervalSec`/`Burst` = 5/10 s back-off).
- **Gaming vektor původního nálezu** (induced restart ⇒ reset stavů):
  **post-v9/v14 uzavřen** — `shares_since_last_block` counter persistován
  (přenesen přes N restartů live), dedup persist, luck persist (v8),
  payout ledger durable+fail-closed (IA-14 + `ae2a09489`). Restart dnes
  neuděluje výhodu; jen unflushed writer lag (R1).
- **Residuum:** crash-loop pod sustained DoS = výpadek, ne gaming — kryjí
  start-limit back-off + stratum reconnect limit.
- **Scope do G9:** zavřít jako mitigované persist-vrstvou.

## Souhrn

| Residuum | Stav | Gate |
|---|---|---|
| R1 dedup okno | mitigováno, lag-only | — |
| R2 Unknown credit | mitigováno | 👤 váha |
| R3 submit-flood | vrstvené limity | G9: NAT trade-off doc |
| R4 watchdog gaming | reframed | — |

**Závěr 7.B2:** všechny 4 residuals jsou v audit scope se zdokumentovaným
stavem — žádná není otevřený money-path defekt. Jediný follow-up kódu:
`dedup_marks_dropped` metrika (R1 observability, ~15 řádků). Pool je pro G9
scope-complete.
