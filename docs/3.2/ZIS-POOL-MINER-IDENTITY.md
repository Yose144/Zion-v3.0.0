# ZIS ↔ Pool: miner identity & payout routing (design — 9.B/3.B follow-up)

> Stav: NÁVRH (2026-10-28). Žádná produkční změna — pouze architektura.
> Kontext: payout wallet přešla na canonical `pool_payout` (187k ZION);
> zbývá identita minerů — „kdo vlastní payout adresu a kam se vyplácí".

## 1. Problém dnes

- Miner = `address/worker` string ve stratum hello. Payout jde na adresu
  v hello — žádný důkaz vlastnictví, žádná změna adresy, žádný účet.
- `miner_settings` (v10) a `alert_subscriptions` (v10) jsou keyed
  `miner_id` — mechanismus pro per-wallet threshold + offline alerty už
  existuje, ale chybí vrstva, která `miner_id` váže na reálného uživatele.
- QTU/PRL attestation (3.B3) dnes dokazuje jen ZION-key — payout-gated
  externí linky potřebují stejný ownership-proof model.

## 2. Cílový model

```
ZIS account (DID/JWT)
   │ claim/bind challenge
   ▼
miner_binding: miner_id → zis_did → payout_address (+alt addrs)
   │                            │
   ▼                            ▼
stratum auth (hello JWT/apikey)   payout routing + thresholds + alerts
```

## 3. Komponenty

### 3.1 Binding (ZIS strana)

- Nová tabulka `zis_miner_bindings` (ZIS db): `miner_id`, `zis_did`,
  `payout_address`, `verified_at`, `verify_method`, `revoked_at`.
- **Bind flow:** web UI → ZIS vydá challenge → uživatel podepíše
  payout-wallet klíčem (`ed25519.sign(challenge)`) NEBO pošle micro-tx
  z payout adresy na canonical adresu s memo nonce → ZIS ověří → binding
  active. Žádný uživatelský klíč se neukládá — jen podpis/tx důkaz.

### 3.2 Stratum auth (pool strana)

- Hello/authorize může nést `zis_token` (krátkodobý EdDSA JWT z ZIS)
  nebo per-miner `api_key` (ZIS-issued, rotatable).
- Pool ověří podpis přes **cached JWKS** z `https://…/.well-known/jwks`
  (refresh 5 min, fail-open na legacy režim během přechodu).
- Nepřihlášený miner = **legacy mode** (současný chod) — žádný hard cut.

### 3.3 Payout routing

- Při `record_payout`: address resolution order —
  1. `miner_binding.payout_address` (pokud miner bound + verified)
  2. hello address (legacy)
  3. hold+flag pokud konflikt (bound miner poslal cizí adresu → alert).
- `miner_settings.min_payout_flowers` už řeší per-account threshold
  (v10) — ZIS UI jen zapisuje přes ZIS-scoped API key.

### 3.4 Alerty

- `alert_subscriptions.target` = ZIS contact (email/webpush/DID inbox)
  místo ručního channel — offline→online transitions už fungují.

### 3.5 QTU/PRL attestation upgrade

- Ten samý binding dokazuje externí adresy: `bind_external(coin,
  address, signature)` — payout-gated linky (3.B3) pak můžou ověřit
  i QTU/PRL key ownership, ne jen ZION.

## 4. API změny (minimal surface)

- ZIS: `POST /api/zis/miner/bind`, `GET /api/zis/miner/{did}`,
  `DELETE …/unbind`, `POST …/bind-external`. JWKS už existuje.
- Pool: nový `miner_resolver` modul — `bind=1` flag v hello,
  cache bindings (60 s TTL, mimo `pool` mutex — wedge lekce),
  `GET /public/v1/miner/{id}/identity` (jen bound flag + masked DID).

## 5. Migrace

1. Ship read-only: binding tabulka + claim UI (žádný pool vliv).
2. Pool accept `zis_token` — legacy paralelně, metrika `bound_share_pct`.
3. Payout routing flip per-coin (zion first, ext legs po attestaci).
4. Legacy sunset až bound_share > 95 % nebo 👤 rozhodnutí.

## 6. Bezpečnost

- Pool nikdy nevidí wallet SK — jen podpis challenge / on-chain důkaz.
- JWT krátký TTL (≤15 min) + JWKS rotace; api_key hash-only storage.
- Bound miner + cizí payout adresa = payout hold + alert (theft path).
- Audit: bind/unbind → `maestro`-style JSONL + ZIS audit tabulka.

## 7. Otevřené (👤/design rozhodnutí)

- Vyžadovat binding pro NOVÉ minery od data X? (policy)
- Multi-device claim (1 miner_id, N rigů) — worker sub-id jako teď.
- GDPR: DID ↔ payout address je doxxing surface — masked v public API.
- ZIS na EDGE je dual — binding write jen přes primary (single-writer).
