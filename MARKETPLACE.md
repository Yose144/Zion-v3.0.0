# ZION MarketPlace — System Overview

> One document covering the OASIS Artifact Marketplace, e-shop, admin dashboard, invoices, emails, theming, and deployment.
> Source: `APP&WEB/MarketPlace/`
> Live URL: `https://market.zionterranova.com`
> Runtime: `systemd zion-marketplace.service` on Edge (`62.171.141.136`), port `3100`

---

## 1. What is MarketPlace?

`MarketPlace` is a Next.js 14 application that serves two distinct purposes:

1. **NFT / OASIS Artifact Marketplace** — ERC-1155 artifact trading on Base L2 using `wZION` (`0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`).
2. **Physical & Digital e-shop** — checkout, orders, invoicing, shipping tracking, and Stripe/card payment support.

Both flows share the same Next.js app, PostgreSQL database, admin dashboard, and design system.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14.2.35 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + custom `ZION Theme` tokens in `src/app/globals.css` |
| Database | PostgreSQL via Prisma 5.22.0 |
| ORM | Prisma (`prisma/schema.prisma`) |
| Auth | Admin API key (`X-API-Key` / `Authorization: Bearer`) + `ADMIN_USERS` login |
| Email | `nodemailer` + SMTP (currently `mail.webglobe.cz`) |
| Blockchain | wagmi/viem, WalletConnect/Reown, Base L2 |
| Payments | Stripe checkout + manual bank transfer QR |
| Deploy | `rsync .next` to Edge + `systemctl restart zion-marketplace.service` |

---

## 3. Project Structure

```
APP&WEB/MarketPlace/
├── .env.example                  # Required environment variables
├── next.config.*                 # Next.js config (standalone output for deploy)
├── package.json
├── prisma/
│   ├── schema.prisma             # DB schema (Artifact, Listing, Sale, ShopOrder, Invoice, ...)
│   └── seed.ts                   # Seed products / initial data
├── public/                       # Static assets
├── src/
│   ├── app/
│   │   ├── (routes)              # Main marketplace pages
│   │   ├── admin/                # Admin dashboard pages
│   │   ├── api/                  # API routes
│   │   ├── cart/                 # Shop checkout page
│   │   ├── layout.tsx / page.tsx # Root layout
│   │   └── globals.css           # ZION Theme design tokens
│   ├── lib/
│   │   ├── db.ts                 # Prisma client singleton
│   │   ├── email.ts              # All email dispatch
│   │   ├── invoice.ts            # Invoice HTML + number generation
│   │   ├── v2-email.ts           # Customer order confirmation HTML template
│   │   ├── settings.ts           # Active rasta/zion theme from DB
│   │   ├── shop-api.ts           # Client-side shop/admin API helpers
│   │   └── admin-auth.ts         # localStorage admin key helpers
│   ├── components/               # React components
│   ├── types/shop.ts             # Shop TypeScript types
│   └── middleware.ts             # CORS + admin API key protection
```

---

## 4. Database Models

### 4.1 NFT Marketplace

| Model | Purpose |
|-------|---------|
| `Artifact` | ERC-1155 token metadata (`tokenId`, `contractAddress`, `imageUri`, `rarity`, `stats`, ...) |
| `Listing` | Fixed-price or auction sale offer (`price` in wZION wei, `status`, `highestBid`, ...) |
| `Bid` | Auction bid per listing |
| `Sale` | Completed NFT transaction with `txHash` |
| `Collection` | Optional grouping of artifacts |
| `UserProfile` | On-chain address profile (username, avatar, stats) |
| `EventLog` | On-chain event indexer cache |

### 4.2 e-shop

| Model | Purpose |
|-------|---------|
| `ShopProduct` | Physical / digital products (`priceCzk`, `stock`, `tokens`, `digital`, ...) |
| `ShopOrder` | Customer order (`orderId`, `status`, `paymentStatus`, `customer*`, `shipping`, `payment`, `items` JSON, ...) |
| `Invoice` | Generated invoice per order (`invoiceNumber`, `html`, `pdfUrl`, `status`) |
| `ShopSetting` | Generic key/value settings — currently stores active theme `shop_theme` (`rasta` / `zion`) |

---

## 5. Shop Flow

### 5.1 Browse & Cart

- `GET /api/shop/products` returns paginated `ShopProduct` list.
- `src/app/cart/page.tsx` displays cart, shipping options, payment method, customer form.
- Shipping methods:
  - `zasilkovna-home` — home delivery
  - `zasilkovna` — pickup point
  - `virtualni-nakup` / `virtualni-odber` — digital delivery
- Payment methods:
  - `transfer` — bank transfer (default)
  - `card` — Stripe checkout
  - `crypto` — placeholder

### 5.2 Create Order

`POST /api/shop/orders`

Validations:
- `orderId`, `customer.name`, `customer.email`, `customer.phone` required
- `termsAccepted` must be `true`
- Address required for `zasilkovna-home`

Flow:
1. Creates `ShopOrder` with `status = pending` and `paymentStatus = pending`.
2. Generates bank-transfer QR code (`SPD*1.0*...`) for `transfer` payments.
3. Calls `createInvoiceForOrder()` from `src/lib/invoice.ts`.
4. Sends `sendAdminOrderNotification()` and `sendCustomerOrderConfirmation()` in the background.

Response:
```json
{
  "success": true,
  "data": {
    "order": { ... },
    "invoice": { ... },
    "bank": { "account", "iban", "bic", "vs", "amount", "qrCode" }
  }
}
```

### 5.3 Order Statuses

`ShopOrder.status`: `pending | paid | processing | shipped | completed | cancelled`

`ShopOrder.paymentStatus`: `pending | paid | failed`

Status transitions are done from the admin dashboard (`/admin/orders`) via `PUT /api/admin/orders/[id]/status`.

### 5.4 Stripe

- `POST /api/stripe/checkout` creates a Stripe Checkout session.
- `POST /api/stripe/webhook` handles `checkout.session.completed` and marks order as paid.

---

## 6. Admin Dashboard

### 6.1 Login

- `/admin/login` uses `ADMIN_USERS` env (`username:password,username:password`).
- On success returns `ADMIN_API_KEY` which is stored in `localStorage` (`zion_market_admin_key`) and sent as `X-API-Key` header.
- `middleware.ts` validates `ADMIN_API_KEY` for all `/api/admin/*` routes except `/api/admin/login`.

### 6.2 Pages

| Route | Purpose |
|-------|---------|
| `/admin/orders` | List, search, filter, update status, set tracking number, send/regenerate invoice |
| `/admin/invoices` | Browse and preview generated invoices |
| `/admin/shipping` | Shipping overview / bulk tracking |
| `/admin/stripe` | Stripe dashboard helpers |
| `/admin/login` | Admin login |

### 6.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/orders` | List orders with filters/pagination |
| GET | `/api/admin/orders/[id]` | Single order detail |
| PUT | `/api/admin/orders/[id]/status` | Update order status |
| PUT | `/api/admin/orders/[id]/shipping` | Update tracking number |
| POST | `/api/admin/orders/[id]/invoice` | Regenerate invoice |
| POST | `/api/admin/orders/[id]/invoice/send` | Send invoice email to customer |
| GET/PUT | `/api/admin/settings` | Read / write theme (`rasta` / `zion`) |
| POST | `/api/admin/login` | Admin login |
| POST | `/api/admin/env` | (legacy) env helpers |

### 6.4 Theme Switcher

- Located in `src/app/admin/layout.tsx`.
- Reads/writes `/api/admin/settings` key `shop_theme`.
- Theme is used for customer confirmation emails and invoices.

---

## 7. Invoices

### 7.1 Generation

`src/lib/invoice.ts`

- Invoice number format: `FV{YYYY}-{000001}` (per-year counter).
- Seller: `Omnity.One s.r.o.`, IČO `09120050`, DIČ `CZ09120050`.
- Bank: Fio banka, IBAN `CZ63 2010 0000 0029 0180 9148`, BIC/SWIFT `FIOBCZPPXXX`.
- VAT: 21% (per-item base + VAT breakdown).
- Generates QR payment code (SVG, base64 data URI) compatible with Czech banking apps.
- HTML is generated according to active theme (`rasta` / `zion`).

### 7.2 Invoice States

`Invoice.status`: `draft | issued | paid | cancelled`

On regeneration, old `draft` invoices for the order are marked `cancelled`.

### 7.3 Public Invoice

`GET /api/invoices/[id]` — public preview of invoice HTML.

### 7.4 Admin Invoice Send

`POST /api/admin/orders/[id]/invoice/send`

Sends the latest invoice HTML as an email attachment (`faktura-{orderId}.html`) to the customer.

---

## 8. Emails

### 8.1 Configuration

`src/lib/email.ts` reads SMTP from env at runtime:

```
SMTP_HOST=mail.webglobe.cz
SMTP_PORT=587
SMTP_USER=shop@newearth.cz
SMTP_PASSWORD=...
ADMIN_EMAIL=admin@newearth.cz
SHOP_EMAIL=shop@newearth.cz
SHOP_NAME=ZION eShop
```

### 8.2 Email Types

| Function | Trigger | Recipient |
|----------|---------|-----------|
| `sendAdminOrderNotification` | New order | `ADMIN_EMAIL` |
| `sendCustomerOrderConfirmation` | New order | customer |
| `sendPaymentConfirmation` | Stripe webhook payment received | customer |
| `sendInvoiceEmail` | Admin clicks "Send invoice" | customer |
| `sendShippingNotification` | Order marked shipped | customer |

### 8.3 Customer Confirmation Template

`src/lib/v2-email.ts`

- Generates table-based, email-client-safe HTML.
- Uses active theme (`rasta` / `zion`) from `ShopSetting`.
- Sections: header, success icon, order details, items, ZION token bonus, shipping address, payment info with QR, next steps, footer.

---

## 9. Theming (`rasta` / `zion`)

### 9.1 Storage

Active theme is stored in `ShopSetting` table under key `shop_theme`.

`src/lib/settings.ts`:
- `getActiveTheme()` returns `rasta` or `zion`.
- `setActiveTheme(theme)` updates the DB.

### 9.2 Where It Applies

- Customer order confirmation email (`v2-email.ts`)
- Invoice HTML (`invoice.ts`)
- Admin layout has a theme selector in the header.

### 9.3 Palettes

**Zion** (official ZION design system)
- Gold `#ffd700`
- Purple `#9333ea`
- Cyan `#06b6d4`
- Blue `#1e3a8a`
- Background `#090a0f`

**Rasta**
- Green `#1c7b1c`
- Gold `#FFD700`
- Red `#c01026`
- Bright green `#00ff7f`
- Background `#0a0a0a`

---

## 10. Environment Variables

See `APP&WEB/MarketPlace/.env.example` for full list.

Critical ones:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `ADMIN_API_KEY` | Key for `/api/admin/*` and dashboard |
| `ADMIN_USERS` | `user:pass,user:pass` for `/admin/login` |
| `SMTP_HOST/SMTP_USER/SMTP_PASSWORD` | Email delivery |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Card payments |
| `NEXT_PUBLIC_WZION_ADDRESS` | wZION on Base |
| `NEXT_PUBLIC_SITE_URL` | `https://market.zionterranova.com` |

---

## 11. Build & Deploy

### 11.1 Local Build

```bash
cd APP&WEB/MarketPlace
npm install
npx prisma generate
npm run build
```

### 11.2 Deploy to Edge

```bash
rsync -az --delete -e 'ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29' \
  APP&WEB/MarketPlace/.next \
  zion-new:'/opt/zion/APP&WEB/MarketPlace/'

ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 zion-new \
  'systemctl restart zion-marketplace.service'
```

Service file runs `npm run start` (port 3100) behind nginx.

---

## 12. Security Notes

- Admin API is protected by `ADMIN_API_KEY` in `middleware.ts`.
- Admin login is HTTP-only, key stored in `localStorage`.
- Never commit `.env`, deployer keys, or SMTP passwords.
- CORS restricted to `*.zionterranova.com` and localhost.

---

## 13. Common Operations

### Send test order + invoice

```bash
# 1. Set theme
curl -X PUT -H 'X-API-Key: $ADMIN_API_KEY' \
  -H 'content-type: application/json' \
  -d '{"theme":"zion"}' \
  https://market.zionterranova.com/api/admin/settings

# 2. Create order
curl -X POST -H 'content-type: application/json' \
  -d '{"orderId":"TEST-001",...}' \
  https://market.zionterranova.com/api/shop/orders

# 3. Send invoice
curl -X POST -H 'X-API-Key: $ADMIN_API_KEY' \
  https://market.zionterranova.com/api/admin/orders/{id}/invoice/send
```

### Regenerate / preview invoice

- Regenerate: `POST /api/admin/orders/[id]/invoice`
- Preview: `GET /api/invoices/[invoiceNumber]`

---

## 14. Files of Interest

| File | Why |
|------|-----|
| `src/lib/invoice.ts` | Invoice HTML, numbering, QR, VAT |
| `src/lib/v2-email.ts` | Customer confirmation email template |
| `src/lib/email.ts` | SMTP dispatch + all email types |
| `src/lib/settings.ts` | `rasta` / `zion` theme DB helpers |
| `src/app/api/shop/orders/route.ts` | Shop checkout & order creation |
| `src/app/admin/orders/page.tsx` | Admin order management UI |
| `prisma/schema.prisma` | All DB models |

---

Last updated: 2026-08-02
