# Report — Hiran workflow E2E (2026-10-29)

Kanon cesty po uzavření provozu: user chat i remote coding jdou přes Hiran gateway
(`zis_*` / krátký `hiran_lease_*`). Lokální OpenAI stub na rigu `:8000` je fallback,
ne definice produktu. FT Trinity a vLLM na rigu se v tomhle okně nedělaly.

## Co prošlo

| Krok | Důkaz |
|---|---|
| Public `hiran-coder` | `POST market…/v1/chat/completions` → `WORKFLOW_OK` (HTTP 200) |
| Lease | `POST /v1/agent/lease` → `hiran_lease_*` (900 s, 4 turns, plan free) |
| Remote `code.run` | rig `58077390`, rc=0, text `REMOTE_METER_OK` |
| Metering | `GET /v1/usage`: 1→2 požadavky, 42→575 tokenů, plan free |
| Návrat na mini | `use-hiran.sh`; public `hiran-mini` live, `hiran-coder` `x-available:false` |
| Sync agenta | `bootstrap-agent.sh 58077390 --sync-only`; heartbeat age pod 10 s |

## Co se muselo opravit po cestě

1. **ZIS `DATABASE_URL`.** Identity `.env` mělo jiné heslo než `/opt/zion/shared/.env`
   a MarketPlace. Verify padalo 500. Heslo role `zion` + identity env sjednoceny
   se shared URL, `zion-zis` restart.
2. **Stale `code_run.py` na rigu.** První metered enqueue vrátil 401 — starý worker
   nečetl `lease_token`. Po nahrání aktuálního souboru a restartu tmux `vast-agent`
   druhý běh prošel. Trvalá cesta: `bootstrap-agent.sh <id> --sync-only`.

## GPU

GTX 1070 Ti unese jeden llama.cpp CUDA proces. Produkce = `zion-hiran-cuda` `:8071`.
Coder `:8072` + reverse tunnel EDGE2 `:8005` jen přes `use-coder.sh`.

## Záměrně ne

- FT / QLoRA Trinity
- vLLM nebo GGUF na rigu (Docker na image chybí; produktový LLM je gateway)
- nový Vast rent
- public CLI packaging
