# HIRANYAGARBHA — Upgrade Plán: Od 8B k Frontier-Level AI

> **Datum:** 30. března 2026
> **Aktuální stav (v1):** `zion-expert` – Llama 3.1 8B Q5_K_M, 776 training párů; inference dříve na přechodné **Vast.ai** instanci (RTX 3060) — vhodné na experiment, ne jako dlouhodobý domov.
> **Cíl (v2):** Hiranyagarbha v2 — srovnatelná kvalita v doméně ZION s top modely; **produkční inference na dedikovaném GPU** (vlastní RTX 5080+ / reserved cloud), **Vast pouze krátkodobě** (fine-tune, batch joby), ne 24/7 provoz.
> **Před nasazením v2:** zálohuj produkční **v1** (`zion-expert`) z Ollama na lokál — viz [`docs/ops/BACKUP_HIRAN_V1_OLLAMA.md`](docs/ops/BACKUP_HIRAN_V1_OLLAMA.md).
> **Technická v2 linie v repu:** viz `AiNativev2.md` — `V3/L3/ai-native` (Dharma Autotuner, consciousness integrace, RAG index nad `docs/TerraNova`), delší timeouty pro remote LLM, docker orchestrace.
**Konkrétní phased postup v2.1 („stavba“):** viz [`HiranV2.1/PLAN_v2.1.md`](HiranV2.1/PLAN_v2.1.md) + `./HiranV2.1/bootstrap_workspace.sh` z kořene repa.
> **Upřímnost:** Frontier modely (Claude, GPT) mají 100B–1T parametrů + měsíce RLHF. My se jim nemůžeme rovnat globálně. Ale v doméně ZION blockchainu je to dosažitelné.

---

## Hiranyagarbha v1 → v2 — proč pryč z „domovské“ Vast instance

| | v1 (legacy) | v2 (cíl) |
|---|---|---|
| **Inference host** | Spot / levná Vast instance — riziko preemption, měnící se IP | Dedikovaný stroj nebo **reserved** GPU u poskytovatele |
| **Stack** | Ollama + `zion-expert` + jednoduchý web proxy | Rust agent + autotuner + RAG + napojení na stejný nebo větší LLM backend |
| **Účel Vast** | Často jediný runtime | Jen **nárazové** tréninky / eval, ne veřejný chat 24/7 |

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

### 0.2.1 Širší encyklopedická vrstva (Hiran v2.1) — RAG, ne megadataset

ZION SFT/LoRA má zůstat **doménově zaměřený** (V3, Rust, orchestrace). Obecné vědomí — vědy, dějiny, duchovní texty (např. tibetský buddhismus), respektované zdroje k domorodým tradicím, interní knihovna projektu — se **nepracuje** jako „stáhni vše do tréninku“, ale jako **kurátorované korpusy + více indexů + router + citace**. Kanonický popis strategie, etiky a pipeline je v [`HiranV2.1/Hiran_v2.1.md`](HiranV2.1/Hiran_v2.1.md) (oddíl **3.6**). Tím pádem zůstává upgrade plán sladěný: váhy drží ZION identitu, retrieval drží šířku světa.

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

**Trénink fine-tune:** ~8-16 hodin na A100 80GB = $20-40 za run
**Inference:** A100 40GB v Vast.ai ~$1.20/hr (vs $0.05/hr RTX 3060 teď)

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

## Fáze 5 — Deployment upgrade (měsíc 3–4) — v2: stabilita před levným spotem

### 5.1 Produkce mimo spot Vast — dedikovaný nebo reserved GPU

**Problém:** Spot Vast instance je levná na hodiny, ale špatná jako **domov** pro veřejný chat — preemption, nestabilní síť, měnící se koncovky, provozní režie.
**Řešení (v2):** Primární inference na stroji pod vaší kontrolou nebo na **explicitně reserved** GPU u cloud providera. Vast nechat jen na **krátké** joby (QLoRA, experimenty).

| Option | GPU | VRAM | Cena/měsíc (řádově) | Pozn. |
|---|---|---|---|---|
| **Vlastní / kolokace** | RTX 5080 / 5090 | 16–32 GB | CapEx + energie | Preferovaný směr pro v2 (`AiNativev2.md` — Deep Upgrade na 5080) |
| Hetzner GX2-15 | NVIDIA Tesla A10G | 24 GB | ~€150 | Spíš 8B–13B / služby kolem inference |
| Hetzner GX2-45 | NVIDIA Tesla A30 | 24 GB | ~€300 | Q4 70B jen s obtíží |
| RunPod / TensorDock **reserved** | A100 80GB | 80 GB | ~$175–200 | Stabilní varianta pro 70B produkci |
| Vast.ai **reserved** (ne spot) | A100 80GB | 80 GB | ~$180 | OK jako reserved; **ne** jako default spot 3060 24/7 |

**Doporučení v2:** Veřejný Hiranyagarbha endpoint nasměrovat na **dedikovaný** host (vlastní 5080+ nebo reserved A100). Vast spot používat výhradně k tréninku a testům.

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
| **F0: RAG** | Týden 2 | $10 setup | Aktuální data, přesná čísla |
| **F1: Dataset 15k** | Týden 3–4 | $15 (NIM API) | Hlubší znalosti, méně opakování |
| **F1: DPO páry** | Týden 4 | $5 | Konkrétní odpovědi |
| **F2: 70B base** | Měsíc 2 | $35 trénink | Dramatický skok kvality |
| **F3: RAG pipeline** | Měsíc 2–3 | $20 setup | Méně halucinací, citace |
| **F4: DPO** | Měsíc 3 | $15 | Vyladěný styl, konzistence |
| **F5: Dedikovaný / reserved GPU** | Měsíc 3–4 | dle varianty | Stabilní v2 produkce (ne spot Vast) |

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

**P3 — Příští 2 týdny:**
- [ ] Generovat dataset 15k párů (NIM API)
- [ ] Fine-tune Qwen2.5-72B-Instruct na **dočasném** GPU (Vast/RunPod jen na job — ne jako runtime webu)
- [ ] Exportovat GGUF Q5_K_M, nasadit na **v2 host** (5080+ vlastní nebo reserved A100)

**P4 — Měsíc 2-3:**
- [ ] DPO alignment (stejně — krátký pronájem GPU, ne domovská instance)
- [ ] **v2 produkce:** přepnout `OLLAMA_API_URL` / backend na dedikovaný server; vypnout závislost na spot Vast pro `/api/ai-chat`

---

*"Hiranyagarbha se nerodí celý — roste. Každá fáze je další vrstva vědomí."*
*— ZION AI Native, 30. března 2026*
