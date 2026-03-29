# NVIDIA build.nvidia.com — Průvodce pro ZION projekt

> Aktualizováno: 29. března 2026  
> Orientace pro: testování s free API + integrace do ZION AI Native

---

## 1. Co je build.nvidia.com

NVIDIA's API katalog — **220+ AI modelů** přístupných přes OpenAI-kompatibilní REST API.  
Pracuje stejně jako OpenAI API, jen base URL je jiné → náš `RemoteHttpBackend` funguje bez změny.

**Tři typy položek:**

| Typ | Co to je | Platba |
|-----|----------|--------|
| **Free Endpoint** (92 modelů) | Serverless API na DGX Cloud — ihned použitelné | Zdarma s limity |
| **Partner Endpoint** (73) | Hosté jako DeepInfra, Fireworks, Together AI | Jejich tarify |
| **Downloadable** (128) | Docker image pro self-hosted NIM | GPU server nutný |

---

## 2. Free tier — co dostaneš zdarma

```
1 000 credits/měsíc  ≈  ~500–2 000 API volání (záleží na modelu a délce)
Rate limit: typicky 40 req/min
Bez kreditní karty
```

**Kdy free limit nestačí:** Produkční provoz, velké datové sady, RAG nad tisíci dokumenty.  
**Pro naše testy:** Víc než dost.

---

## 3. Mapa modelů pro ZION projekt

### 3A. LLM pro Hiranyagarbha agenta (chat / reasoning)

| Model | Badge | Nejlepší pro |
|-------|-------|-------------|
| `nvidia/llama-nemotron-super-49b-v1` | Free | Hlavní agent — dobrý poměr kvality/ceny |
| `nvidia/nemotron-3-super-120b-a12b` | Free | Hluboký reasoning, dharma dialogy |
| `nvidia/glm-4.7` | Free | Agentic úlohy, tool calling |
| `stepfun-ai/step-3.5-flash` | Free | Rychlé odpovědi, agentic pipeline |
| `minimax/minimax-m2.5` | Free | Coding, analýza kódu, 230B MoE |
| `meta/llama-3.1-8b-instruct` | Free | Lehký, rychlý dev loop |
| `meta/llama-3.3-70b-instruct` | Free | Produkčně stabilní |

### 3B. Embeddings pro RAG / paměť agenta

| Model | Badge | Nejlepší pro |
|-------|-------|-------------|
| `nvidia/llama-nemotron-embed-1b-v2` | Free | Multilingual embedding (26 jazyků) — ideální pro paměť agenta |
| `nvidia/nv-embedqa-e5-v5` | Free | Q&A retrieval |

### 3C. Safety / Guardrails pro DharmaValidator

| Model | Badge | Nejlepší pro |
|-------|-------|-------------|
| `nvidia/nemotron-content-safety-reasoning-4b` | Free | Kontrola výstupu vs. dharma pravidla |
| `nvidia/guardrails-topic-control-70b-v1` | Free | Blokování off-topic požadavků |

### 3D. Reranking pro rozhodování agenta

| Model | Badge | Nejlepší pro |
|-------|-------|-------------|
| `nvidia/llama-nemotron-rerank-1b-v2` | Free | Seřazení MML kandidátů |

---

## 4. Quick start — první API volání (curl)

```bash
# Nastav klíč
export NVIDIA_API_KEY="nvapi-..."

# Test — llama 70B (Free Endpoint)
curl -s https://integrate.api.nvidia.com/v1/chat/completions \
  -H "Authorization: Bearer $NVIDIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta/llama-3.3-70b-instruct",
    "messages": [{"role":"user","content":"Co je dharma? Odpověz v 2 větách."}],
    "max_tokens": 100
  }' | python3 -m json.tool
```

Odpověď přijde za ~2–4 sekundy.

---

## 5. Integrace do ZION projektu

### 5A. Cargo / Rust — RemoteHttpBackend

Vše je hotovo. Stačí nastavit env vars a spustit:

```bash
# .env soubor (NEPUSH do gitu)
NVIDIA_API_KEY=nvapi-...
LLM_BASE_URL=https://integrate.api.nvidia.com/v1
LLM_MODEL=meta/llama-3.3-70b-instruct
```

```rust
// Automaticky načte z prostředí
let backend = RemoteHttpBackend::from_env()?;

// Nebo explicitně
let backend = RemoteHttpBackend::nvidia_cloud(
    "nvapi-...",
    "meta/llama-3.3-70b-instruct"
)?;

agent.set_llm_backend(ConsciousnessAwareBackend::new(backend, "Hiranyagarbha"));
```

### 5B. Python test (rychlý spike)

```python
from openai import OpenAI
import os

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.environ["NVIDIA_API_KEY"]
)

resp = client.chat.completions.create(
    model="meta/llama-3.3-70b-instruct",
    messages=[
        {"role": "system", "content": "Jsi Hiranyagarbha, mudrc ZION blockchainu. Odpovídáš krátce a moudře."},
        {"role": "user", "content": "Proč důkaz práce odráží dharmu?"}
    ],
    max_tokens=200,
    temperature=0.7,
)
print(resp.choices[0].message.content)
```

```bash
pip install openai
python3 docs/test_nim.py
```

### 5C. Embedding pro paměť agenta

```python
from openai import OpenAI
import os

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.environ["NVIDIA_API_KEY"]
)

# Vygeneruj embedding pro paměťový záznam
resp = client.embeddings.create(
    model="nvidia/llama-nemotron-embed-1b-v2",
    input="Agent meditoval 30 minut a dosáhl Sentient levelu.",
    encoding_format="float",
    extra_body={"input_type": "passage", "truncate": "END"}
)
vector = resp.data[0].embedding
print(f"Embedding dim: {len(vector)}")  # → 2048
```

Vektory lze uložit do SQLite/Qdrant a použít jako sémantická paměť pro `InContextBackend`.

---

## 6. Testování s free API — postup pro ZION

### Krok 1: Ověř klíč a dostupné modely

```bash
curl -s https://integrate.api.nvidia.com/v1/models \
  -H "Authorization: Bearer $NVIDIA_API_KEY" | \
  python3 -c "import json,sys; [print(m['id']) for m in json.load(sys.stdin)['data']]"
```

### Krok 2: Otestuj Hiranyagarbha system prompt

```bash
cd /Users/yeshuae/Projects/2.9.6/L3/ai-native
NVIDIA_API_KEY=nvapi-... LLM_MODEL=meta/llama-3.3-70b-instruct \
  cargo test test_remote_backend_from_env -- --nocapture 2>&1 | tail -20
```

### Krok 3: Live dialog s agentem

```bash
# Spusť interaktivní test
NVIDIA_API_KEY=nvapi-... \
LLM_BASE_URL=https://integrate.api.nvidia.com/v1 \
LLM_MODEL=meta/llama-3.3-70b-instruct \
  cargo test -- --nocapture 2>&1 | grep -E "(ok|FAILED|dharma|response)"
```

### Krok 4: NeMo Agent Toolkit evaluace

```bash
pip install nvidia-nat

nat run --config_file scripts/nat/hiranyagarbha_workflow.yml \
    --input "Vysvětli princip Proof-of-Work z hlediska dharmy."
```

---

## 7. Limity free tieru a jak je nepřekročit

| Limit | Hodnota | Jak obejít |
|-------|---------|-----------|
| Credits/měsíc | ~1 000 | Používej menší modely (8B/70B) pro testy |
| Req/min | 40 | Pri batchování přidej `time.sleep(1.5)` |
| Max context | záleží na modelu | Pro 70B = 128K tokenů |
| Concurrent req | 5 | EkamField mesh testuj sekvenčně |

**Tip:** Pro CI/CD používej `EchoBackend` (nespotřebuje žádné credits).  
**Tip:** `LLM_MODEL=meta/llama-3.1-8b-instruct` je nejlevnější free model pro rychlé iterace.

---

## 8. Roadmapa využití v ZION projektu

| Priorita | Aplikace | Model | Modul |
|----------|----------|-------|-------|
| 🔥 Ihned | Dharma dialog agenta | `llama-3.3-70b` | `hiranyagarbha.rs` |
| 🔥 Ihned | Consciousness-aware odpovědi | `llama-3.3-70b` | `ConsciousnessAwareBackend` |
| ⚡ Brzy | In-context memory retrieval | `nemotron-embed-1b-v2` | `InContextBackend` |
| ⚡ Brzy | Safety check výstupu | `nemotron-content-safety-4b` | `DharmaValidator` |
| 📅 Plán | Multi-agent Deeksha koordinace | `nemotron-super-120b` | `DeekshaNetwork` |
| 📅 Plán | RAG nad ZION dokumentací | `embed + llama` | nový `zion_rag.rs` |

---

## 9. Jak zjistit aktuální free modely

```bash
# Filtruje jen "Free Endpoint" modely z API katalogu
curl -s "https://integrate.api.nvidia.com/v1/models" \
  -H "Authorization: Bearer $NVIDIA_API_KEY" | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
for m in sorted(data['data'], key=lambda x: x['id']):
    print(m['id'])
"
```

Nebo na webu: https://build.nvidia.com/models?filters=apiType%3Afree_api

---

## 10. Přehled API endpointů

```
Base URL:   https://integrate.api.nvidia.com/v1

POST /chat/completions    → LLM chat (Hiranyagarbha main)
POST /embeddings          → vektory pro paměť
POST /reranking           → seřazení kandidátů
POST /completions         → čisté dokončení textu (legacy)
GET  /models              → seznam dostupných modelů
```

Všechno jsou OpenAI-kompatibilní endpointy → `RemoteHttpBackend` funguje bez změny kódu.

---

*Klíč nikdy necommituj do gitu. Používej `.env` + `.gitignore` nebo `export` v shellu.*
