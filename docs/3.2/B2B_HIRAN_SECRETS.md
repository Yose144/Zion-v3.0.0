# Hiran API — Stripe / secrets checklist (B2B-3)

> Free tier (`GET/POST /v1/*` s limity) běží **bez** Stripe.
> Pro/Team vyžadují produkty v Stripe Dashboard + env na EDGE2.

## Stripe Dashboard (👤)

1. Product **Hiran API Pro** — recurring €29/mo → copy `price_…` → `HIRAN_PRICE_PRO_ID`
2. Product **Hiran API Team** — recurring €99/mo → `HIRAN_PRICE_TEAM_ID`
3. Webhook endpoint: `https://market.zionterranova.com/v1/stripe/webhook`
   Events: `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid` (dle `billing.rs`)
4. Webhook signing secret → `STRIPE_WEBHOOK_SECRET` (gateway) — může být
   oddělený od shop webhooku (shop = `/api/stripe/webhook`)

## EDGE2 files

```bash
# MarketPlace (shop + /ai subscribe)
# /opt/zion/APP&WEB/MarketPlace/.env
HIRAN_PRICE_PRO_ID=price_…
HIRAN_PRICE_TEAM_ID=price_…
STRIPE_SECRET_KEY=sk_live_…          # shared with shop
STRIPE_WEBHOOK_SECRET=whsec_…        # shop webhook (separate endpoint)

# Gateway Stripe (optional file)
# /etc/zion/hiran-gateway-stripe.env  (chmod 600, root:zion)
STRIPE_WEBHOOK_SECRET=whsec_…        # gateway endpoint secret
STRIPE_PRICE_PRO=price_…
STRIPE_PRICE_TEAM=price_…

systemctl restart zion-marketplace zion-hiran-gateway
```

`HIRAN_ADMIN_KEY` generuje `deploy-hiran-gateway.sh` do
`/etc/systemd/system/zion-hiran-gateway.service.d/admin-key.conf` (0600).

## Smoke po secrets

```bash
curl -s https://market.zionterranova.com/v1/models
# Free key from /ai →
curl -s https://market.zionterranova.com/v1/chat/completions \
  -H "X-API-Key: zis_…" -H "Content-Type: application/json" \
  -d '{"model":"hiran-mini","messages":[{"role":"user","content":"ping"}]}'
curl -s https://market.zionterranova.com/v1/usage -H "X-API-Key: zis_…"
```
