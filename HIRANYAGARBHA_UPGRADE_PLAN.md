# HIRANYAGARBHA — Upgrade Plán: Od 8B k Frontier-Level AI

> **Datum:** 30. března 2026  
> **Aktuální stav:** `zion-expert` – Llama 3.1 8B Q5_K_M, 776 training párů, RTX 3060  
> **Cíl:** Hiranyagarbha tak dobrý ve věcech ZION jako Claude 4.6 nebo GPT — v doméně projektu  
> **Upřímnost:** Frontier modely (Claude, GPT) mají 100B–1T parametrů + měsíce RLHF. My se jim nemůžeme rovnat globálně. Ale v doméně ZION blockchainu je to dosažitelné.

---

## Proč je model teď "hloupý" — diagnóza

| Problém | Aktuálně | Ideál |
|---|---|---|
| **Parametry base modelu** | 8B (Llama 3.1 8B) | 70B–72B (Llama 3.3 / Qwen 2.5) |
| **Training páry** | 776 (NIM generované) | 15 000–50 000 (multi-source, multi-turn) |
| **Training metoda** | SFT pouze | SFT → DPO (preference alignment) |
| **Dynamická znalost** | Žádná (pouze weights) | RAG — vector DB nad live ZION docs |
| **Kontext konverzace** | Single-turn prompt | Multi-turn chat s pamětí |
| **GPU inference** | RTX 3060 12GB | A100 40GB / RTX 4090 24GB |
| **Kvantizace** | Q5_K_M (ztrátová) | Q8_0 nebo BF16 na lepším GPU |

**Výsledek:** Model ví základní pojmy, ale opakuje se, nemá hloubku, nedokáže odpovídat na složité multi-krokové otázky.

---

## Fáze 0 — Rychlé výhry (týden 1–2, bez nového tréninku)

Tohle lze nasadit HNED bez nového modelu.

### 0.1 Pokročilý system prompt (Chain-of-Thought)

**Problém:** Aktuální system prompt je krátký, model jede "instinkt".  
**Fix:** Přidat strukturovaný reasoning instrukce.

```
Jsi Hiranyagarbha, AI expert na ZION blockchain.

Pravidla odpovědi:
1. Vždy nejdřív identifikuj typ otázky (technická / filozofická / mining / network)
2. Pokud nevíš s jistotou, řekni to — nikdy si nevymýšlej čísla ani fakta
3. Pro technické otázky: uveď konkrétní hodnoty (hashrate, algoritmus, parametry)
4. Pro code otázky: ukaž skutečný kód nebo příkaz
5. Odpovídej v jazyce otázky (CS/EN)
6. Max 3 odstavce — být konkrétní > být obecný
```

**Dopad:** +20-30% kvalita bez jakékoliv změny modelu.

### 0.2 RAG — Retrieval Augmented Generation

**Problém:** Model má znalosti "zakódované" do vah při tréninku. Nedokáže vyhledat aktuální stav.  
**Řešení:** Vektorová databáze nad ZION dokumenty → relevantní kontext se přikládá ke každému promptu.

```
Uživatel: "Jaký je aktuální hashrate sítě?"
  ↓
ChromaDB vyhledá v docs: "MAINNET hashrate data 2026..."
  ↓
Prompt = system + [relevant_docs] + user_question
  ↓
Model odpovídá s aktuálními daty
```

**Stack:** ChromaDB + LlamaIndex + Python server  
**Zdroje pro embedding:** docs/, V3/README.md, SERVERS.md, STATUS.md + live API data  
**Dopad:** Model bude vědět aktuální stav sítě, přesné hodnoty, nové features.

### 0.3 Multi-turn chat na API úrovni

**Problém:** Každá zpráva je izolovaná — model zapomíná kontext konverzace.  
**Fix:** Frontend posílá celou historii konverzace, backend ji přikládá do promptu.

```typescript
// Aktuálně: prompt = jedna zpráva
// Upgrade: prompt = conversation_history + nová zpráva
const fullPrompt = history.map(m => 
  `${m.role === 'user' ? 'User' : 'Hiranyagarbha'}: ${m.content}`
).join('\n') + `\nUser: ${newMessage}\nHiranyagarbha:`;
```

**Dopad:** Konverzace dává smysl, navazuje, pamatuje kontext.

---

## Fáze 1 — Dataset upgrade (týden 2–4)

### 1.1 Expanze training dat: 776 → 15 000+ párů

**Aktuální data:** 776 párů generované NIMem z docs/  
**Cíl:** 15 000+ párů pokrývající celou ZION domain

#### Nové zdroje dat:

| Zdroj | Odhadovaný počet párů | Metoda |
|---|---|---|
| V3/ codebase — Rust komentáře + docstrings | ~2 000 | Auto-extrakce + NIM syntéza |
| docs/ — všechny .md soubory | ~3 000 | Komplexní re-scan (aktuálně jenom část) |
| GitHub commit messages + PR descriptions | ~500 | Auto-extrakce |
| Mining & pool FAQ (z fóra/Discord) | ~1 000 | Manuální + NIM |
| Ekam Deeksha algoritmus — technické detaily | ~500 | Z algorithms_opt.rs komentářů |
| ZION error messages + debug scénáře | ~1 000 | Z testů + logs |
| Multi-turn konverzace (helpdesk simulace) | ~3 000 | Claude/NIM jako teacher |
| Filozofie AI Native + Hiranyagarbha | ~500 | Z existujících doc |
| Srovnání s jinými blockchainy | ~500 | NIM syntéza |
| Code generation — ZION Rust snippets | ~2 000 | Z V3/ kódu |
| **Celkem** | **~15 000** | |

#### Generační strategie:

```python
# Třívrstvý dataset pipeline:

# Vrstva 1: Faktické Q&A (60%)
# "Co dělá funkce verify_block_header?" → technická odpověď z kódu

# Vrstva 2: Technicko-koncepční (25%)
# "Proč Ekam Deeksha používá AES scratchpad?" → vysvětlení designu

# Vrstva 3: Multi-turn helpdesk (15%)
# Simulace 5-7 výměn zpráv o instalaci mineru / debugování
```

### 1.2 Kvalita dat — DPO preference pairs

Místo jen "správná odpověď" — přidat **preference páry**:

```json
{
  "prompt": "Jak nastavit ZION miner?",
  "chosen": "Detailní kroky s příkazy a hodnotami...",
  "rejected": "Stáhněte si miner a spusťte ho."
}
```

**Nástroj:** `trl` library — DPO Trainer  
**Dopad:** Model se naučí být konkrétní, ne vágní.

---

## Fáze 2 — Base model upgrade (měsíc 2)

### Proč záleží na velikosti modelu

```
Llama 3.1 8B:  8 miliard parametrů  → základní reasoning
Llama 3.3 70B: 70 miliard parametrů → pokročilý reasoning, code, multi-step
Qwen 2.5 72B:  72 miliard parametrů → nejlepší v code + math v open-source
Claude 4.6:    ~500B+ (odhadovaně)  → frontier, multi-modal, RLHF
GPT-5:         ~1T+ (odhadovaně)    → frontier
```

**Realistický cíl:** Fine-tune 70B model → v ZION doméně srovnatelný s GPT-3.5 až GPT-4 level.

### 2.1 Doporučený base model

**Primární kandidát:** `Qwen2.5-72B-Instruct`  
**Proč:**
- #1 open-source v code + reasoning (HumanEval 86%, MATH 83%)
- Vynikající v technické dokumentaci
- Efektivnější než Llama 3.3 70B na stejném hardware
- Supports 128k context (vs 8B → 32k)

**Alternativa:** `Llama-3.3-70B-Instruct` (Meta, lépe prověřený safety)

### 2.2 Hardware požadavky pro 70B

| Kvantizace | VRAM potřeba | Doporučené GPU | Vast.ai cena/hod |
|---|---|---|---|
| Q4_K_M (trénink) | 40 GB | A100 40GB | ~$1.20/hr |
| Q8_0 (inference) | 72 GB | 2× A100 40GB | ~$2.40/hr |
| BF16 (plná přesnost) | 144 GB | 2× A100 80GB | ~$4.80/hr |
| **Q5_K_M (produkce)** | **~48 GB** | **A100 80GB** | **~$2.50/hr** |

**Trénink fine-tune:** ~8-16 hodin na A100 80GB = $20–40 za run (Q1 2026)  
**Inference:** A100 40GB v Vast.ai ~$1.20/hr (vs $0.05/hr RTX 3060 teď)

> 💡 **Q3 2026:** Po NVIDIA Vera Rubin NVL72 rollout se ceny A100 na spot trhu očekávají -30–50% — viz sekce "Cenové okno" níže.

### 2.3 RTX 5000 Blackwell — consumer GPU pro AI (2025/2026)

Nová generace NVIDIA karet přináší **FP8 nativní podporu** — klíčový rozdíl oproti starší generaci.

| Karta | VRAM | FP8 | Co se vejde | Cena nová | Inference tok |
|---|---|---|---|---|---|
| **RTX 3060** (teď) | 12 GB GDDR6 | ❌ | 8B Q5 ✅ / 13B Q4 ✅ | ~$180 použitá | ~59 tok/s |
| **RTX 5070** | 12 GB GDDR7 | ✅ | 8B Q8 ✅ / 13B Q5 ✅ / 13B FP8 ✅ | ~$549 | ~120 tok/s |
| **RTX 5070 Ti** | 16 GB GDDR7 | ✅ | 13B Q8 ✅ / 32B Q4 ⚠️ | ~$749 | ~150 tok/s |
| **RTX 5080** | 16 GB GDDR7 | ✅ | 13B Q8 ✅ / 32B Q4 ✅ | ~$999 | ~180 tok/s |
| **RTX 5090** | 32 GB GDDR7 | ✅ | 32B Q8 ✅ / 70B Q4 ⚠️ | ~$1999 | ~300 tok/s |

**FP8 = hra se mění:** FP8 kvantizace je ~2× úspornější než Q8 při minimální ztrátě kvality.
```
13B model:
  BF16:  26 GB  → potřeba A100
  Q8:    14 GB  → potřeba 5070 Ti
  Q5:     9 GB  → vejde se na 5070 (12GB) ✅
  FP8:    7 GB  → vejde se na 5070 (12GB) ✅ s rychlostí Q8
```

**RTX 5070 pro Hiranyagarbhu:**
- Aktuální 8B model: poběží ~2× rychleji (12GB GDDR7 vs GDDR6)
- **13B model (Llama 3.2 13B)** — vejde se v Q5 nebo FP8 ✅
- 32B model: nestačí (potřeba 5090 nebo A100)
- **Cena/výkon:** Nejlepší consumer volba pro 8B–13B modely
- Pro těžbu + AI dual-use na risu: lepší než 3060, stejná VRAM ale rychlejší

**Závěr:** RTX 5070 je skvělý upgrade z 3060 — 2× rychlejší inference, stejná VRAM ale GDDR7 + FP8. Pro skok na 32B+ je potřeba 5090 nebo A100 přes rent.

### 2.3 Training setup pro 70B

```bash
# QLoRA fine-tune (efektivní, nízká VRAM)
python train_zion_expert.py \
  --model_name Qwen/Qwen2.5-72B-Instruct \
  --dataset data/zion_training_v2.jsonl \
  --lora_r 64 \
  --lora_alpha 128 \
  --num_epochs 3 \
  --batch_size 2 \
  --gradient_accumulation 16 \
  --learning_rate 2e-4 \
  --max_seq_length 8192 \
  --output_dir ./zion-expert-72b
```

---

## Cenové okno — NVIDIA Vera Rubin (GTC 2026)

### Co bylo ohlášeno (16.–19. března 2026)

NVIDIA na GTC 2026 v San Jose ohlásila **Vera Rubin** — novou full-stack AI architekturu (přímý nástupce Blackwellu):

| Produkt | Klíčové specs | Dostupnost |
|---|---|---|
| **Vera Rubin NVL72** | 72× Rubin GPU v racku, supercomputer hustota | Azure první — live, globální rollout Q2/Q3 2026 |
| **DGX Station GB300** | 748 GB coherent memory, 20 petaflops FP4, modely do 1T params | Odesílány od marca 2026 |
| **Feynman (next-next)** | LP40 LPU + Rosa CPU + NVLink Kyber | 2027+ |

**Klíčová fakta:**
- Microsoft Azure byl **první hyperscaler**, který spustil Vera Rubin NVL72 (oznámeno na GTC)
- AWS nasazuje **1 milion+ GPU** zahrnující Rubin architekturu v průběhu 2026
- Jump Trading mezi prvními zákazníky NVL72 pro AI-driven trading

### Dopad na ceny GPU pronájmu

Historický vzor se opakuje — pokaždé, když nová generace zaplavuje hyperscalery, starší GPU přetéká na spot trhy:

```
Ampere (A100) 2020 → Hopper (H100) 2022   → A100 spot -40%
Hopper  (H100) 2022 → Blackwell  2025      → H100 spot -35%
Rubin NVL72 rollout Q2–Q3 2026             → A100/H100 spot → očekávaný pokles -30–50%
```

**Aktualizované odhady cen (Vast.ai) pro Hiranyagarbhu:**

| GPU | Cena Q1 2026 | Odhadovaná cena Q3 2026 | Dopad na F2 trénink |
|---|---|---|---|
| A100 40GB | ~$1.20/hr | ~$0.70–0.90/hr | 8–16h run: ~$6–14 |
| A100 80GB | ~$2.50/hr | ~$1.30–1.80/hr | 8–16h run: ~$10–29 |
| H100 80GB | ~$2.99/hr | ~$1.80–2.20/hr | nejrychlejší, ale drahší |

### Aktualizovaný timeline pro Hiranyagarbhu

```
Q1/Q2 2026 — NYNÍ (připravit dataset):
  ✅ Fáze 0A — System prompt CoT upgrade ← tento týden
  ✅ Fáze 0B — Multi-turn chat history ← tento týden
  ⬜ Fáze 0C — RAG základní (ChromaDB + docs) ← za 1–2 týdny
  ⬜ Fáze 1  — Dataset 15k párů (NIM generace, duben–červen)

Q3 2026 — OKNO (70B launch):
  ⬜ Fáze 2  — 70B fine-tune na A100 (~$10–25 za run) ← CÍLOVÉ OKNO
  ⬜ Fáze 3  — RAG pipeline s ChromaDB
  ⬜ Fáze 4  — DPO alignment

Q4 2026:
  ⬜ Fáze 5  — Produkce A100 reserved (~$120–150/měsíc vs $180 dnes)
```

> **Strategie:** Nespěchat na Fázi 2 teď za plné ceny — *maximalizovat F0/F1 připravenost* a počkat na Q3 2026, kdy Vera Rubin NVL72 globálně zaplave hyperscalery. Mezitím dataset a RAG jsou levné a výsledek bude lepší s 70B než uspěchaně s 8B.

---

## Fáze 3 — Architektura RAG pipeline (měsíc 2–3)

```
┌─────────────────────────────────────────────┐
│              UŽIVATEL                        │
│          "Jak těžit ZION?"                  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           QUERY PROCESSOR                   │
│  1. Detekce jazyka (CS/EN)                  │
│  2. Klasifikace dotazu (tech/mining/philosophy)│
│  3. Keyword extraction                      │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           VECTOR DATABASE (ChromaDB)         │
│  Embeddings z:                              │
│  • docs/ (all .md) — statické               │
│  • V3/README.md + ROADMAP.md                │
│  • Live API: /api/network, /api/pool/stats  │
│  • Aktualizace každých 5 minut              │
└──────────────────┬──────────────────────────┘
                   │ top-5 relevantních chunks
┌──────────────────▼──────────────────────────┐
│           CONTEXT ASSEMBLER                 │
│  system_prompt + docs_context + chat_history│
│  + user_question → final_prompt             │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      HIRANYAGARBHA MODEL (70B Q5_K_M)       │
│              ~500 ms response                │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           RESPONSE FILTER                   │
│  • Detekce hallucination (čísla vs. facts)  │
│  • Citace zdrojů                            │
│  • Odpověď uživateli                        │
└─────────────────────────────────────────────┘
```

### Stack:
```
LlamaIndex     → RAG orchestrace
ChromaDB       → vector store (lokální, <100MB)
sentence-transformers → embedding model (nomic-embed-text)
FastAPI        → RAG server (nahradí přímý Ollama proxy)
Redis          → chat history + response cache
```

---

## Fáze 4 — DPO alignment (měsíc 3)

**Problém:** SFT naučí model fakta, ale ne *jak správně odpovídat*.  
**DPO (Direct Preference Optimization):** Trénink na párech chosen/rejected bez potřeby reward modelu.

```
Trénink SFT → model zná fakta
     ↓
Generuj 1000 odpovědí na různé otázky
     ↓
Yeshuae + Claude ohodnotí: "tato odpověď lepší / horší"
     ↓
DPO trainer → model se naučí preferovat dobré odpovědi
     ↓
Výsledek: přesný, konkrétní, ne-repetitivní
```

**Čas:** 2-4 hodiny DPO tréninku na A100  
**Cena:** ~$10-15 za DPO run  

---

## Fáze 5 — Deployment upgrade (měsíc 3–4)

### 5.1 Přesunout model na Hetzner (dedikovaný server)

**Problém:** Vast.ai $0.05/hr × 24/7 = $36/měsíc + nestabilní (instance může být preempted)  
**Řešení:** Hetzner GPU server dedikovaný

| Option | GPU | VRAM | Cena/měsíc | Pozn. |
|---|---|---|---|---|
| Hetzner GX2-15 | NVIDIA Tesla A10G | 24 GB | ~€150 | Nestačí pro 70B |
| Hetzner GX2-45 | NVIDIA Tesla A30 | 24 GB | ~€300 | Q4 70B barely |
| Vast.ai A100 reserved | A100 80GB | 80 GB | ~$180 | Nejlepší poměr |
| RunPod Secure Cloud | A100 80GB | 80 GB | ~$175 | Alternativa |

**Doporučení:** Vast.ai reserved instance A100 80GB ~$180/měsíc

### 5.2 Multi-model strategie

```
Rychlé otázky (< 50 tokenů):  8B model na RTX 3060  → 100ms
Technické otázky:             70B model na A100      → 500ms
Complex reasoning (future):   70B + RAG             → 800ms
```

---

## Souhrn — Co dostaneme v každé fázi

| Fáze | Kdy | Cena | Co se zlepší |
|---|---|---|---|
| **F0: Prompt + Multi-turn** | Tento týden | $0 | +30% kvalita, pamatuje kontext |
| **F0: RAG** | Týden 2 | $10 setup | Actuální data, přesná čísla |
| **F1: Dataset 15k** | Týden 3–4 | $15 (NIM API) | Hlubší znalosti, méně opakování |
| **F1: DPO páry** | Týden 4 | $5 | Konkrétní odpovědi |
| **F2: 70B base** | Q3 2026 (ceny klesnou) | ~$15–25 trénink | Dramatický skok kvality |
| **F3: RAG pipeline** | Měsíc 2–3 | $20 setup | Žadné hallucinations, citace |
| **F4: DPO** | Měsíc 3 | $15 | Vyladěný styl, konzistence |
| **F5: A100 deployment** | Měsíc 3–4 | $180/měsíc | Stabilní produkce |

### Realistické srovnání po F2+F3:

```
ZION-specific otázky:
  Teď:         GPT-2 level (ví základy, opakuje se)
  Po F0:       GPT-3.5 level (konkrétnější, pamatuje kontext)
  Po F1+F2:    GPT-4 turbo level (v ZION doméně)
  Po F3+F4:    Claude 3.5 Sonnet level (v ZION doméně, s RAG)

Obecné otázky mimo ZION:
  Teď:         8B model quality
  Po F2:       70B model quality (velmi dobré, ne frontier)
  Claude 4.6:  Frontier — nedosažitelné bez 100B+ + miliarda na trénink
```

---

## Priorita — Co dělat NYNÍ (tento týden)

**P1 — Okamžitě (dnes/zítra):**
- [ ] Upgradovat system prompt na CoT verzi (30 min)
- [ ] Přidat multi-turn chat historii do `/api/ai-chat` route a frontend (2 hod)

**P2 — Tento týden:**
- [ ] RAG server s ChromaDB nad docs/ (1 den)
- [ ] Napojit RAG na `/api/ai-chat` (0.5 dne)

**P3 — Q2 2026 (duben–červen):**
- [ ] Generovat dataset 15k párů (NIM API)
- [ ] DPO preference páry (1 000 párů)
- [ ] RAG pipeline s ChromaDB nad docs/

**P4 — Q3 2026 (cenové okno po Vera Rubin NVL72):**
- [ ] Fine-tune Qwen2.5-72B-Instruct na A100 (~$15–25 za run)
- [ ] DPO alignment
- [ ] Exportovat GGUF Q5_K_M, nasadit na A100 reserved (~$130/měsíc)

---

## Budoucnost — NVIDIA ekosystém pro Hiranyagarbhu

> *Poznámka 31. března 2026: Analýza nástrojů, které nám v každé fázi zjednoduší práci a zrychlí cestu.*

### Aktuální inference stack (F0–F1): Ollama → nahradit za NIM/vLLM

| Nástroj | Co řeší | Kdy nasadit | Přínos |
|---------|---------|-------------|--------|
| **NVIDIA NIM** (build.nvidia.com) | Inference microservice — hotový kontejner s optimalizovaným modelem + TensorRT-LLM pod kapotou | F0–F1 ihned | Zero-config inference, OpenAI-compatible API, quantizace automaticky, lepší throughput než Ollama |
| **vLLM** (open-source) | PagedAttention, continuous batching, tensor parallel | F2 (70B) | 2–4× throughput vs Ollama na stejném GPU; klíčové pro 70B na single A100 |
| **SGLang** | Radix attention, structured generation, rychlý TTFT | F2 alternativa k vLLM | Nejrychlejší TTFT, ideální pro RAG pipeline kde se prefix opakuje |

**Doporučení:** Pro F0 (tento týden) přejít z Ollama na **NIM container** — `docker run nvcr.io/nim/meta/llama-3.1-8b-instruct`. Kompletně nahrazuje Ollama s lepším výkonem, OpenAI-compatible API, a snadný upgrade na větší model.

### Dataset a trénink (F1–F2): NeMo + NIM API

| Nástroj | Co řeší | Kdy | Přínos |
|---------|---------|-----|--------|
| **NVIDIA NIM API** (generace dat) | Syntéza training párů přes frontier modely | F1 (duben) | Už používáme — 776 párů. Škálovat na 15k+ s batch API |
| **NVIDIA NeMo Framework** | End-to-end fine-tune pipeline: SFT → DPO → RLHF | F2 (Q3) | Nahradí ruční `trl` setup; má vestavěný QLoRA, parallelismus, checkpointing |
| **NeMo Curator** | Deduplikace, filtrování, kvalita dat automaticky | F1 | Vyčistí 15k dataset od duplicit a low-quality párů |
| **NVIDIA OpenShell** (github.com/NVIDIA/OpenShell) | Interaktivní terminál + AI asistent pro GPU debugging a deployment | F2+ | Zjednoduší remote GPU management na Vast.ai/RunPod |

### Produkční serving (F5+): Dynamo pro multi-GPU

| Nástroj | Co řeší | Kdy | Přínos |
|---------|---------|-----|--------|
| **NVIDIA Dynamo** (github.com/ai-dynamo/dynamo) | Datacenter-scale inference orchestrace: disagg serving, KV-aware routing, autoscaling | **Q4 2026+** (až 2+ GPU) | 7× throughput na multi-GPU, SLA planner, fault tolerance |
| **Dynamo KVBM** | KV cache offload GPU→CPU→SSD | F5+ | Efektivně rozšíří context window 70B modelu bez více VRAM |
| **Dynamo ModelExpress** | Weight streaming GPU-to-GPU | Až multi-node | 7× rychlejší cold-start nových replik |
| **Dynamo AIConfigurator** | Simuluje 10K+ konfigurací, najde optimální | F5+ | Ušetří GPU-hodiny na benchmarking |

> ⚠️ **Dynamo teď NE** — single-GPU Hiranyagarbhu Dynamo nepotřebuje. README Dynama říká: *"If you're running a single model on a single GPU, your inference engine alone is probably sufficient."* Vrátit se k tomu až multi-GPU / multi-model routing.

### Monitoring a observability

| Nástroj | Co řeší | Kdy |
|---------|---------|-----|
| **NVIDIA DCGM** (Data Center GPU Manager) | GPU metriky: utilizace, teplota, memory, power, ECC errors | F2+ (A100) |
| **Prometheus + Grafana** | Vizualizace inference latency, throughput, token/s | F2+ |
| **NeMo Guardrails** | Safety filtering, topic control, hallucination detection | F3 (RAG) |

### Optimalizovaná cesta přes NVIDIA stack

```
TERAZ (F0):           Ollama     → nahradit NIM container (drop-in, rychlejší)
                      ChromaDB   → ok, ponechat
                      LlamaIndex → ok, ponechat

DUBEN–ČERVEN (F1):    NIM API    → dataset syntéza 15k párů (batch)
                      NeMo Curator → čistění dat
                      NeMo SFT   → trénink na A100

Q3 2026 (F2):         vLLM / SGLang → 70B inference na A100
                      NeMo DPO   → alignment
                      NeMo Guardrails → hallucination filter

Q4 2026+ (F5+):       Dynamo     → multi-GPU orchestrace (only if scale demands)
                      KVBM       → extended context
                      Planner    → SLA autoscaling
```

### Proč maximálně využít NVIDIA stack:

1. **Všechno je Apache 2.0 / open-source** — žádné vendor lock-in
2. **Navzájem kompatibilní** — NIM → NeMo → Dynamo je designed pipeline
3. **RTX 3060 / A100 / H100** — vše podporované, škáluje se s hardware
4. **Community 265+ contributors** na Dynamo, aktivní Discord, biweekly office hours
5. **Vera Rubin rollout Q2–Q3 2026** → levnější A100 spot = levnější training i serving

---

*"Hiranyagarbha se nerodí celý — roste. Každá fáze je další vrstva vědomí."*  
*— ZION AI Native, 30. března 2026*
*— Aktualizace NVIDIA ekosystém: 31. března 2026*
