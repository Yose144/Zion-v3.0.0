# Hiran API — MVP Specifikace

> Cíl: prodej LLM inference jako služby — OpenAI-kompatibilní API gated přes
> ZIS API klíče + Stripe subscription. Fiat revenue z existující
> infrastruktury, žádný nový blockchain kód.
>
> Task: `#4` z `Zionb2b.md` — "Hiran API subscription".
> Datum: 2026-10-27 · Autor: autonomní práce (Devin)

---

## 1. Co už existuje (stavební kameny)

| Komponenta | Stav | Kam |
|---|---|---|
| `zion-ai-native-api` (axum) | produkce | EDGE2 `:8001` (`HIRANYAGARBHA_BIND`) |
| LLM backend | produkce | llama.cpp `hiran-v2.3mini-Q5_K_M` (Qwen3-8B + LoRA r32/α64) na operátorském PC (Vega 64) přes SSH tunel; `LLM_BASE_URL` → `127.0.0.1:8004/v1` |
| CPU fallback | produkce | llama.cpp CPU na EDGE2 `:8002/v1` (tentýž GGUF, ~2.4 tok/s) |
| RAG + konstituce | produkce | 39 kurátorovaných docs / 138 chunků, BM25; systémový prompt = fee split 89/5/5/1, 1 ZION = 1e6 flowers |
| Public free chat | produkce | `app.zionterranova.com/api/ai-chat` → ai-native `/chat` |
| ZIS API keys | produkce | `POST {zis}/api/keys/verify` (`{apiKey}` → user); ref impl `V31/L1/pool/src/zis.rs` (`ZisKeyClient`, pos/neg cache) |
| Stripe | produkce | MarketPlace checkout + webhook + faktury (`/api/stripe/*`) |
| OpenAI-compat výstup | produkce | llama.cpp samotné už mluví `/v1/chat/completions` nativně |

**Klíčový poznatek:** llama.cpp už JE OpenAI-kompatibilní server. MVP
gateway je tedy **tenký auth+metering proxy**, ne nový inference engine.

## 2. MVP scope

### 2.1 Veřejné endpointy (na `app.zionterranova.com`)

```
GET  /api/hiran/v1/models              → OpenAI model list (auth)
POST /api/hiran/v1/chat/completions    → OpenAI chat completions (auth+meter)
GET  /api/hiran/pricing                → veřejná pricing page (HTML)
POST /api/hiran/checkout               → Stripe Checkout session (ZIS session)
POST /api/hiran/webhook                → Stripe webhook (subscription lifecycle)
GET  /api/hiran/v1/usage               → per-key usage tento měsíc (auth)
```

OpenAI-compat kontrakt (subset, stačí pro `openai` SDK):

```jsonc
// GET /v1/models
{ "object": "list", "data": [
  { "id": "hiran-mini", "object": "model", "owned_by": "zion",
    "created": 1761177600 }
]}

// POST /v1/chat/completions — přijímá standardní OpenAI body,
// forwarduje na LLM_BASE_URL/chat/completions, vrací verbatim
// + header "x-zion-request-id", "x-zion-quota-remaining"
```

**Model map:** `hiran-mini` → fyzický GGUF alias (`hiran-core`) v llama.cpp.
Jeden model v MVP. `/v1/completions` a `/v1/embeddings` zatím NE (llama.cpp
je umí, ale nemáme poptávku — feature flag, ne delete).

### 2.2 Auth — ZIS key gate

```
Authorization: Bearer zis_<api_key>
```

1. `zis_<key>` → `POST {ZIS_URL}/api/keys/verify` `{apiKey}` → `{sub, active}`
2. Cache: positive 60 s, negative 60 s (pattern z `ZisKeyClient`)
3. `active=false` / 401 → OpenAI-style error:
   `{ "error": { "type": "invalid_api_key", "message": "…" } }` HTTP 401
4. Klíč vázaný na `sub` (ZIS user) → lookup entitlements níže

### 2.3 Entitlement + kvóty (nový malý state)

Stripe subscription `sub` ↔ ZIS `sub` (user). Tabulka entitlementu —
**nejpragmatičtější úložiště v MVP = MarketPlace Postgres** (už tam žije
Stripe webhook infra + Prisma):

```prisma
model HiranEntitlement {
  id            String   @id @default(cuid())
  zisSub        String   @unique        // ZIS user id (z keys/verify)
  stripeCustomer String?                // cus_…
  stripeSubId    String?  @unique       // sub_…
  tier          String   @default("free") // free | dev | pro
  status        String   @default("active") // active | past_due | canceled
  monthlyTokens BigInt   @default(0)    // quota per tier
  tokensUsed    BigInt   @default(0)    // rolling month counter
  periodEnd     DateTime?
  updatedAt     DateTime @updatedAt
}
```

Tiers:

| Tier | Cena | Kvóta | Pozn. |
|---|---|---|---|
| **free** | 0 Kč | 50 000 tok/měs | každý aktivní ZIS klíč, rate 5 req/min |
| **dev** | 199 Kč/měs | 2 000 000 tok/měs | rate 30 req/min |
| **pro** | 990 Kč/měs | 20 000 000 tok/měs | rate 120 req/min, priorita na GPU backend |

Free tier = prodejní kanál (kdo má ZIS účet, okamžitě zkouší API).

### 2.4 Metering

- Před forwardem: `tokensUsed + est_prompt_tokens <= monthlyTokens` → jinak
  `429 { "error": { "type": "quota_exceeded" } }` s `x-zion-quota-reset`
- Po odpovědi: `usage.total_tokens` z llama.cpp response →
  `UPDATE HiranEntitlement SET tokensUsed += N` (atomický increment,
  best-effort — ne blokovat response; chybějící měření akceptovatelné v MVP)
- Reset: `tokensUsed=0` při `periodEnd` rollover (lazy — při prvním requestu
  po periodEnd)
- Non-stream MVP: `stream:true` → `400` ("streaming not yet supported")
  nebo upstream streaming bez metering — **rozhodnout: MVP odpovídá
  `stream:false` jen, stream → 400.** Metering se počítá z `usage` pole,
  které stream chunk nemá.

### 2.5 Stripe lifecycle (znovupoužití MarketPlace infra)

```
checkout:  /api/hiran/checkout {tier, zisSub} → Stripe Checkout Session
           success_url=/api/hiran/pricing?welcome=1
webhook:   checkout.session.completed → entitlement.tier=tier, status=active
           customer.subscription.updated → sync tier/status/periodEnd
           customer.subscription.deleted → tier=free, status=canceled
           invoice.payment_failed → status=past_due (7d grace → free)
```

Stripe produkty: `hiran-dev` (199 CZK/mo), `hiran-pro` (990 CZK/mo) —
vytvořit v Stripe dashboardu, `price_…` id do env.

### 2.6 Pricing page (`/api/hiran/pricing` nebo `/hiran` na webu)

Veřejná stránka — 3 karty (Free/Dev/Pro), CTA → ZIS login → checkout.
Copy CS+EN, "EU-hosted LLM · data neopouští EU · Žádný US cloud" jako
hlavní selling point (GDPR/sovereignty úhel pro české/EU B2B).

## 3. Umístění kódu

| Soubor | Účel |
|---|---|
| `apps/website-v2.9/src/app/api/hiran/v1/models/route.ts` | model list |
| `apps/website-v2.9/src/app/api/hiran/v1/chat/completions/route.ts` | proxy + meter |
| `apps/website-v2.9/src/app/api/hiran/v1/usage/route.ts` | usage readout |
| `apps/website-v2.9/src/app/api/hiran/checkout/route.ts` | Stripe session |
| `apps/website-v2.9/src/app/api/hiran/webhook/route.ts` | Stripe webhook |
| `apps/website-v2.9/src/app/api/hiran/pricing/page.tsx` (nebo `/hiran`) | pricing page |
| `apps/website-v2.9/src/lib/hiran-api.ts` | ZIS verify client + entitlement lookup + metering helpers |
| `apps/MarketPlace/prisma/schema.prisma` | `HiranEntitlement` model (sdílená DB) — **nebo** vlastní SQLite, viz §6 |

## 4. Request flow

```
client ──► POST app.zionterranova.com/api/hiran/v1/chat/completions
           │ Authorization: Bearer zis_…
           ▼
        [1] parse key → ZIS keys/verify (cache)        ──► 401
        [2] entitlement lookup (HiranEntitlement.zisSub)──► 402 tier
        [3] quota check (tokensUsed < monthlyTokens)    ──► 429
        [4] rate limit (per-sub token bucket)           ──► 429
        [5] forward → LLM_BASE_URL /v1/chat/completions
            (llama.cpp → Vega64 GPU | CPU fallback)
        [6] response → meter tokensUsed += usage.total_tokens
           ◄── OpenAI body + x-zion-* headers
```

## 5. Security & abuse

- Klíč jen v `Authorization` headeru; nikdy v URL/logu (log `sha256(key)[:8]`)
- ZIS verify POST s interním `serviceKey` (env `ZIS_SERVICE_KEY`)
- Rate limit per-sub (token bucket v paměti; 2nd layer per-IP)
- `max_tokens` clamp podle tieru (free ≤ 512, dev ≤ 2048, pro ≤ 8192)
- Prompt size cap (free 8 KB, pro 64 KB)
- Stripe webhook signature verify (`STRIPE_WEBHOOK_SECRET`)
- Endpoint `/v1/chat/completions` odpovídá OpenAI errorem, ne interním stavem

## 6. Otevřená rozhodnutí

| # | Otázka | Doporučení |
|---|---|---|
| 6.1 | Kde žije `HiranEntitlement`? | **MarketPlace Postgres** — Stripe webhook tam už je; jedna DB, jeden Prisma. Alternativa: SQLite na EDGE2 (izolace, ale druhý billing stack). |
| 6.2 | Vlastní API klíče místo ZIS? | MVP = ZIS klíče (existují). Později vlastní `hiran_…` klíče s vlastní tabulkou — větší kontrola, nezávislost na ZIS uptime. |
| 6.3 | Streaming? | MVP bez (`stream:false` only). Stream přidat ve v1.1 (SSE passthrough + meter z `usage` v posledním chunku nebo odhad tokenizerem). |
| 6.4 | Failover metering? | CPU fallback pomalejší → stejné kvóty, jiný `x-zion-backend` header (`gpu`/`cpu-fallback`) pro transparentnost. |
| 6.5 | Víc modelů? | MVP `hiran-mini` only. v1.1: větší model přes vLLM na vast.ai rigu (katalog už existuje), tier `pro` → přístup k `hiran-xl`. |
| 6.6 | GDPR/fakturace | Faktury přes existující `invoice.ts` (MarketPlace); Stripe zákazník = e-mail ze ZIS profilu. |

## 7. Implementační kroky (pořadí)

1. **Prisma model + migrace** `HiranEntitlement` v MarketPlace DB
2. **`hiran-api.ts`** — ZIS verify (cache), entitlement CRUD, metering
3. **`/v1/models` + `/v1/chat/completions`** routes (proxy + gate + meter)
4. **Stripe**: 2 produkty + webhook routes + checkout route
5. **Pricing page** CS+EN + link z `/l3-hiran`
6. **Smoke**: `curl -H "Authorization: Bearer $ZIS_KEY" …/v1/models`
7. **Rate limit + quota edge testy** (429 paths)
8. Deploy `deploy-web2.9.sh` + MarketPlace (webhook tam žije)

## 8. Metriky úspěchu

- Time-to-first-token free tier: < 24 h od ZIS registrace
- První `dev`/`pro` subscription do 14 dní od launch
- p95 latency `/v1/chat/completions` < 30 s (CPU fallback ≤ 60 s)
- Quota overage → 429, ne silent fail
- `x-zion-backend` mix: ≥ 70 % `gpu` (Vega), zbytek `cpu-fallback`

## 9. Co MVP NEDĚLÁ (explicitně)

- Žádné ZION-token platby (fiat-first; token billing až po likviditě)
- Žádné jemné per-model pricing (1 model, 3 flat tiers)
- Žádný NCL marketplace plug-in (NCL = distribuce jobů, Hiran API =
  inference endpoint — dvě různé věci, nepleteme v MVP)
- Žádné fine-tuning/upload corpus endpointy (RAG korpus je interní)
