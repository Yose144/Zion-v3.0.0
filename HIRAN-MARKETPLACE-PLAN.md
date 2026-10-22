# HIRAN Marketplace — plán

> ZION vlastní modely (rodina **Hiran**) nabízené přes Marketplace na EDGE2
> (`127.0.0.1:3100`) a veřejný AI stack (`app.zionterranova.com/api/ai-chat`).
> Stav: **draft v2** — 2026-10-22. Souvisí: `infra/tools/vast/vastctl.py`
> `MODEL_CATALOG`, dashboard `/vast-rigs/` → AI tab.

---

## 1 · Modelová rodina (interní)

Pojmenováno podle korpus figurek. Všechny = GGUF buildy pro llama.cpp
(servíruje `hiran-core`, SMOS rig, EDGE2 CPU fallback).

| Alias | Model (GGUF) | Base | Role | Stav |
|---|---|---|---|---|
| `hiran-mini` | `hiran-v2.3mini-Q5_K_M` (8B, 5.5 GB) | Qwen3-8B + LoRA r32/α64 | core chat + RAG (39 docs/138 chunků) | **live** |
| `hiran-amitabha` | `hiran-amitabha-Q4_K_M` (14B, ~9 GB) | Qwen3-14B thinking | „Hlas" — deep reasoning, dlouhé odpovědi | mockup |
| `hiran-issobella` | `hiran-issobella-Q4_K_M` (30B MoE, ~19 GB) | Qwen3-Coder-30B-A3B | code + agentic tier | mockup |
| `hiran-maitreya` | `hiran-maitreya-Q5_K_M` (27B, ~20 GB) | gemma-4-31B / Qwen3.8-27B | teacher/oracle nad knižním korpusem | mockup |

Veřejný název značky = **Hiranyagarbha** (public copy nesmí obsahovat
interní verze/model id — viz `apps/website-v2.9/AGENTS.md` §2).

## 2 · Veřejné modely (vLLM fleet)

Kurátorský katalog — váhy se tahají z HuggingFace při deployi na rig.
Tiered podle VRAM; `latest_vllm` = pinned image v0.8.5 neumí arch →
auto-deploy posílá `vllm-openai:latest`.

| Tier | Modely |
|---|---|
| ≤10 GB (vedle těžby) | Qwen3-4B-Instruct-2507 · Qwen3-8B-AWQ · Qwen3-14B-AWQ · gemma-3-4b-it |
| 12–20 GB | gpt-oss-20b (MXFP4) · LFM2.5-8B-A1B · DeepSeek-R1-0528-Qwen3-8B · phi-4 |
| 24–48 GB | Qwen3-32B-AWQ · Qwen3-Coder-30B-A3B-FP8 · Devstral-Small-2 |
| 48 GB+ | Qwen3.8-27B · gemma-4-31B-it · GLM-4.7-Flash |

## 3 · Topologie servírování (live)

```
app/api/ai-chat → EDGE2 ai-native :8001
  ├─ primární:  :8004 → Edge :8002 → PC :8070 hiran-core (Vega64 Vulkan)
  ├─ fallback:  EDGE2 :8002 llama.cpp CPU (2.4 tok/s)
  └─ SMOS rig:  Edge :8003 llama.cpp (OFFLINE — rig 518837 down)
vast-rigs/ AI tab → vastctl-serve :8088 → rig SSH / Edge :8003
```

## 4 · Roadmapa

- **F1 — katalog v UI** *(dnes)*: veřejné + interní sekce, fits badge,
  HF search, auto-deploy/auto-chat router. ✅
- **F2 — gateway**: jednotný `GET /v1/models` na Edge agregující
  hiran-core + SMOS + Vast vLLM; alias router (`model=hiran-mini` →
  backend); API klíč + rate limit jako pool API :8080.
- **F3 — Marketplace listing**: položka per model-alias (params, ctx,
  $/1M tok z `gpu$/h ÷ tok/s × marže`, live dostupnost z
  `model_endpoints()`, trial chat widget). Settlement ZION/L2, dry-run.
- **F4 — provoz**: `inference_live` do G8 probe; fallback chain
  hiran-core → EDGE2 CPU → Vast; uptime badge z `ai_status` historie;
  GGUF fine-tune pipeline (LoRA → merge → quant Q4_K_M/Q5_K_M → eval).

## 5 · Otevřené body

- [ ] Licence: interní-only vs veřejný GGUF release pod `zion-terranova`
      HF org
- [ ] Data pro fine-tune: korpus knih (Maitreya/Nirvana/Ekam) + faq —
      kolik lze legálně publikovat v trénovacím setu
- [ ] SMOS rig 518837: opravit a vrátit do rotace, nebo retirement
- [ ] Marketplace = přímý prodej inference vs "Hiran inside" badge
- [ ] vLLM default image bump po smoke-testu nového tagu

## 6 · Rizika

- VRAM contention mining↔inference (duty scheduler, `fits` badge)
- gated HF modely bez tokenu = deploy 401 (katalog označuje)
- `latest` vLLM image pro new-gen modely je floating — po validaci
  pinnout konkrétní tag
