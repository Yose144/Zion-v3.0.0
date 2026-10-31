# ZION eShop E2E Workflow Plan

> **Goal:** Complete e-shop workflow — cart → checkout → order → email → invoice, fully functional end-to-end on `market.zionterranova.com`.
> **Truth-sync:** 2026-10-31 — live host = **EDGE2** (`zion-marketplace` :3100).
> Capabilities: `softLaunch=false`, `stripe=true`, `email=true`,
> `modes.transfer|card|crypto|zion=true`, `commerce=false`.
> Detail parity: [`MARKET_V2_PARITY.md`](MARKET_V2_PARITY.md). Gate ID: **5.B6**.

## Current State (2026-08-06 → supersedováno 31. 10.)

### Already Implemented ✅

| Component | Status | File |
|-----------|--------|------|
| **Prisma Schema** | ✅ Complete | `prisma/schema.prisma` — ShopProduct, ShopOrder, Invoice, ShopSetting |
| **Cart Context** | ✅ Complete | `src/components/shop/CartContext.tsx` — localStorage cart, add/remove/qty |
| **CartProvider** | ✅ Wrapped in layout | `src/app/layout.tsx` |
| **Shop Page** | ✅ Complete | `src/app/shop/page.tsx` — product grid, category filter, sort |
| **ShopProductCard** | ✅ Complete | `src/components/shop/ShopProductCard.tsx` |
| **ShopProductModal** | ✅ Complete | `src/components/shop/ShopProductModal.tsx` |
| **Cart Page** | ✅ Complete | `src/app/cart/page.tsx` — checkout form, shipping, payment, QR modal |
| **Order Success Page** | ✅ Complete | `src/app/order-success/page.tsx` — status, Stripe verify, polling |
| **Order API** | ✅ Complete | `src/app/api/shop/orders/route.ts` — creates order, generates QR, sends emails, creates invoice |
| **Order Status API** | ✅ Complete | `src/app/api/shop/orders/[orderId]/route.ts` |
| **Products API** | ✅ Complete | `src/app/api/shop/products/route.ts` |
| **Seed API** | ✅ Complete | `src/app/api/shop/seed/route.ts` — 20 products seeded |
| **Stripe Checkout** | ✅ Complete | `src/app/api/stripe/checkout/route.ts` |
| **Stripe Webhook** | ✅ Complete | `src/app/api/stripe/webhook/route.ts` — marks paid, sends confirmation |
| **Stripe Verify** | ✅ Complete | `src/app/api/stripe/verify/route.ts` |
| **Admin Orders** | ✅ Complete | `src/app/admin/orders/page.tsx` |
| **Admin Order API** | ✅ Complete | `src/app/api/admin/orders/` — list, status, shipping, invoice send, invoice regenerate |
| **Admin Invoices** | ✅ Complete | `src/app/admin/invoices/page.tsx` |
| **Admin Login** | ✅ Complete | `src/app/admin/login/page.tsx` |
| **Email Library** | ✅ Complete | `src/lib/email.ts` — nodemailer, SMTP config, 5 email types |
| **Rasta Email Template** | ✅ Complete | `src/lib/v2-email.ts` — full rasta-themed HTML template (port of V2) |
| **Invoice Generator** | ✅ Complete | `src/lib/invoice.ts` — HTML invoice with rasta theme, QR code, VAT |
| **Shop API Client** | ✅ Complete | `src/lib/shop-api.ts` — all client-side API calls |
| **Translations** | ✅ Complete | `src/lib/translations.ts` — CS/EN |
| **DB** | ✅ Running | PostgreSQL on Edge, schema synced, 20 products seeded |
| **SMTP** | ✅ Configured | `mail.webglobe.cz:587`, `shop@newearth.cz` |
| **Stripe** | ✅ Configured | Secret key + webhook secret in .env |

### What's Working E2E Right Now

1. **Browse:** `/shop` → 20 products from DB
2. **Add to cart:** Product modal → CartContext → localStorage
3. **Checkout:** `/cart` → form → shipping → payment (transfer/card)
4. **Order creation:** POST `/api/shop/orders` → DB insert → QR code → invoice → emails
5. **Email:** `sendCustomerOrderConfirmation` → rasta HTML template via SMTP
6. **Email:** `sendAdminOrderNotification` → plain text to admin
7. **Invoice:** `createInvoiceForOrder` → HTML with QR → saved to DB
8. **Stripe:** Card payment → webhook → mark paid → send payment confirmation
9. **Order success:** `/order-success` → status polling
10. **Admin:** `/admin/orders` → list, status update, shipping, invoice send/regenerate

### Issues to Fix 🔧

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 1 | **Prisma schema duplicate ShopSetting** | ✅ FIXED | Removed duplicate model |
| 2 | **DB not synced on Edge** | ✅ FIXED | `prisma db push` ran successfully |
| 3 | **Products not seeded** | ✅ FIXED | 20 products seeded via API |
| 4 | **Home page doesn't link to /shop** | HIGH | Add shop link to home page + navbar |
| 5 | **Navbar doesn't show cart count** | MEDIUM | Add cart badge to navbar |
| 6 | **Invoice email sends HTML as attachment, not inline** | LOW | Current: `.html` attachment. Could embed inline. |
| 7 | **No invoice download route** | MEDIUM | Need `/api/invoice/[id]/download` to serve HTML invoice |
| 8 | **No public order tracking page** | LOW | Could add `/order-tracking` for customers |
| 9 | **Rasta theme not applied to shop pages** | HIGH | Shop pages use `zion-section` but may need rasta CSS classes |
| 10 | **Email test not verified** | HIGH | Need to place a test order and verify email arrives |

## Action Plan

### Phase 1: Fix Critical Issues (NOW)

1. **Fix prisma schema** — remove duplicate ShopSetting ✅
2. **Sync DB on Edge** — `prisma db push` ✅
3. **Seed products** — POST `/api/shop/seed` ✅
4. **Add /shop link to home page + navbar** — make shop discoverable
5. **Add cart badge to navbar** — show item count
6. **Build + deploy + restart**

### Phase 2: Verify E2E Flow

1. **Place test order** (bank transfer) → verify:
   - Order created in DB
   - QR code displayed
   - Customer email received (rasta template)
   - Admin email received
   - Invoice created in DB
2. **Place test order** (card payment) → verify:
   - Stripe checkout opens
   - Webhook marks order as paid
   - Payment confirmation email sent
3. **Test admin panel** → verify:
   - Order list loads
   - Status update works
   - Invoice send/regenerate works

### Phase 3: Polish

1. **Add invoice download route** — `/api/invoice/[id]/download` returns HTML
2. **Add order tracking page** — `/order-tracking?order=XXX`
3. **Rasta theme on shop pages** — ensure `zion-section`, `rasta-gold`, `rasta-green`, `rasta-red` classes work
4. **Mobile responsive check** — cart, checkout, shop

## E2E Test Results — 2026-10-28 (5.B6, live on market.zionterranova.com)

Test order `TEST-E2E-1761680000` (digi-001, 390 CZK, virtualni-nakup,
transfer) — **operator: cancel/delete after review.**

| Check | Result |
|---|---|
| Order create + server-side recompute | ✅ pending, 390 CZK, own pricing |
| Idempotent resubmit (same orderId) | ✅ `duplicate:true`, original preserved |
| Bank transfer data | ✅ SPD QR, IBAN, VS `1761680000` |
| Invoice auto-gen | ✅ `FV2026-000031`, VAT split, HTML |
| `GET /api/shop/orders/[id]` | ✅ status + invoice link |
| Public tracking (email-gated) | ✅ data on correct email; **404 on wrong** (no enumeration) |
| `GET /api/invoice/[id]/download` | ✅ HTML 200 + **PDF 200** (432 KB, puppeteer works) |
| ZION customer wallet | ✅ address + seed generated (900 tokens) |
| Rate limit | ✅ present (10/min) |

### Launch blockers (stav 31. 10.)

| # | Blocker (28. 10.) | Stav 31. 10. |
|---|---|---|
| 1 | Stripe keys empty | ✅ `STRIPE_SECRET_KEY` + webhook set → `card=true` |
| 2 | SMTP password empty | ✅ `SMTP_PASSWORD` set → `email=true` (Resend stále prázdný = OK) |
| 3 | Physical `inStock=false` | ⬜ 👤 policy — digi SKUs buyable; merch flags open |
| 4 | 5.B6 formální E2E + sign-off | ✅ 31. 10. [`REPORT_2026-10-31_5B6_ESHOP_E2E.md`](REPORTS/REPORT_2026-10-31_5B6_ESHOP_E2E.md) — transfer+zion+email+invoice; Stripe session create |
| 5 | Next 14 critical (`5.S2`) | ⬜ major bump před Stable |
| 6 | Coinbase Commerce | ⬜ gated (`commerce=false`) — volitelné |
| 7 | Loyalty wallet funding (W3.4) | ⬜ 👤 balance 0 |

### Soft-launch 2026-10-29 ✅ → exited 31. 10.

- Digi/software SKUs buyable via **bank transfer** (card UI gated by
  `/api/shop/capabilities`).
- Runbook: `docs/3.2/B2B_SOFT_LAUNCH.md`.
- **31. 10.:** `softLaunch=false` — Stripe + SMTP live; SHOPPAY + B2B shipped.
- Wide Stable launch stále: Next 15/16 (`5.S2`) + 👤 merch/`inStock` policy.

### Minor bugs

- `stripe/checkout` line-item: `unit_amount = priceCzk*quantity` with
  `quantity: 1` — totals correct, but checkout shows no "×N" for qty>1.
- Admin cancel nevrací stock (design gap).

## Architecture

```
Customer Flow:
  /shop → browse products → add to cart
  /cart → fill form → choose shipping + payment → submit
    → POST /api/shop/orders (creates order + invoice + sends emails)
    → if transfer: show QR modal → /order-success
    → if card: redirect to Stripe → webhook → /order-success

Admin Flow:
  /admin/login → /admin/orders
    → list orders, filter, search
    → update status (pending → processing → shipped → completed)
    → add tracking number → sends shipping email
    → regenerate invoice
    → send invoice email

Email Flow:
  Order created → sendCustomerOrderConfirmation (rasta HTML) + sendAdminOrderNotification
  Stripe paid → sendPaymentConfirmation
  Admin ships → sendShippingNotification
  Admin sends invoice → sendInvoiceEmail (with HTML attachment)

Invoice Flow:
  Order created → createInvoiceForOrder → HTML with QR + VAT → saved to DB
  Admin can regenerate → new invoice number, old cancelled
  Admin can send → email with HTML attachment
```

## Files Modified

- `prisma/schema.prisma` — removed duplicate ShopSetting model ✅
- `src/app/page.tsx` — shop discoverability (navbar has `/shop` + cart)
- `src/components/Navbar.tsx` — cart badge ✅
- `src/app/api/invoice/[id]/download/route.ts` — ✅
- `src/app/order-tracking/page.tsx` — ✅
- `src/app/api/shop/capabilities/route.ts` — soft-launch gate ✅
