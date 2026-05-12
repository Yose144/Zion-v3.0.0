# ZION Fine-tuning — Vast.ai / A100 / RTX 5090 Průvodce

Kompletní postup: od generování datasetu přes Vast.ai nebo A100/RTX 5090 trénink až po GGUF model pro Ollama lokálně.

---

## 1. Co dostaneme

| Fáze | Nástroj | Cena | Výsledek |
|------|---------|------|----------|
| Dataset | NVIDIA NIM free API | **$0** | `data/zion_train.jsonl` (799 párů v ověřeném běhu 2026-03-29) |
| Fine-tuning | Vast.ai RTX 5090 / A100 | **~$0.30–2** | LoRA adaptér ~321 MB |
| Merge + GGUF | Stejný GPU host | **~$0.10–0.30** | `zion-merged-q5_k_m.gguf` ~5.7 GB |
| Inference | Ollama na vlastním stroji | **$0** | `ollama run zion-expert` |

**Celkové náklady: ~$0.40–3 za celý pipeline.**

### Ověřený běh 2026-03-29

- Dataset: `799` párů (`34` seed + `765` generovaných)
- GPU: Vast.ai `RTX 5090 32GB`
- Režim: QLoRA, `5` epoch, auto tier `batch=2`, `grad_accum=16`, `packing=off`
- Výsledek: `eval_loss=0.6549`, `perplexity=1.93`, `eval_mean_token_accuracy≈0.864`
- GGUF export: `zion-merged-q5_k_m.gguf` (~5.7 GB)

---

## 2. NVIDIA NIM free tier — co funguje zadarmo

Base URL: `https://integrate.api.nvidia.com/v1`
API klíč: [build.nvidia.com](https://build.nvidia.com) → Get API Key (zdarma)

### Dostupné zdarma:

| Kategorie | Modely | ZION použití |
|-----------|--------|-------------|
| **Chat**  | `meta/llama-3.1-8b-instruct`, `llama-3.3-70b`, `mistral-7b`, `gemma-2-9b`, ... | Hiranyagarbha agent |
| **Embedding** | `nvidia/nv-embedqa-e5-v5` (1024d), `nv-embedqa-mistral-7b-v2` (4096d) | RAG knowledge base |
| **Code**  | `qwen2.5-coder-7b`, `starcoder2-15b` | Generování Rust kódu |
| **Vision** | `llama-3.2-11b-vision` | Analýza grafů/log souborů |

### Limity free tier:
- ~40 req/min (liší se podle modelu)
- Max 4096 tokenů vstup + výstup
- **Žádný credit card** — stačí GitHub nebo Google přihlášení

### Rychlý test:
```bash
export NVIDIA_API_KEY=nvapi-...

curl https://integrate.api.nvidia.com/v1/chat/completions \
  -H "Authorization: Bearer $NVIDIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"meta/llama-3.1-8b-instruct","messages":[{"role":"user","content":"Co je SHA3-512?"}],"max_tokens":200}'
```

### Rust live test:
```bash
NVIDIA_API_KEY=nvapi-... cargo test -p zion-ai-native -- test_nim_embedding_live --ignored --nocapture
```

---

## 3. Krok 1: Generování datasetu (zdarma, na Macu)

**V3 / Rust / orchestrátor:** collector má ve **HIGH** prioritě `AGENTS.md`, `V3/docs`, `V3/docker`, `V3/cli`, celý `V3/L*`, `StatusV3.md` a rozšířený system prompt (Hiranyagarbha jako orchestrátor). Pro silný V3 bias spusť:

```bash
python HiranV2.1/finetune/collect_dataset.py \
    --output HiranV2.1/finetune/data/zion_train.jsonl \
    --priority HIGH \
    --max-docs 650 \
    --max-chunks 5
```

Úplný ingest (HIGH+MEDIUM+LOW) nech na noc s vyšším `--max-docs`.

```bash
cd /Users/yeshuae/Projects/2.9.6

# Nastav API klíč
export NVIDIA_API_KEY=nvapi-...

# Generuj dataset (seed páry + NIM generování)
python HiranV2.1/finetune/collect_dataset.py \
    --output HiranV2.1/finetune/data/zion_train.jsonl \
    --max-docs 450 \
    --max-chunks 4

# Zkontroluj výsledek:
wc -l HiranV2.1/finetune/data/zion_train.jsonl     # Počet párů
head -c 500 HiranV2.1/finetune/data/zion_train.jsonl | python -m json.tool
```

**Výstup:** `data/zion_train.jsonl` s desítkami až stovkami párů.

### Jednotný korpus Hiranyagarbha v2.1

Části `zion_train*.jsonl` jsou drženy jako **shardy** v `../../HiranV2.1/data/shards/`; kanonické spojení všeho vhodného pod jednu čepici provede:

```bash
python3 HiranV2.1/finetune/merge_hiran_curriculum_v2_1.py
```

Výstupem je `HiranV2.1/finetune/data/hiran_curriculum_v2.1.jsonl` — stejný soubor jako `HiranV2.1/data/hiran_curriculum_v2.1.jsonl` (symlink `finetune/data` → `../data`). Tento soubor používá `start_hiran_v2_vast.sh`, pokud ho neníčím přebiješ `ZION_TRAIN_DATASET`.

Volitelně do stejného adresáře **`HiranV2.1/data/shards/`** přidej kurátorované **SFT** rozšíření: `zion_train_oer_sciences.jsonl` (OER vědy), `zion_train_vedic_guided.jsonl` (BBT/Vedabase — viz plán), **`zion_train_buddhism_guided.jsonl`** (orientace v **klasickém** a **tibetském** buddhismu); plná hloubka přes RAG indexy `buddhism-classical` / `buddhism-tibetan` v [`Hiran_v2.1.md`](../../HiranV2.1/Hiran_v2.1.md) § 3.6.

Poznamka k V2 books:
- publikovane PDF ve `APP&WEB/public_html/V2/books/` se nemaji brat jako primarni ingest format,
- collector je uci pres repo-local textove proxy vrstvy jako `docs/docs2.9/books/`, `docs/docs2.9/ZION_OASIS/GOLDEN_EGG_GAME/`, `docs/docs2.9/SACRED_KNOWLEDGE/`, `docs/docs2.9/COSMIC_MAP/` a `docs/docs2.9/deployment/AMENTI_LOG_INDEX.md`,
- kanonicky prehled teto strategie drzi `docs/docs2.9/books/V2_BOOKS_AI_NATIVE_CORPUS.md`.

### Hiran v2.1 — širší znalosti mimo ZION (zakotvení)

Fine-tune dataset (`zion_train*.jsonl`) slouží **primárně** V3 / Rust / `zion` CLI / AI Native. Širší oblasti (přírodní a společenské vědy, dějiny, tibetské a jiné kánonické texty kde licence dovolí, eticky citlivé domorodé zdroje, kompletní projektová biblioteka z repa) patří typicky do **RAG indexů a katalogu zdrojů**; **výjimka pro cílený SFT** jsou kurátorované volitelné shardy `zion_train_oer_sciences.jsonl`, `zion_train_vedic_guided.jsonl` a **`zion_train_buddhism_guided.jsonl`** v `HiranV2.1/data/shards/` podle [`PLAN_v2.1.md`](../../HiranV2.1/PLAN_v2.1.md). **Buddhistický RAG korpus** stáhni skriptem [`HiranV2.1/scripts/rag/autopilot_buddhism_rag.sh`](../../HiranV2.1/scripts/rag/autopilot_buddhism_rag.sh). Viz též [`HiranV2.1/Hiran_v2.1.md`](../../HiranV2.1/Hiran_v2.1.md) § **3.6**.

Ověřený robustní běh z 2026-03-29:
- `300` souborů
- `765` vygenerovaných párů
- `34` seed párů
- `799` tréninkových párů celkem

---

## 4. Krok 2: Nájem GPU hosta

### Vast.ai (RTX 4090 / 5090 / A100)

Automatizovaný script: `vast_deploy.sh`. **API klíč jen přes env** (`export VAST_API_KEY=…`), viz [`HiranV2.1/gpuVast.md`](../../HiranV2.1/gpuVast.md).

```bash
cd /Users/yeshuae/Projects/2.9.6/HiranV2.1/finetune

# Doporučeno pro v2 upgrade: RTX 4090 (24 GB, QLoRA auto-tier v finetune_lora.py)
./vast_deploy.sh --gpu 'RTX 4090' --find-only   # nabídky
./vast_deploy.sh --gpu 'RTX 4090' --epochs 5    # plný pipeline (potvrdíš vytvoření instance)

# Alternativa: RTX 5090 / A100
VAST_GPU='RTX 5090' ./vast_deploy.sh --epochs 5
```

Ruční workflow přes SSH je pořád možné; ověřený běh 2026-03-29 byl **RTX 5090** (~11.5 min / 799 párů).

### Lambda Labs (stále vhodné pro A100)

1. Jdi na [lambdalabs.com](https://lambdalabs.com) → Cloud → Instances
2. Vyber **A100 40GB PCIe** — $1.29/hr (**nejlevnější A100**)
3. SSH klíč: vlož svůj `~/.ssh/id_rsa.pub`
4. Region: **us-east-1** nebo **us-west-2** (nejdostupnější)
5. Spusť instanci → Zkopíruj SSH příkaz

### Alternativy:

| Platforma | GPU | Cena/hr | Poznámka |
|-----------|-----|---------|---------|
| **Vast.ai** | RTX 5090 32GB | ~$0.49–0.62 | Ověřeno 2026-03-29, nejlepší poměr cena/výkon |
| **Lambda Labs** | A100 40GB | $1.29 | Nejlevnější, spolehlivé |
| **RunPod** | A100 40GB | $1.44 | Spot instances levnější |
| **Vast.ai** | A100 40GB | $0.80–1.20 | Nejlevnější, méně spolehlivé |
| **Google Colab Pro+** | A100 40GB | ~$50/měs | Dobré pro experimenty |

---

## 5. Krok 3: Setup na GPU hostu (jednou po spuštění)

```bash
# SSH na Vast.ai / Lambda instanci
ssh root@{ip-adresa}

# Klonuj ZION repo
git clone https://github.com/Yose144/2.9.6.git zion
cd zion

# Nainstaluj Python závislosti
pip install -r HiranV2.1/finetune/requirements.txt

# Flash Attention 2 (volitelné)
pip install flash-attn --no-build-isolation

# HuggingFace přihlášení je volitelné.
# Aktuální base model `unsloth/Meta-Llama-3.1-8B-Instruct` je použitelný i bez loginu,
# ale s tokenem dostaneš lepší rate limit.

# Zkopíruj dataset z Macu
scp -r HiranV2.1/finetune/data user@{ip}:~/zion/HiranV2.1/finetune/
```

---

## 6. Krok 4: Trénink QLoRA

```bash
# Na GPU instanci:
cd ~/zion

# Dry run — zkontroluj dataset + config (bez GPU)
python HiranV2.1/finetune/finetune_lora.py \
    --dataset HiranV2.1/finetune/data/zion_train.jsonl \
    --dry-run

# Spusť trénink (auto-detect batch podle VRAM)
python HiranV2.1/finetune/finetune_lora.py \
    --dataset HiranV2.1/finetune/data/zion_train.jsonl \
    --output  HiranV2.1/finetune/outputs/zion-llama-lora \
    --epochs  5

# Průběh tréninku:
# [10/150] loss=1.842, lr=0.0002
# [20/150] loss=1.234, lr=0.00019
# ...
# Training complete! Avg loss: 0.456
```

Aktuálně ověřené auto-tier chování:
- `RTX 5090 32GB` → `batch=2`, `grad_accum=16`, `packing=off`
- `A100 40GB` → vyšší batch tier dle VRAM auto-detectu

**Typické časy:**
| Velikost datasetu | Epochy | GPU | Čas | Poznámka |
|------------------|--------|-----|-----|----------|
| 100 párů | 3 | A100 40GB | ~10 min | malý sanity run |
| 300 párů | 3 | RTX 5090 32GB | ~8–12 min | robustnější smoke test |
| 799 párů | 5 | RTX 5090 32GB | ~11.5 min | ověřeno 2026-03-29 |

---

## 7. Krok 5: Merge + GGUF export

```bash
# Nainstaluj llama.cpp
git clone https://github.com/ggerganov/llama.cpp /opt/llama.cpp
cd /opt/llama.cpp
cmake -B build -DLLAMA_CUDA=ON && cmake --build build -j$(nproc)
pip install sentencepiece

# Merge LoRA + konvertuj do GGUF Q5_K_M
cd ~/zion
python HiranV2.1/finetune/merge_export.py \
    --adapter HiranV2.1/finetune/outputs/zion-llama-lora \
    --output  HiranV2.1/finetune/outputs/zion-llama-merged \
    --to-gguf \
    --gguf-quant Q5_K_M \
    --llamacpp /opt/llama.cpp

# Výsledek:
#   outputs/zion-llama-merged-q5_k_m.gguf   ~5.7 GB
#   outputs/zion-llama-merged/Modelfile.zion
```

---

## 8. Krok 6: Stáhni model na Mac

```bash
# Z Macu:
scp user@{ip}:~/zion/HiranV2.1/finetune/outputs/zion-llama-merged-q5_k_m.gguf \
    ~/models/zion-expert-q5.gguf

scp user@{ip}:~/zion/HiranV2.1/finetune/outputs/zion-llama-merged/Modelfile.zion \
    ~/models/Modelfile.zion

# Uprav cestu v Modelfile (absolutní cesta na Macu):
sed -i '' "s|FROM .*|FROM $HOME/models/zion-expert-q5.gguf|" ~/models/Modelfile.zion
```

---

## 9. Krok 7: Ollama lokálně

```bash
# Nainstaluj Ollama (pokud ještě nemáš):
brew install ollama
# nebo: curl -fsSL https://ollama.com/install.sh | sh

# Zaregistruj model:
ollama create zion-expert -f ~/models/Modelfile.zion

# Spusť a testuj:
ollama run zion-expert "Co je Ekam Deeksha mining algoritmus?"
ollama run zion-expert "Jak nakonfigurovat ZION mining pool?"
ollama run zion-expert "Napiš Rust funkci pro výpočet DharmaScore"

# API endpoint (při spuštěném Ollama):
curl http://localhost:11434/api/generate \
  -d '{"model":"zion-expert","prompt":"Jak funguje HiranyagarbhaAgent?"}'
```

---

## 10. Integrace s ZION AI Native (Rust)

```rust
// Po spuštění Ollama lokálně:
use zion_ai_native::llm_backend::RemoteHttpBackend;

let zion_expert = RemoteHttpBackend::new(
    "zion-expert",          // Název modelu v Ollama
    "http://localhost:11434/v1",  // Ollama OpenAI-compat endpoint
    "",                     // Ollama nepotřebuje API klíč
);

// Nebo přes env:
// ZION_LLM_MODEL=zion-expert ZION_LLM_URL=http://localhost:11434/v1
```

---

## 11. Shrnutí — co jde zadarmo vs. co stojí peníze

### ✅ ZDARMA (free NVIDIA NIM API):
- Generování datasetu (hundreds párů)
- Testování všech 188+ modelů
- RAG embeddings (nv-embedqa-e5-v5)
- Chat completions pro Hiranyagarbha agenta
- Live integration testy v Rustu

### 💰 PLATÍ se (A100 pronájem — jednou):
- Fine-tuning Llama-3.1-8B na ZION datech: **$0.35–2**
- GGUF export + stažení: **$0.10**
- **Celkem: $0.50–3**

### ✅ Po fine-tuningu ZDARMA navždy:
- Ollama lokálně na Macu — inference 100% offline
- Žádné API náklady pro výrobu
- Vlastní model bez cenzury a rate limitů
- Lze dál fine-tunovat na nových datech

---

## 12. Komplexní ZIP release pro jiný stroj

Skript `package_hiran_release.sh` zabalí GGUF, přenosný `Modelfile` (řádek `FROM` ukazuje na `./…gguf` ve stejné složce), `MANIFEST.json` (SHA-256 souborů v kořeni balíčku, `base_model` z `adapter_config.json` pokud existuje LoRA), `README_INSTALL.md` (Ollama + ZION env), volitelně `provenance/BUILD.txt` z `HiranV2.1/curriculum/meta/`, a na přání celou složku **LoRA** nebo **HF merge** (velké).

```bash
./HiranV2.1/finetune/package_hiran_release.sh --help

# Po dokončení merge_export.py — GGUF v HiranV2.1/finetune/outputs/
./HiranV2.1/finetune/package_hiran_release.sh --name hiran-v2.1

# + LoRA pro případný re-merge na cílovém GPU
./HiranV2.1/finetune/package_hiran_release.sh --name hiran-v2.1 --with-lora

# Jen rozbalovací složka v /tmp (cesta na stdout, bez zip)
./HiranV2.1/finetune/package_hiran_release.sh --no-zip

./HiranV2.1/finetune/package_hiran_release.sh --out-zip ~/artifacts/hiran-v2.1.zip

# Výjimečně: celý HF sloučený model (15+ GB)
./HiranV2.1/finetune/package_hiran_release.sh --with-hf-merged
```

Výchozí cíl archivu: `~/hiran-v2.1-YYYYMMDD-HHMMSS.zip` (UTC). Na cílovém stroji rozbal, `cd` do `hiran-v2.1-release/`, pak `ollama create hiran-v2.1 -f Modelfile` (název modelu = `--name`).

Bez `--outputs-dir` skript vybere **nejnovější** `*.gguf` podle času souboru — **rekurzivně** v:

`HiranV2.1/finetune/outputs/`, `HiranV2.1/finetune/exports/`, `HiranV2.1/lineage/`, `scripts/finetune/outputs/`.

Při stejném čase upřednostní soubor pod `HiranV2.1/finetune/outputs/`. Pro jednu kanonickou složku přesuň artefakty do `HiranV2.1/finetune/outputs/` — viz [`scripts/finetune/README.md`](../../scripts/finetune/README.md).

Pokud v repu žádný GGUF není (zůstal jen na Vast / v `~/models`), použij `--gguf /absolutní/cesta/model.gguf`.

---

## 13. Tipy pro minimální náklady

```bash
# Sleduj čas instance — zastav hned po dokončení!
uptime

# Přenes jen model, ne celý merged adresář (~15 GB):
scp ubuntu@{ip}:~/zion/HiranV2.1/finetune/outputs/*q5*.gguf ~/models/

# Zastav instanci na Lambda Labs:
# Dashboard → Running → Terminate
# POZOR: data se smažou — vždy stáhni model před terminací!

# Spot instances na Vast.ai jsou 30-50% levnější:
# vast create instance {id} --onstart "cd /root && git clone ..."
```

---

*Poslední aktualizace: 12. 5. 2026 | ZION v2.9.6 | Phase V-VI AI Native*
