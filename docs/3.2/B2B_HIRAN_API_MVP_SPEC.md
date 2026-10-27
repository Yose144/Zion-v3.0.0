# Hiran API MVP — specifikace (B2B-3)

> **Zdroj:** `Zionb2b.md` §B2B-3 + `HIRAN-MARKETPLACE-PLAN.md` F2 · Draft 2026-10-28
> **Cíl:** OpenAI-kompatibilní placené inference API nad Hiran stackem — první MRR za 2–4 týdny.
> **Positioning:** „EU-hosted LLM" — GDPR / data sovereignty pro české/EU klienty, data neopouštějí EU.

---

## 1. Architektura

```
klient (X-API-Key)
  → EDGE2 nginx :443 api.zionterranova.com
  → hiran-gateway (nový service, :8007 loopback)
      ├─ auth:  ZIS POST /api/keys/verify  (zis_* key → user, cache 60s)
      ├─ meter: usage_records (SQLite/PG) — prompt+completion tokens per key
      └─ router: model alias → upstream chain
           ├─ hiran-mini    → ai-native :8001 → hiran-core :8002→PC:8070 (Vega64)
           │                              ↘ fallback EDGE2 :8002 llama.cpp CPU
           ├─ hiran-amitabha/issobella/maitreya → vast rig vLLM (on-demand deploy)
           └─ public modely (MODEL_CATALOG)     → vast rig vLLM :8000
```

**Proč samostatný service** a ne route v Next.js/ai-native: streaming +
metering + connection lifecycle patří do dedikovaného procesu; ai-native
zůstává interním RAG/chat orchestrem beze změn. Jazyk Rust (stejný stack,
reqwest + axum), ~800 LOC.

## 2. Veřejné API (OpenAI-compatible subset)

| Metoda | Cesta | Popis | MVP |
|---|---|---|---|
| GET | `/v1/models` | seznam dostupných aliasů + tier + ctx + $/1M tok | ✅ |
| POST | `/v1/chat/completions` | `messages`, `model`, `max_tokens`, `stream`, `temperature` | ✅ |
| POST | `/v1/completions` | jednoduchý text completion | ✅ (map na chat template) |
| GET | `/v1/usage` | vlastní — tokeny/eur per day pro přihlášený klíč | ✅ |
| POST | `/v1/embeddings` | embed tier | později (F3) |
| POST | `/v1/images` | — | ne |

**Model aliases (MVP):**

| Alias | Upstream | Pozn. |
|---|---|---|
| `hiran-mini` | hiran-core 8B Q5_K_M (Vega64) → EDGE2 CPU fallback | jediný always-on |
| `hiran-coder` | Qwen3-Coder-30B-A3B-FP8 na vast rigu | spin-up on demand |
| `qwen3-8b` | vast rig vLLM AWQ | veřejný model, euro-hosting |

Alias `hiran-mini` je **povinný do MVP** (je live dnes); vLLM tier se
připne, až fleet běží (vast fleet = 0 instancí = 👤 náklad — spec
navržena tak, aby bez fleet fungovala v single-model režimu).

## 3. Auth — ZIS API keys (hotové, žádný nový kód v ZIS)

- Klíč `zis_<48hex>` vytváří user přes `POST /api/keys` (login session),
  ukládá se jen SHA-256 hash (`apps/identity/src/routes/apikey.ts`).
- Gateway: `X-API-Key` → `POST /api/keys/verify` → `{valid, user}`.
  Endpoint je rate-limit 600/min (stavěný pro batch verify) — gateway
  cachuje `key→user` 60 s + invalidační 401 probublává.
- Klíč nesoucí scope: MVP = per-user tier flag v gateway DB
  (`users.plan: free|pro`), ne ZIS změna. Admin set přes gateway CLI.
- Rate limit per klíč: `free` 20 req/min + 200k tok/den, `pro` 120 req/min.
  Implementace = sliding window v paměti + persistovaný denní counter.

## 4. Metering → Stripe

- Každá odpověď → `usage_records(key_id, model, prompt_tok, completion_tok,
  upstream, latency_ms, ts)`. Streaming = počítat z SSE usage chunk /
  fallback tokenizer odhad (logovat `usage_estimated=true`).
- **Pricing:** `$/1M tok = gpu$/h ÷ (tok/s × 3600) × marže(3×)` —
  hiran-mini na Vega64 ≈ $0.40–0.80/1M tok orientačně; zaokrouhlit
  na ceníkové úrovně (viz §6).
- **Billing MVP (nejjednodušší fiat rail):** Stripe **metered
  subscription** — reuse MarketPlace Stripe infra (`STRIPE_SECRET`,
  webhook pattern z `apps/MarketPlace`). Price page =
  `market.zionterranova.com/ai` (nový produkt typu subscription).
  Webhook `invoice.paid` → `users.plan=pro`; `customer.subscription.
  deleted` → `free`. Usage report do Stripe 1×/den (billing meter).
- Alternativa prepaid credits — odložit; metered je méně kódu.

## 5. Spolehlivost / failover

- Per-alias upstream chain s timeouty (primární 90 s / fallback 180 s,
  stejná politika jako `RemoteHttpBackend::new_with_timeout`).
- `GET /v1/models` vrací jen **živé** aliasy (health probe cache 30 s) +
  pole `x-degraded: true` když běží CPU fallback (2.4 tok/s).
- Chyby mapovat na OpenAI error shape (`error.type:
  overloaded|invalid_request|server_error`); 503 jen když celá chain mrtvá.
- Probe `inference_live` do G8 (F4 z plánu) — součást MVP, 60 s interval.

## 6. Ceník (draft — k potvrzení 👤)

| Plan | Cena | Limity |
|---|---|---|
| Free | 0 € | `hiran-mini`, 20 req/min, 200k tok/den — top-of-funnel |
| Pro | 29 €/měs | všechny aliasy, 120 req/min, 5M tok/měs v ceně, pak 0,60 €/1M tok |
| Team | 99 €/měs | 5 klíčů, 25M tok/měs, SLA email | 

## 7. Bezpečnost / compliance (EU selling point)

- Žádné trénování na datech zákazníka — explicitní věta v ToS + ceníku.
- Request body se neukládá (jen token counts + model + latency); opt-in
  prompt logging pro debugging, default OFF.
- Klíče SHA-256 hashed (ZIS standard); audit log create/revoke/verify-fail.
- Abuse: `max_tokens` clamp 4096, prompt size cap 32k znaků, per-IP
  concurrency cap 8, násilný content není moderovaný v MVP — uvést v ToS.

## 8. Implementační checklist

| # | Krok | Soubor/provoz | Odhad |
|---|------|---------------|-------|
| 1 | `hiran-gateway` crate: axum, `/v1/models`, `/v1/chat/completions` proxy na hiran-core chain | `V31/L3/hiran-gateway/` (nový) | 1–2 dny |
| 2 | ZIS verify client + 60s cache + tier table (`gateway.db` SQLite) | stejné | 0,5 dne |
| 3 | Metering writer + `GET /v1/usage` | stejné | 0,5 dne |
| 4 | systemd `zion-hiran-gateway.service` na EDGE2 + nginx vhost `api.zionterranova.com` | `infra/nginx/edge2/` | 0,5 dne |
| 5 | Stripe: produkt+price v dashboardu, webhook route v gateway (reuse MarketPlace pattern) | MarketPlace infra | 0,5–1 dne |
| 6 | Price/console stránka `market.zionterranova.com/ai` (klíče = link na ZIS dashboard) | `apps/MarketPlace` | 1 den |
| 7 | G8 probe `inference_live` + alert | monitoring stack | 0,5 dne |
| 8 | Smoke E2E: key → request → usage → invoice item | runbook | 0,5 dne |

## 9. Explicitně MIMO MVP

- Settlement v ZION / NCL protocol fee (F3) — fiat first, ZION až po
  likviditě (§4 `Zionb2b.md`).
- Embeddings, images, fine-tune upload.
- Self-serve klíče bez ZIS účtu — klíč vždy za ZIS loginem (KYC-lite).
- Multi-region — single EDGE2; vast rigy jako backend, ne ingress.

## 10. Rizika

- **PC/Vega64 jako primární inference = SPOF pro `hiran-mini`** — CPU
  fallback drží dostupnost, ale degraded. Mitigace: jasně brandovat
  `x-degraded`, při delším výpadku přepnout default alias na vast vLLM.
- Vast fleet prázdná → vLLM aliasy nedostupné → MVP startuje single-model.
- Stripe metered = složitější dunning; pro 1. zákazníky stačí manuální
  invoice (první MRR nemusí být plně automatické).
