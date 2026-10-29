# MarketPlace ↔ V2 shop — parity & mailbox

> **Datum:** 2026-10-29 · Předloha: `apps/public_html/V2/shop.html` (+ cart/checkout/email/admin)  
> **Cíl:** market.zionterranova.com = plný rasta e-shop workflow (ne jen NFT).

## Mailbox (blokuje e-maily)

| Položka | Hodnota |
|---|---|
| **Test now** | **`shop@newearth.cz`** — EDGE2 `.env` identity (`SMTP_USER` / `SHOP_EMAIL` / `ADMIN_EMAIL` / `RESEND_FROM`), host `mail.webglobe.cz:587` |
| Prod cíl | `shop@zionterranova.com` (až bude schránka + MX/SPF/DKIM) |
| Heslo | `SMTP_PASSWORD=` — 👤 doplnit z Webglobe (admin → E-mail → shop@newearth.cz). Bez něj `capabilities.email=false`. |

Karty jdou (Stripe); potvrzení e-mailem až po heslu.

## Co sedí (firma / faktury / admin)

| Oblast | Stav |
|---|---|
| Omnity.One IČO/DIČ/banka/Fio IBAN | ✅ `invoice.ts` + `v2-email.ts` COMPANY |
| Rasta order confirmation | ✅ `v2-email.ts` (port V2 HTML) |
| Faktura HTML + PDF download | ✅ `/api/invoice/[id]/download` |
| Admin orders / invoices / shipping | ✅ UI + API |
| Order tracking | ✅ (MP má víc než V2) |
| Stripe card + webhook | ✅ 29.10. |
| Soft-launch digi + transfer | ✅ |

## Opraveno 29.10. (P0 z auditu)

1. Zásilkovna pickup — API už nevyžaduje home address; vyžaduje `pickupPoint`; cart má manuální pole (Packeta widget = později).
2. Admin mark paid → `sendPaymentConfirmation` (bank transfer path).
3. Digitální odkazy v rasta e-mailu (`filesUrl` / `instructionsUrl` / `modelUrl` v line items).
4. Kanonický e-mail `shop@zionterranova.com` v defaults + faktuře + EDGE2 `.env` identity.
5. Stránka `/reklamace` + footer odkaz.

**Deploy 29.10.:** MarketPlace live (build OK); `/reklamace` `/admin/orders` `/cart` `/api/email-preview` = 200; capabilities `stripe/card=true`, `email=false` do mailboxu.

## Branding / bonus (29.10. večer)

- Faktura + rasta mail: hlavička **Omnity.One s.r.o.** + org logo `images/logo144.png` (IntroPage footer).
- ZION bonus: wallet adresa + QR v confirmation (V2 parity); seed zvlášť; fallback tokenů 1 Kč = 1 ZION když katalog `tokens=0`.


## Zbývá (P1)

| # | Gap | Pozn. |
|---|---|---|
| 1 | Packeta widget | potřeba `ZASILKOVNA_API_KEY` |
| 2 | SMTP/Resend live | po mailboxu |
| 3 | Rasta HTML i pro shipping/payment (ne jen confirmation) | polish |
| 4 | B2B odběratel IČO/DIČ na checkoutu | V2 taky nemělo |
| 5 | `statusHistory` audit | V2 mělo |
| 6 | EUR/EN checkout | V2 mělo |

## Admin checklist (ops)

- `/admin/orders` — status, paid, tracking, invoice send  
- `/admin/invoices` — seznam FV  
- `/admin/shipping` — zásilky  
- Trivi sync — volitelné (`TRIVI_*`)  
- E-mail preview: `/api/email-preview` (admin)
