# MarketPlace ↔ V2 shop — parity & mailbox

> **Datum:** 2026-10-31 · Předloha: `apps/public_html/V2/shop.html` (+ cart/checkout/email/admin)  
> **Cíl:** market.zionterranova.com = plný rasta e-shop workflow (ne jen NFT).  
> **Live truth (EDGE2, 31. 10.):** `GET /api/shop/capabilities` →
> `softLaunch=false`, `stripe=true`, `email=true`, modes
> `transfer|card|crypto|zion=true`, `commerce=false`.

## Mailbox / capabilities

| Položka | Hodnota |
|---|---|
| **Test now** | **`shop@newearth.cz`** — EDGE2 `.env` identity (`SMTP_USER` / `SHOP_EMAIL` / `ADMIN_EMAIL` / `RESEND_FROM`), host `mail.webglobe.cz:587` |
| Prod cíl | `shop@zionterranova.com` (až bude schránka + MX/SPF/DKIM) |
| SMTP | `SMTP_PASSWORD` **nastaven** (31. 10.) → `capabilities.email=true` |
| Resend | `RESEND_API_KEY` prázdný — SMTP path stačí; Resend = volitelný fallback |
| Stripe | `STRIPE_SECRET_KEY` + webhook secret **nastaveny** → `card=true` |
| Commerce | `COMMERCE_API_KEY` prázdný → `commerce=false` (Coinbase path gated) |
| Soft-launch | `softLaunch=false` (= Stripe ∧ email) — digi+card+ZION veřejně |

## Co sedí (firma / faktury / admin / platby)

| Oblast | Stav |
|---|---|
| Omnity.One IČO/DIČ/banka/Fio IBAN | ✅ `invoice.ts` + `v2-email.ts` COMPANY |
| Rasta order confirmation | ✅ `v2-email.ts` (port V2 HTML) |
| Faktura HTML + PDF download | ✅ `/api/invoice/[id]/download` |
| Admin orders / invoices / shipping | ✅ UI + API |
| Order tracking | ✅ (MP má víc než V2) |
| Stripe card + webhook | ✅ live keys |
| Bank transfer + SPD QR | ✅ |
| B2B checkout (IČO/DIČ/`companyName`) | ✅ `0025b5ada` |
| `statusHistory` audit timeline | ✅ `0025b5ada` |
| SHOPPAY (ZION L1 + QR + l1-watcher) | ✅ `0680bf0aa` — vault `L1_SHOP_VAULT` oddělený od pool payout |
| ZION bonus auto-payout | ✅ paid-only, atomický claim, všech 5 rail (webhook/verify/l1/admin/commerce) + sweep `POST /api/shop/bonus-sweep` z l1-watcheru (5 min) + lazy custodial wallet |
| Coinbase Commerce | ✅ kód; gated dokud 👤 `COMMERCE_API_KEY` |
| Soft-launch digi + transfer | ✅ (nyní supersedováno plným softLaunch=false) |

## Opraveno 29.–31. 10.

1. Zásilkovna pickup — API už nevyžaduje home address; vyžaduje `pickupPoint`; cart má manuální pole (Packeta widget = později).
2. Admin mark paid → `sendPaymentConfirmation` (bank transfer path).
3. Digitální odkazy v rasta e-mailu (`filesUrl` / `instructionsUrl` / `modelUrl` v line items).
4. Kanonický e-mail `shop@zionterranova.com` v defaults + faktuře + EDGE2 `.env` identity.
5. Stránka `/reklamace` + footer odkaz.
6. B2B + `statusHistory` (29. 10.).
7. SHOPPAY + dedicated shop vault (30. 10.).
8. SMTP + Stripe credentials na EDGE2 (do 31. 10.) → soft-launch vypnut.
9. Rasta design pro VŠECHNY emaily `3ec2900d9` — sdílený `buildRastaEmail` shell (admin notif, payment conf, invoice+PDF, bonus, shipping, wallet seed) — ověřeno live `ORD-RASTA-*`.

## Branding / bonus

- Faktura + rasta mail: hlavička **Omnity.One s.r.o.** + org logo `images/logo144.png`.
- ZION bonus: wallet adresa + QR v confirmation; seed zvlášť; kurz konzistentní s loyalty (`SHOP_ZION_PER_CZK`).
- **W3.4 ✅ 31. 10.:** payout wallet `zion1d2k5…` = 187,2M ZION (95 118 UTXO) — fundovaný, CLI 3.2.0 fix (v3-tx bug) → první reálná výplata 900 ZION OK (`ed71f7d6…`). Pozor: `getBalance` = account-model, wallet balance měřit `getUtxos`.

## Zbývá (P1)

| # | Gap | Pozn. |
|---|---|---|
| 1 | Packeta widget | potřeba `ZASILKOVNA_API_KEY` |
| 2 | Coinbase Commerce key | volitelné BTC/ETH/USDC |
| 3 | Rasta HTML i pro shipping/payment (ne jen confirmation) | polish |
| 4 | EUR/EN checkout | V2 mělo |
| 5 | Cancel → restore stock | design gap v admin status |
| 6 | Physical `inStock` flags | 👤 policy (některé merch SKUs `inStock=false`) |
| 7 | Next 14 → 16 (`5.S2`) | major bump před Stable |
| 8 | 5.B6 formální E2E + sign-off | transfer/card+invoice+email evidence |

## Admin checklist (ops)

- `/admin/orders` — status, paid, tracking, invoice send  
- `/admin/invoices` — seznam FV  
- `/admin/shipping` — zásilky  
- Trivi sync — volitelné (`TRIVI_*`)  
- E-mail preview: `/api/email-preview` (admin)  
- Capabilities truth: `curl -s https://market.zionterranova.com/api/shop/capabilities`
