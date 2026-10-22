# HIRAN Marketplace — plan

> ZION vlastní modely (Hiran) nabízené přes Marketplace servisu na EDGE2
> (`127.0.0.1:3100`, veřejně `zionterranova.com` sekce marketplace).
> Stav: **draft** — vygenerováno 2026-10-22.

## Cíl

Z nasazené inference vrstvy (hiran-core na operátorském PC + SMOS rig
llama.cpp + Vast vLLM) udělat **produkt**: katalog modelů pod značkou
Hiran, servírovaný přes OpenAI-compatible API, proplacený přes ZION.

## Co už existuje (infra)

| Kus | Stav |
|---|---|
| `hiran-core.service` (PC, RX Vega 64, llama.cpp Vulkan) | běží — `hiran-v2.3mini-Q5_K_M`, PC `:8070` → Edge `:8002` → EDGE2 `:8004` |
| `zion-hiran-inference.service` (EDGE2 CPU fallback) | běží — `LLM_FALLBACK_URL=127.0.0.1:8002/v1`, ~2.4 tok/s |
| SMOS rig 518837 llama.cpp (`Qwen3-4B-Q4_K_M`, :8003 → Edge) | **offline** — reverse tunnel nahoře až rig zapne |
| Dashboard AI tab (`/vast-rigs/`) | status + chat + multi-model router + katalog |
| `zion-v31-ai-native` (EDGE2 :8001) | Maestro v2.4, BM25 RAG 39 docs, konstituční prompt |
| Marketplace service (EDGE2 :3100) | běží — bez AI sekce |

## Roadmapa

### F1 — Vnitřní katalog (tento sprint, část hotová)

- [x] `MODEL_CATALOG` v `vastctl.py` — veřejné modely (Qwen3, gpt-oss-20b,
      Devstral 2, Qwen3-Coder-30B, GLM-4.7, Gemma 4, Phi-4, LFM2.5)
- [x] Hiran položky `internal: true` — `zion/hiran-v2.3mini-Q5_K_M` (live),
      `zion/hiran-v3-coder-Q4_K_M` (mockup)
- [x] `/vast-ops/api/inference/catalog` — catalog JSON pro frontend
- [ ] catalog karta: Hiran položky zlaté `ZION` badge, bez vLLM deploy
      (llama.cpp serving), link → interní docs místo HF

### F2 — Jediný gateway (OpenAI-compatible)

- `GET /v1/models` na Edge — agregace zařízení: hiran-core (PC), SMOS
  llama.cpp, Vast vLLM rigy → jednotný `model=id` router (backend už má
  `model_endpoints()` + `auto-chat` — přenést do trvalé služby)
- Model naming: `hiran-mini` → v2.3mini, `hiran-code` → v3-coder,
  `hiran-max` → největší veřejný model na aktuálním rigu
- Rate limit + API klíč pro externí uživatele (stejný mechanismus jako
  pool API na Edge :8080)

### F3 — Marketplace listing

- Marketplace položka per model: název, params, quant, kontext,
  `$ / 1M tok`, dostupnost (live z `model_endpoints()`), trial chat widget
- Cenotvorba: `cost = gpu_usd_per_hour / (tok_per_sec × 3600) × 1e6 × margin`
  — např. RTX 3060 $0.073/h, ~40 tok/s Q4 4B → ~$0.0005/1K tok raw;
  prodáváme s marží (cca $0.10–0.50/1M tok na malých modelech)
- Platba: ZION interní settlement (pool balance → marketplace credit)
  nebo L2 invoice; dry-run flag jako u PRL payouts

### F4 — SLA a monitoring

- Endpoint health do G8 probe (`chain_live` pattern) — `inference_live`
- Fallback řetězec: hiran-core → EDGE2 CPU → (Vast rig vLLM)
- Uptime badge v marketplace položce z `ai_status` historie

## Rozhodnutí k prodiskutování

- [ ] Hiran v2.3mini licence — interní only nebo veřejný release (GGUF na
      HF pod `zion-terranova` org?)
- [ ] Kdo nese přesný `gguf` pipeline: fine-tune skripty, eval harness,
      version tagging (`hiran-vX.Y`)
- [ ] Marketplace = přímý prodej inference, nebo jen "Hiran inside" badge
      u existujících položek
- [ ] SMOS rig 518837 obnovit (offline 15h+) nebo inference plně přenést
      na PC + EDGE2 fallback — rozhoduje latenci a kapacitu

## Rizika

- **vLLM image verze**: pinned `v0.8.5` neumí gpt-oss/Devstral2/GLM-4.7/
  Qwen3.8 — auto-deploy pro ně posílá `vllm-openai:latest` (`latest_vllm`
  flag v katalogu). Dlouhodobě: bumpnout default image po smoke-testu.
- **VRAM contention**: těžba + inference na jedné GPU — `fits` badge v
  katalogu počítá live free VRAM; <60% VRAM target doporučeno při miningu.
- **Gated modely** (gemma/llama rodiny) vyžadují HF token na rigu —
  katalog je označuje, deploy bez tokenu selže s 401 z HF.
