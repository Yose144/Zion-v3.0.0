# ZIS ↔ Pool: miner identity & payout routing (design — 9.B/3.B follow-up)

> Stav: **ČÁSTEČNĚ IMPLEMENTOVÁNO** (aktualizace 2026-10-28 večer).
> Fáze C (stratum auth + payout fallback) už běžela v produkci:
> `ZION_POOL_ZIS_AUTH=optional` + `ZION_POOL_ZIS_URL` + service key na
> EDGE; `zis.rs` verifier (pos/neg cache, ban list, linked addrs),
> auth_token v Hello na plain+TLS, `zis_register_linked_payout` fallback,
> account API `/public/v1/account/*` s `owns()` gatem, Welcome `zis_user`.
> **Nově doplněno:** schema v12 `miner_zis_bindings` (persist binding při
> každém úspěšném ZIS loginu napříč dialekty v1/qtu/pearl/v3-plain/v3-TLS),
> `GET /public/v1/miner/{coin}/{wallet}/identity` (`{bound, zis_user:masked,
> bound_since}` — DID jen maskovaný), metrika `zion_pool_zis_bound_miners`.
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

## 5. Migrace — realita vs. plán

1. ✅ Stratum auth + payout fallback: live (`optional` mód).
2. ✅ Persist + observability (28.10): v12 binding tabulka, identity
   endpoint, adoption gauge `zion_pool_zis_bound_miners` — nasadit s
   příštím pool buildem.
3. ⏳ Claim/bind UX: ZIS `wallet` routes (`linkedAddresses`) existují —
   chybí miner-facing „propojit payout adresu" flow v UI (Miner dashboard
   / wallet-sdk) + explicit `bind` endpoint, pokud stačit linked addrs.
4. ⏳ Payout routing precedence: dnes ZIS fallback jen když hello address
   prázdná — bound-override (bound miner → jeho ZIS adresa vyhrává) je
   fáze 3, potřebuje design rozhodnutí (hold-on-conflict vs prefer-bound).
5. ⏳ Adoption gate: `zion_pool_zis_bound_miners` sledovat → optional→
   required flip / legacy sunset = 👤.

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
