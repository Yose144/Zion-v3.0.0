# REPORT — 5.B6 e-shop E2E (live market.zionterranova.com)

> **Datum:** 2026-10-31T15:15Z · **Host:** EDGE2 `zion-marketplace`  
> **Gate:** `docs/3.2/3.2.1-3.2.9_PLAN.md` §5.B6  
> **Capabilities at run:** `softLaunch=false`, `stripe=true`, `email=true`,
> `modes.transfer|card|crypto|zion=true`, `commerce=false`

## Orders (operator: cancel after review)

| OrderId | Payment | Result |
|---|---|---|
| `TEST-5B6-20261031T151522Z` | transfer | pending + invoice + emails |
| `TEST-5B6-20261031T151522Z-Z` | zion (SHOPPAY) | pending + vault QR + emails |

SKU: `book-001` (Království srdce — digitální kniha), **144 Kč / 1440 ZION**.

## Checklist

| Check | Result |
|---|---|
| Capabilities gate | ✅ softLaunch exited |
| Order create + server reprice | ✅ `totalCzk=144`, wallet generated |
| Idempotent resubmit | ✅ `duplicate:true` |
| Bank transfer SPD | ✅ IBAN Fio, VS, SVG QR |
| Invoice auto-gen | ✅ `FV2026-000038` (`cmvwjm32m00costxiz5kjppap`) |
| Invoice HTML download | ✅ 200 / 12 143 B (Omnity + FV2026 + book) |
| Invoice PDF download | ✅ 200 / 358 662 B (PDF 1.4) |
| Public track (correct email) | ✅ PII-safe payload + invoice list |
| Public track (wrong email) | ✅ identical 404 (no enumeration) |
| `statusHistory` | ✅ `[{status:pending,by:customer,…}]` |
| Transactional email (journal) | ✅ wallet + admin notify + customer confirmation **with invoice attachment** (×2 orders) |
| Stripe checkout session | ✅ `POST /api/stripe/checkout` → `cs_live_…` hosted URL (**session only — not paid**) |
| SHOPPAY / ZION | ✅ vault `zion1f3y5j0l4p0m4g7g525a3g2z5u7a4m2q0t2pn0t0`, memo `SHOPPAY:…-Z`, amountZion 1440, URI + QR + CLI hint |
| Coinbase Commerce | ⬜ gated (`commerce=false`) — out of scope |

## Evidence snippets

```
Customer wallet email sent for TEST-5B6-20261031T151522Z
Admin order notification sent for TEST-5B6-20261031T151522Z
Customer order confirmation sent for TEST-5B6-20261031T151522Z (with invoice attachment)
```

## Verdict

**5.B6 PASS (scoped):** digi checkout → invoice → email → track is live for
**transfer** and **zion**; **card** path proven by live Checkout Session
create (no charge). Residual for Stable (not 5.B6 blockers):

- 👤 cancel/delete the two `TEST-5B6-*` orders + abandon Stripe session
- physical `inStock` policy, Packeta widget, Commerce key, Next 14→16 (`5.S2`)
- loyalty funding (W3.4) for bonus payouts

## Related

- [`MARKET_V2_PARITY.md`](../MARKET_V2_PARITY.md)
- [`ESHOP_WORKFLOW_PLAN.md`](../ESHOP_WORKFLOW_PLAN.md)
