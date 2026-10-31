# 5.B4 — Public copy audit: interní porty/IP + IA-17 loopback peery

**Datum:** 2026-10-31 · **Verdikt: PASS po nápravě (1 leak opraven)**

## Scope

Sweep `apps/website-v2.9/src` (copy + API routes) na interní porty, surové IP,
loopback/private adresy + živá verifikace IA-17 (veřejné API bez loopback peerů).

## Nálezy

| Povrch | Stav |
|---|---|
| Surové IP `207.180.x` / `62.171.x` | ✅ **0 zásahů** v src |
| Stratum endpoint v mining guides | ✅ `stratum+tcp://${SITE_PRIMARY_HOST}:8444` = public hostname (`rpc.zionterranova.com`), env-overridable — legitimní veřejný endpoint |
| `127.0.0.1:8443`/`localhost:8443` v guides | ✅ user-side copy-paste příkazy (miner's own node) — správně |
| `api/` proxy routes → loopback | ✅ server-side only, ne copy |
| **`/api/network`** | ❌ → ✅ **IA-17 leak opraven:** `status.host` echoval env `127.0.0.1` — sanitize maskoval `id`/`name`/`region`, `host` chyběl. Fix: `PRIVATE_HOST_RE` (loopback/RFC1918/link-local) → fallback `SITE_PRIMARY_HOST` |
| `/api/blockchain/peers` | ✅ už maskuje (`isPrivateHost` → `'internal'`) — vzor |
| `/api/cli`, `/api/pool/stats` | ✅ live ověřeno — žádný leak |
| `/monitoring` stránka | ⚠️ veřejná, ukazuje PromQL job labely (`zion-pool:8080`) — minor info leak port-topologie, ne raw IP; akceptovatelné (pool :8080 = veřejné API) |

## Live verifikace (před fixem)

```
GET /api/network → nodes[0].host = "127.0.0.1"   ← leak
GET /api/blockchain/peers → 0 loopback           ✅
GET /api/cli, /api/pool/stats → 0 loopback       ✅
```

## Fix

`src/app/api/network/route.ts` — `sanitizePublicHost()`: loopback/private host →
`rpc.zionterranova.com`. Odolné proti env override (`ZION_NETWORK_NODES_JSON` s
`host:127.0.0.1` už nemůže leaknout). Deploy přes `deploy-web2.9.sh`.
