# B2B-1 Soft-launch — MarketPlace e-shop

> **Datum:** 2026-10-29 · Navazuje na `Zionb2b.md` §B2B-1 / 5.B6
> **Režim:** digi-only bank transfer soft-launch; karty a e-mail až po secrets.

## Co je live bez secrets

| Surface | Stav |
|---|---|
| `/shop` digi + software SKUs (`inStock=true`) | buyable |
| Bank transfer + SPD QR + invoice HTML/PDF | E2E ✅ 28.10. |
| `/order-tracking` (email-gated) | E2E ✅ |
| Card (Stripe) | **OFF** dokud nejsou klíče |
| Transactional e-mail | **OFF** dokud SMTP/Resend |

Soft-launch UI: košík defaultuje na převod; karta je disabled s vysvětlením,
dokud `/api/shop/capabilities` nehlásí `stripe:true`.

## Secrets injection (EDGE2 only — nikdy do repa)

Soubor: `/opt/zion/APP&WEB/MarketPlace/.env` (rsync exclude).

```bash
# Na EDGE2 — doplň hodnoty, pak restart
sudo install -m 600 -o zion -g zion /dev/null /tmp/mp-secrets.env
# edituj a nastav:
#   STRIPE_SECRET_KEY=sk_live_…
#   STRIPE_WEBHOOK_SECRET=whsec_…
#   SMTP_PASSWORD=…          # mail.webglobe.cz / shop@newearth.cz
#   # NEBO místo SMTP:
#   RESEND_API_KEY=re_…
#   RESEND_FROM=shop@newearth.cz
# Hiran (B2B-3) — až existují Stripe Products:
#   HIRAN_PRICE_PRO_ID=price_…
#   HIRAN_PRICE_TEAM_ID=price_…

# Merge do .env (zachovej ostatní klíče), pak:
systemctl restart zion-marketplace.service
```

Stripe Dashboard → Webhooks → endpoint
`https://market.zionterranova.com/api/stripe/webhook`
(events: `checkout.session.completed`, `invoice.paid`,
`customer.subscription.deleted`).

## Soft-launch checklist

1. Digi SKUs in stock (seed) — ✅
2. Transfer E2E — ✅ (28.10.)
3. Soft-launch banner + card gate — ✅ (kód 29.10.)
4. Stripe secrets — ✅ 29.10. (EDGE2); Hiran Pro/Team prices + webhooks live
5. 👤 SMTP/Resend — stále EMPTY (`email:false` v capabilities); card už jde
6. Card E2E + e-mail arrival — card smoke pending; e-mail po SMTP
7. Next 15/16 před **veřejným** (wide) launch — viz `AUDIT-TRIAGE.md`
8. Fyzické merch `inStock` — 👤 rozhodnutí (zatím záměrně false)

## Deploy

```bash
bash apps/MarketPlace/deploy/deploy-marketplace.sh
```

Smoke: `https://market.zionterranova.com/shop` 200,
`/order-tracking` 200, `/ai` 200, `/api/shop/capabilities` → JSON.
