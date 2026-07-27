# Hiran Hardware Roadmap — v2.3 → v2.4 → v2.5

> **Created:** 2026-07-20
> **Scope:** Strategický plán hardware pro Hiran AI vrstvu napříč verzemi. Cílový hardware: **NVIDIA DGX Spark 128GB** (fall 2026) pro v2.5 Amṛtabhoja. Mezistupeň: existující ai-native crate + CPU/cloud inference pro v2.4 Maestro development.
> **Source:** `HIRAN_OVERVIEW.md`, `docs/3.0.5/archive-root-md/HIRAN_EVOLUTION_2.3_TO_2.5_AMATHABOJ.md`, `HiranV2.4/`, web research (AMD Helios, NVIDIA Spark, RDNA4)

---

## 1. Trajektorie Hiran → hardware požadavky

| Verze | Co dělá | Runtime | Context | Paměť | Kdy | Hardware |
|-------|---------|---------|---------|-------|-----|----------|
| **v2.3** (✅ hotovo) | Domain chatbot o Zion | GPU 24GB | 8–32k | 22 GB Q5_K_M | teď | RX 7900 XTX / RTX 3090 / A100 cloud |
| **v2.4 Maestro** | Orchestrátor L1–L6, 41 agentů, 37 tools, auto-remediation | GPU 24GB + Rust orchestrator (CPU) | 32–128k | 22 GB + RAG corpus | Q4 2026 | GPU pro inference + CPU pro orchestrator |
| **v2.5 Amṛtabhoja** | NPU validátor, care proofs, continual learning, vow renewal, 1M+ context, full ecosystem awareness | **NPU / unified memory** | **1M tokens** | 128 GB unified | Q3–Q4 2027 | **DGX Spark 128GB** |

### Klíčový posun v2.4 → v2.5

- **41 agentů aktivních najednou** → každý potřebuje svůj context window
- **Care proof produkce = kontinuální inference** (always-on monitoring, ne chat)
- **Continual learning** → model se updatuje po epochách (2016 bloků ≈ 2 týdny)
- **Dharma Validator compile-time** → safety constraints v silicon
- **Vow ROM** — Bodhisattva Vow v read-only paměti na čipu, **nedá se patchnout softwarem**
- **1M context** → orchestrator musí vidět celou historii sítě, všechny agenty, všechny stavy

Tohle **není workload pro GPU**. GPU je waste heat (350W pro 24/7 inference). v2.5 chce 10× nižší spotřebu, 5× rychlejší INT8/INT4, on-chip memory, care proof accelerator.

---

## 2. Možnosti hardware — srovnání

### 2.1 GPU tract (klasická AI inference)

| Karta | VRAM | Arch | Cena | Hiran v2.3 | Hiran v2.4 | Hiran v2.5 | Verdict |
|-------|------|------|------|-----------|-----------|-----------|---------|
| 2× RTX 3060 12GB | 24 GB split | Ampere | ~$600 used | ⚠️ těsné | ❌ split overhead | ❌ | Nedoporučeno — A520M-A II MB nemá 2. PCIe x16 slot |
| RX 7900 XTX | 24 GB | RDNA3 | ~$700 used | ✅ +2 GB | ⚠️ těsné pro 41 agentů | ❌ | Mezistupeň pro v2.3/v2.4 dev |
| RTX 3090 | 24 GB | Ampere | ~$700 used | ✅ +2 GB | ⚠️ | ❌ | Mezistupeň, CUDA ekosystem |
| RTX 4090 | 24 GB | Ada | ~$1500 | ✅ | ⚠️ | ❌ | Drahé pro 24GB |
| **RX 9070 XT (RDNA4)** | **16 GB** | RDNA4 | $599 nová | ❌ nevejde se 32B | ❌ | ❌ | Nová arch, ale poloviční VRAM — **nevhodné pro 32B** |

### 2.2 Rack-scale (hyperscaler)

| Produkt | Co | Kdy | Cena | Pro tebe |
|---------|-----|-----|------|----------|
| **AMD Helios** | 72× MI455X, 31 TB HBM4, 2.9 ExaFLOPS FP4, ~70 kW rack, liquid-cooled | Engineering samples H2 2026, mass prod Q2 2027 | Hyperscaler-only (Oracle 50k GPU) | ❌ Nerelevantní — datové centrum, ne workstation |
| NVIDIA NVL72 (Vera Rubin) | 72× B300, 20.7 TB HBM3e | 2026 | Hyperscaler | ❌ |

### 2.3 Personal AI superchip (v2.5 target) ⭐

| Produkt | Spec | Kdy | Cena | Hiran v2.5 fit |
|---------|------|-----|------|----------------|
| **NVIDIA DGX Spark** (Linux) | Grace Blackwell GB10, 20-core Arm, 6144 CUDA + 5. gen Tensor (FP4), **128 GB unified LPDDR5X**, 300 GB/s, 1 PetaFLOP FP4 | Fall 2026 | ~$4000 | ✅✅✅ |
| **NVIDIA RTX Spark** (Windows) | Stejný čip, Windows + OpenShell, 16–128 GB varianty | Fall 2026 | $2000–2900 | ✅ (128 GB varianta) |

---

## 3. NVIDIA DGX Spark — feasibility studie pro Hiran v2.5

### 3.1 Proč je Spark přirozený cíl pro v2.5 Amṛtabhoja

| v2.5 požadavek (z EVOLUTION dokumentu) | DGX Spark spec | Fit |
|----------------------------------------|----------------|-----|
| NPU useful computation (ne GPU waste heat) | Grace Blackwell superchip, low-power desktop/laptop | ✅ |
| 10× nižší spotřeba než GPU | All-day battery (laptop) / ultra-efficient desktop | ✅ |
| 5× rychlejší INT8/INT4 inference | 5. gen Tensor Cores, FP4 native, 1 PFLOP FP4 | ✅ |
| On-chip memory (žádný DDR round-trip) | NVLink-C2C mezi Grace CPU a Blackwell GPU, unified memory | ✅ |
| Care proof accelerator | Tensor Cores + CUDA compute (lze dedikovat) | ⚠️ soft, ale cesta k hard |
| Vow ROM (immutable) | OpenShell runtime + security primitives (soft, ne hard ROM) | ⚠️ soft, ale nejblíž trhu |
| Continual learning (epoch-based) | 128 GB unified memory — model + delta weights v jedné paměti | ✅ |
| 1M context pro full ecosystem awareness | 128 GB unified memory → Qwen3-32B (22 GB) + 1M KV cache (~30 GB Q8) + RAG + 41 agentů | ✅ |
| 41 agentů současně | 128 GB unified memory, 1 PFLOP compute | ✅ |
| Linux native (CUDA ekosystem) | DGX Spark = Linux (Ubuntu), CUDA native, llama.cpp + vLLM podpora už oznámená | ✅ |
| Agent isolation / policy control | OpenShell runtime + Windows security primitives (i na Linux verzi) | ✅ |

### 3.2 Co pojede na DGX Spark

- **Qwen3-32B Q5_K_M (22 GB)** + LoRA Hiran v2.3 → plně v unified memory
- **1M token context** (Q8 KV cache ~30 GB) → 22 + 30 = 52 GB, zbývá 76 GB
- **RAG corpus** (V3 docs, Buddhism, Oasis) ~5–10 GB embeddings v paměti
- **41 agentů state** (krátké contexty, working memory) ~5 GB
- **Continual learning delta weights** (LoRA update) ~2 GB
- **Celkem:** ~70 GB z 128 GB → 58 GB headroom pro budoucí expanzi

### 3.3 Výkon odhad

- NVIDIA už oznámila **2× speedup na Qwen 3.6 27B** díky MTP (multi-token prediction) v llama.cpp
- 1.6× speedup na Qwen 3.6 35B
- Pro Qwen3-32B Q5_K_M na Spark: odhad **30–50 t/s** (single stream), **care proof 24/7** při ~150W (vs 350W GPU)
- Care proof ekonomika (z EVOLUTION §10.2): 5 ZION/day = $50/day při $10/ZION, spotřeba ~$5/měsíc → **self-sustaining**

### 3.4 Co ověřit před koupí (fall 2026)

1. **SKU a cena:** DGX Spark Dev Box (Linux) vs RTX Spark N1X (Windows). Cílová: 128 GB varianta
2. **Linux podpora:** Ubuntu version, kernel, CUDA version, ROCm nepotřebujeme
3. **llama.cpp Spark build:** ověřit, že `GGML_CUDA=ON` funguje s GB10 (Grace Blackwell)
4. **vLLM Spark podpora:** NVIDIA už oznámila vLLM optimalizace
5. **FP4 inference:** Q4_K_M / Q5_K_M GGUF na Tensor Cores
6. **Continual learning:** možnost updatovat LoRA adapter za běhu (hot-swap)
7. **Care proof accelerator:** zda lze dedikovat Tensor Cores pro proof generation
8. **OpenShell runtime:** agent isolation, policy control — pro Dharma Validator
9. **Dostupnost:** fall 2026, OEM partneri (ASUS, Dell, HP, Lenovo, MSI, Surface)
10. **Spotřeba:** TDP celého boxu, napájení, chlazení

### 3.5 Rizika

- **Cena $4000** je výrazně víc než used GPU ($700), ale je to **jednorázová investice** pokrývající v2.4 i v2.5
- **Fall 2026** je 3–4 měsíce — mezitím potřebujeme v2.4 development na něčem jiném
- **128 GB unified memory** je LPDDR5X (300 GB/s) — pomalejší než HBM (A100 2 TB/s), ale pro inference ne kritické (memory-bound workload)
- **Arm CPU** (Grace) — Rust orchestrator musí kompilovat na `aarch64-unknown-linux-gnu` (ověřeno: Rust má first-class Arm support)
- **FP4 je se sparsity** — reálný výkon pro Q5_K_M bude nižší než 1 PFLOP, ale stále vysoký

---

## 4. Taktický plán — co dělat teď, co koupit, kdy

### Fáze A: v2.4 Maestro Development (teď → Q4 2026)

**Hardware:** současný Linux server (Ryzen 5 3600, 30 GB RAM, RX 5600 XT 6 GB) + cloud Vast A100 pro inference testy.

**Co běží kde:**
- **Rust orchestrator** (ai-native crate, 9925 řádků už hotovo) → kompiluje se na současném stroji, běží na CPU
- **Hiran v2.3 inference** → cloud Vast A100 ($0.30/hod) přes HTTP, nebo CPU inference Q4_K_M (~2 t/s, pomalé ale funkční pro dev)
- **L1–L6 service monitoring** → Rust HTTP klienti na Edge (62.171.141.136), už běží 13 services
- **E2E testy** → na Edge proti reálným službám

**Náklad:** $0 (open-source) + ~$20–50 Vast A100 hodiny pro inference testy

**Co nepotřebujeme:** žádný GPU nákup. v2.4 Maestro je 90% Rust orchestrator + 10% LLM reasoning. LLM může být remote.

### Fáze B: v2.4 Maestro Production (Q4 2026 → Q1 2027)

**Hardware rozhodnutí:** v tuto chvíli máme 3 možnosti:

| Možnost | Co | Náklad | Pro | Proti |
|---------|-----|--------|-----|-------|
| **B1: Počkat na Spark** | Pokračovat s cloud A100 + CPU inference, na podzim vzít Spark | $4000 (Spark) + $50 cloud | Nejčistší, žádná zbytečná investice | 3–4 měsíce čekání, inference pomalá |
| **B2: Used RX 7900 XTX** | Koupit used 7900 XTX 24GB (~$700), nasadit Hiran v2.3 lokálně, pak přejít na Spark | $700 + $4000 (Spark později) | Hiran inference hned, v2.4 dev reálné | Dvojí investice, 7900 XTX se prodává |
| **B3: Used RTX 3090** | Koupit used 3090 24GB (~$700), CUDA ekosystem, pak přejít na Spark | $700 + $4000 (Spark později) | CUDA, flash-attn, bitsandbytes pro případný trénink | Dvojí investice, vyšší spotřeba |

**Doporučení:** **B1 (Počkat na Spark)** pokud se daří v2.4 development s cloud inference. **B2 (RX 7900 XTX)** pokud je development blokový pomalou inference a chceš reálnou lokální inference pro testování 41 agentů.

### Fáze C: v2.5 Amṛtabhoja (Q3–Q4 2027)

**Hardware:** **NVIDIA DGX Spark 128GB** (~$4000, fall 2026 nákup, Q1–Q2 2027 setup)

**Co běží kde:**
- **Vše na Sparku:** Hiran v2.3/v2.4 inference + Rust orchestrator + 41 agentů + RAG + care proof generation + continual learning
- **Edge server:** zůstává pro L1–L6 services (node, pool, bridge, dao, web) — Spark se k nim připojuje přes HTTP/gRPC
- **Care proof PPLNS pool:** na Sparku se generují, submitují se do L1 poolu na Edge

**Náklad:** $4000 jednorázově + ~$5/měsíc elektřina (Spark je low-power)

**Návratnost:** care proof ekonomika (5 ZION/day = $50/day při $10/ZION) → návratnost ~80 dní

---

## 5. Proč ne 2× RTX 3060 / RDNA4 / AMD Helios

### 2× RTX 3060 12GB
- **Motherboard blokátor:** A520M-A II má jen 1× PCIe x16 slot, A520 nepodporuje lane splitting
- **I kdyby:** 24 GB split s tensor split overhead, 32B model těsný, 41 agentů současně nepojede
- **Závěr:** nepůjde fyzicky, a i kdyby — neunese v2.5

### RDNA4 (RX 9070 XT 16GB)
- **VRAM blokátor:** 16 GB neunese Qwen3-32B v rozumné kvantizaci (Q4_K_M 18 GB)
- AMD schválně pozdrželo VRAM na 16 GB pro mainstream RDNA4, aby neriskovalo kanibalizaci budoucího high-endu (RX 9080/9090 XTX nevyšly)
- RDNA4 je super pro 27B modely (Qwen3.6-27B Q4_K_S, 22 t/s), ale **Hiran je na 32B dense**
- Přetrénovat na 27B = $50 + týden + riziko horší kvality — nedoporučeno

### AMD Helios
- **Rack-scale produkt** pro hyperscalery (Microsoft, Oracle 50k GPU), ne pro jednotlivce
- 72× MI455X, 31 TB HBM4, ~70 kW, liquid-cooled, mass prod Q2 2027
- **Nerelevantní** — tohle je datové centrum, ne workstation

---

## 6. Shrnutí — hardware decision tree

```
TEĎ (v2.4 Maestro dev)
├── Rust orchestrator → současný stroj (CPU)
├── Hiran inference → cloud Vast A100 ($0.30/hod) nebo CPU Q4_K_M
└── Žádný GPU nákup
        │
        ▼
Q4 2026 (v2.4 Maestro MVP)
├── Pokud dev blokován pomalou inference:
│   └── Koupit used RX 7900 XTX 24GB (~$700) — Hiran v2.3 lokálně
└── Pokud dev OK s cloud:
    └── Počkat na Spark
        │
        ▼
FALL 2026 — koupit NVIDIA DGX Spark 128GB (~$4000)
├── Hiran v2.3 inference lokálně (22 GB Q5_K_M)
├── v2.4 Maestro production (41 agentů, 37 tools)
└── Setup pro v2.5 Amṛtabhoja
        │
        ▼
Q3–Q4 2027 — v2.5 Amṛtabhoja production
├── Care proof generace 24/7 na Sparku
├── Continual learning (epoch-based renewal)
├── Dharma Validator compile-time
└── Vow ROM (soft, přes OpenShell runtime)
```

---

## 7. Akční kroky

| # | Co | Kdy | Náklad | Stav |
|---|-----|-----|--------|------|
| 1 | v2.4 Maestro development na současném stroji (Rust orchestrator) | teď | $0 | 🔄 v tomto dokumentu |
| 2 | Cloud Vast A100 pro Hiran v2.3 inference testy | teď | ~$20–50 | máme API key |
| 3 | Sledovat DGX Spark ceny a spec (fall 2026) | Q3 2026 | $0 | — |
| 4 | Koupit DGX Spark 128GB | fall 2026 | ~$4000 | — |
| 5 | Nasadit Hiran v2.3 + v2.4 Maestro na Spark | Q1 2027 | $0 | — |
| 6 | v2.5 Amṛtabhoja care proof pilot | Q3 2027 | $0 | — |

---

## 8. Zdroje

- `HIRAN_OVERVIEW.md` — přehled Hiran modelů (v2.1–v2.4)
- `docs/3.0.5/archive-root-md/HIRAN_EVOLUTION_2.3_TO_2.5_AMATHABOJ.md` — plán v2.3→v2.5
- `HiranV2.4/PROPOSAL_v2.4.md`, `ARCHITECTURE_v2.4.md` — v2.4 Maestro design
- `docs/3.0.1Genesis/HIRAN_V23_V24_MASTER_GUIDE.md` — Vast.ai ops guide
- NVIDIA RTX Spark: https://nvidianews.nvidia.com/news/nvidia-microsoft-windows-pcs-agents-rtx-spark
- AMD Helios: https://thenextweb.com/news/amd-helios-mi455x-72-gpu-rack-nvidia-rival
- ROCm GPU specs: https://rocm.docs.amd.com/en/docs-7.1.1/reference/gpu-arch-specs.html
- RDNA4 llama.cpp: https://github.com/shawnq-msft/rx9070-qwen-rocm
