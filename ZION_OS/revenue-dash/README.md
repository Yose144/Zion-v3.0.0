# ZION Revenue Dashboard — BOOST streams

Interní dashboard pro sledování **BOOST streamů** (QTC, PRL, VRSC, ZANO, …) v ZION poolu.

## Co to je

Public desktop miner těží **ZION** pro uživatele a na pozadí pouští **BOOST** streamy
(externí coiny), jejichž výnos jde do ZION pool walletu → treasury / grow / liquidity.
Tento dashboard ukazuje **aktivitu** těchto streamů — hashrate, accepted shares, fee,
stav legů a cílovou pool wallet.

> **Proč ne USD číslo:** BOOST výnos platí upstream pooly přímo do pool walletu, ne přes
> miner payout ledger. Bez upstream API by jakékoli USD číslo bylo odhad, ne fakt.
> Dashboard proto zobrazuje měřitelné veličiny (hashrate, accepted shares, fee config)
> a adresu, kam výnos jde.

## Data source

Veřejné pool API (bez auth):

- `GET /public/v1/coins` — seznam coinů + legs (`connected`, `enabled`, `fee_bps`)
- `GET /public/v1/coins/{coin}/stats` — `hashrate.live`, `accepted_total`, `payouts_24h`, `active_miners`

Default base: `https://pool.zionterranova.com` (override `POOL_API_BASE`).

## Spuštění

```bash
python3 ZION_OS/revenue-dash/app.py
# http://127.0.0.1:8770
```

Env:

| Proměnná | Default | Význam |
|---|---|---|
| `POOL_API_BASE` | `https://pool.zionterranova.com` | pool API base URL |
| `REVENUE_DASH_PORT` | `8770` | port |
| `REVENUE_DASH_HOST` | `127.0.0.1` | bind host (interní) |

## Endpointy

- `GET /` — HTML dashboard (auto-refresh 30 s)
- `GET /api/revenue` — JSON agregace (cache 20 s)
- `GET /health` — liveness

## Nasazení (volitelné)

Interní — nedoporučuje se veřejně. Pokud ano, za nginx basic auth
(`dashboard.zionterranova.com` vzor) a na EDGE2/EDGE.

## Související

- [`DESKTOP-AGENT-COMPLETE-PLAN.md`](../../DESKTOP-AGENT-COMPLETE-PLAN.md) §8 — Public revenue model
- [`AGENTS.md`](../../AGENTS.md) — pool wallet, BOOST streamy
- `V31/L1/pool/src/api.rs` — `/public/v1/coins/*` implementace
