# Hiran CLI ↔ ZIS ↔ Marketplace — auth & platby

> Kanonické propojení B2B-3 / B2B-3b (2026-10-29).  
> Operativní secrets: [`docs/3.2/B2B_HIRAN_SECRETS.md`](docs/3.2/B2B_HIRAN_SECRETS.md) · Agent CLI: [`docs/3.2/B2B_HIRAN_AGENT_CLI.md`](docs/3.2/B2B_HIRAN_AGENT_CLI.md).  
> Vast coding sjednocení (`#ai` + fleet): [`docs/3.2/VAST_HIRAN_CODING_AGENT_PLAN.md`](docs/3.2/VAST_HIRAN_CODING_AGENT_PLAN.md).

## 1. Hosty a role

| Host / cesta | Role |
|---|---|
| `https://auth.zionterranova.com` | **ZIS** — session cookie `zion_session`, SIWE/MetaMask login, `POST /api/keys`, `POST /api/keys/verify` |
| `https://market.zionterranova.com` | **MarketPlace** — `/ai` pricing, `/ai/cli` device approve, Stripe + crypto intent |
| `https://market.zionterranova.com/v1` | **Hiran gateway** (nginx → EDGE2) — OpenAI `/models`, `/chat/completions`, `/usage`, admin plan |
| Local `zion` CLI | `~/.zion/agent.toml` + env `ZION_HIRAN_API_KEY` |

```
CLI ──device-code──► MarketPlace ──cookie──► ZIS (mint zis_*)
 CLI ◄──apiKey once── MarketPlace
 CLI ──X-API-Key──► Gateway ──verify──► ZIS
 CLI/Web ──Stripe or Base USDC──► plan sync ──► Gateway meter
```

## 2. Dvě identity

1. **Browser session** — httpOnly cookie `zion_session` (domain `.zionterranova.com`). MarketPlace volá ZIS s cookie (`createMarketApiKey`).
2. **API key** — raw `zis_<48hex>` (ukázán jednou). Gateway a CLI posílají `X-API-Key` / `Authorization: Bearer`. ZIS i gateway ukládají jen **SHA-256** hashe.

## 3. CLI login (device-code)

```bash
zion hiran login          # browser → Approve → zapisuje ~/.zion/agent.toml
zion hiran logout         # smaže api_key z toml
zion hiran whoami         # GET /v1/usage → plan + limity
zion hiran subscribe --plan pro --pay stripe
zion hiran subscribe --plan pro --pay crypto   # otevře /ai?pay=crypto
```

### MarketPlace API

| Method | Path | Auth | Účel |
|---|---|---|---|
| `POST` | `/api/hiran/cli/start` | public | `{ device_code, user_code, verify_url, expires_in }` |
| `GET` | `/api/hiran/cli/poll?device_code=` | public | `pending` / `expired` / `approved` + `apiKey` (jednou) |
| `POST` | `/api/hiran/cli/approve` | ZIS session | body `{ user_code }` → mint `hiran-cli` key |

TTL device kódu: **10 minut**. Store: soubor (`HIRAN_CLI_STORE_PATH`, default pod `os.tmpdir`).

Web UI: `https://market.zionterranova.com/ai/cli?code=ABCD-1234`

## 4. Subscribe / platby

### Stripe (fiat)

- `POST /api/stripe/hiran-subscribe` — session **nebo** `X-API-Key` (upgrade stávajícího CLI klíče bez mintu nového).
- Metadata `key_hash` → gateway `POST /v1/stripe/webhook` → `set_plan`.
- Env: `HIRAN_PRICE_PRO_ID`, `HIRAN_PRICE_TEAM_ID`, `STRIPE_*` (viz secrets doc).

### MetaMask (Base USDC)

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/hiran/crypto/intent` | session nebo `X-API-Key` |
| `POST` | `/api/hiran/crypto/confirm` | session nebo `X-API-Key` + `txHash` |

Intent vrátí `{ amount, token, chainId, to, reference, key_hash, plan }`.  
UI na `/ai` (Pay with MetaMask) pošle USDC `transfer` na treasury.  
Confirm ověří tx na Base RPC a zavolá gateway:

```
POST https://market.zionterranova.com/v1/admin/plan
X-Admin-Key: $HIRAN_ADMIN_KEY
{ "key": "<64-hex key_hash>", "plan": "pro"|"team" }
```

Env (MarketPlace + gateway):

| Var | Význam |
|---|---|
| `HIRAN_ADMIN_KEY` | gateway admin (hashuje se) |
| `HIRAN_GATEWAY_ADMIN_URL` | default `https://market.zionterranova.com/v1/admin/plan` |
| `HIRAN_TREASURY_ADDRESS` | Base příjemce USDC |
| `HIRAN_USDC_ADDRESS` | default Base native USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| `HIRAN_USDC_PRO` / `HIRAN_USDC_TEAM` | atomic units (6 decimals), např. `29000000` = 29 USDC |

## 5. Gateway kontrakt (beze změny auth)

- `GET /v1/models` — public  
- `GET /v1/usage` — key → `{ plan, limits, used_today, days }`  
- `POST /v1/chat/completions` — metered  
- `POST /v1/admin/plan` — `X-Admin-Key`  
- `POST /v1/stripe/webhook` — Stripe signature  

## 6. CLI config

`~/.zion/agent.toml`:

```toml
api_key = "zis_…"
base_url = "https://market.zionterranova.com/v1"
model = "hiran-mini"
```

Override: `ZION_HIRAN_API_KEY`, `ZION_HIRAN_BASE_URL`, `ZION_HIRAN_MODEL`, `ZION_MARKET_URL` (device-code host, default market apex).

## 7. Model aliases (F1 fabric)

| Alias | Stav | Pozn. |
|---|---|---|
| `hiran-mini` | **live** | free tier; PC `:8004` → EDGE2 CPU `:8002` |
| `hiran-coder` | až live upstream `:8005` | rewrite → `qwen2.5-coder-7b-instruct`; Pro |
| `hiran-amitabha` / `issobella` / `maitreya` | **mockup** | Trinity FT; chat → 503 |

Remote coding na vast (F2/F3): fleet `code.run` — viz
[`docs/3.2/VAST_HIRAN_CODING_AGENT_PLAN.md`](docs/3.2/VAST_HIRAN_CODING_AGENT_PLAN.md).

```bash
# local tools (Hiran gateway / zis_*)
zion agent -p "…"
# remote fleet (ops VASTCTL_AGENT_TOKEN — not zis_*)
zion hiran agent -p "…" --remote vast [--rig ID]
```

## 8. Smoke

```bash
zion hiran models   # očekávej mini + trinity mockupy; coder až po :8005
zion hiran login
zion hiran whoami
zion hiran subscribe --plan pro --pay stripe
# nebo: otevřít /ai?plan=pro&pay=crypto po login
zion agent -p "…"
# po enroll rigu:
zion hiran agent -p "pwd && ls" --remote vast
```

## 9. Související kód

- CLI: `V31/cli/src/commands/hiran.rs`, `V31/cli/src/agent/`
- Market: `apps/MarketPlace/src/app/api/hiran/**`, `apps/MarketPlace/src/app/ai/cli/`
- Gateway: `V31/L3/hiran-gateway/` (+ `models.example.json`)
- Fleet coding: `infra/tools/vast/agent.py`, `code_run.py`, `zion-coder-job.sh`
- ZIS keys: `apps/identity/src/routes/apikey.ts`
