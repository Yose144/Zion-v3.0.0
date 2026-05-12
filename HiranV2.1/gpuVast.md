# Vast.ai — Hiranyagarbha v2 (trénink / fine-tune)

## Obnova po ztracené instanci / smazaném modelu (checklist)

**Git historie** neobsahuje GGUF ani LoRA — `HiranV2.1/lineage/`, `finetune/outputs/`, většina `data/shards/*.jsonl` a `hiran_curriculum_v2.1.jsonl` jsou **ignorované**. Když Vast instance skončila bez `./vast_deploy.sh --download <ID>` nebo se smazaly lokální kopie, je potřeba **znovu vygenerovat data + spustit pipeline**.

1. **`VAST_API_KEY`** — `export VAST_API_KEY='…'` nebo `HiranV2.1/finetune/.env` (`chmod 600`), nikdy do commitu.
2. **`NVIDIA_API_KEY`** — pro `collect_dataset.py` (NIM), pokud dataset znovu generuješ z repa.
3. **Shardy / kurikulum** — v `HiranV2.1/data/shards/` musí být alespoň zdroje pro merge (typicky `zion_train*.jsonl`, `zion_train_hiran_v2.jsonl`, …). Pokud složka skoro prázdná, znovu:
   - `export NVIDIA_API_KEY=nvapi-…`
   - `python HiranV2.1/finetune/collect_dataset.py --output HiranV2.1/finetune/data/zion_train.jsonl --priority HIGH --max-docs 650 --max-chunks 5` (parametry dle [`finetune/README.md`](./finetune/README.md)).
   - `python3 HiranV2.1/finetune/merge_hiran_curriculum_v2_1.py` → vytvoří `HiranV2.1/finetune/data/hiran_curriculum_v2.1.jsonl` (symlink z `finetune/data` → `../data`).
4. **Dry-run před platbou GPU:**  
   `python3 HiranV2.1/finetune/finetune_lora.py --dataset HiranV2.1/finetune/data/hiran_curriculum_v2.1.jsonl --dry-run`  
   (nebo cesta z `ZION_TRAIN_DATASET`).
5. **Vast skripty** — z kořene repa na **Linux / WSL / macOS** (bash):  
   `cd HiranV2.1/finetune && ./start_hiran_v2_vast.sh --find-only` → ověř nabídky; pak  
   `VAST_GPU='RTX 5090' VAST_EPOCHS=5 ./start_hiran_v2_vast.sh --yes`  
   (`start_hiran_v2_vast.sh` předá `ZION_TRAIN_DATASET` do `vast_deploy.sh`).
6. **Během běhu:** `vastai logs <ID>` / `./vast_deploy.sh --status <ID>` — až skončí merge+GGUF na serveru (pokud `ZION_SKIP_GGUF!=1`).
7. **IHNED stáhnout** (než `destroy`):  
   `./vast_deploy.sh --download <ID>` → lokálně `HiranV2.1/finetune/outputs/zion-llama-merged/`.  
   Volitelně zálohovat i LoRA: na instanci `/workspace/outputs/zion-llama-lora/` přes `vastai copy <ID>:/workspace/outputs/zion-llama-lora/ …`.
8. **Balíček pro přenos (LM Studio / Ollama):** z kořene repa  
   `./HiranV2.1/finetune/package_hiran_release.sh --name hiran-v2.1 --with-lora`  
   (viz [`finetune/README.md`](./finetune/README.md) §12 — `--gguf` pokud GGUF není pod `outputs/`).
9. **Teprve potom** `./vast_deploy.sh --destroy <ID>` — ušetříš $/hr.

**HF_TOKEN:** jen pokud měníš base na gated model; výchozí `unsloth/Meta-Llama-3.1-8B-Instruct` často stačí bez loginu.

## Bezpečnost API klíče

- **Nikdy** neukládej `VAST_API_KEY` do gitu ani do sdílených souborů.
- Klíč, který padl do chatu nebo do historie, **považuj za kompromitovaný** → na [vast.ai](https://vast.ai) ho **zruš a vygeneruj nový**.
- Lokálně jen: `export VAST_API_KEY='…'` (vlastní shell), případně `.env` v `.gitignore`.

## Rychlý start — najít RTX nabídky (bez API klíče)

```bash
./HiranV2.1/finetune/vast_list_rtx_offers.sh 20
```

První sloupec je **offer_id** pro Vast console / `vastai create instance …`.

## Rychlý start — RTX 4090 (najít nabídky přes REST)

**REST** (oficiální formát GPU: `RTX 4090` mezerou):

```bash
export VAST_API_KEY='tvůj-klíč-z-console'

curl -sS -X POST "https://console.vast.ai/api/v0/bundles/" \
  -H "Authorization: Bearer $VAST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "gpu_name": {"in": ["RTX 4090"]},
    "num_gpus": {"gte": 1},
    "gpu_ram": {"gte": 23000},
    "reliability": {"gte": 0.98},
    "verified": {"eq": true},
    "rentable": {"eq": true},
    "type": "ondemand",
    "limit": 10
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); \
[print(o['id'], o.get('gpu_name'), round(o.get('dph_total',0),4), o.get('geolocation')) for o in d.get('offers',[])]"
```

Výstup: sloupce `offer_id`, GPU, **$/hod**, lokace. `offer_id` použiješ u vytvoření instance (viz [Creating instances](https://docs.vast.ai/api-reference/creating-instances-with-api)).

## Repo pipeline (QLoRA → GGUF)

Skript: `HiranV2.1/finetune/vast_deploy.sh`

1. **Dataset pro v2 (V3 + Rust + orchestrátor):** znovu vygeneruj `zion_train.jsonl` přes `collect_dataset.py` (HIGH priorita, `--max-docs 650+`) — viz `HiranV2.1/finetune/README.md` §3. Pak teprve fine-tune.
2. **Kontrola datasetu**:
   ```bash
   wc -l HiranV2.1/finetune/data/zion_train.jsonl
   python3 HiranV2.1/finetune/finetune_lora.py --dataset HiranV2.1/finetune/data/zion_train.jsonl --dry-run
   ```
3. **HuggingFace** — pro aktuální default `unsloth/Meta-Llama-3.1-8B-Instruct` token **není nutný**; nastav `HF_TOKEN` jen pokud měníš base model na gated repo.
4. **vastai CLI** (jednorázově):
   ```bash
   python3 -m venv .venv-vast && source .venv-vast/bin/activate
   pip install vastai
   vastai set api-key "$VAST_API_KEY"
   ```
5. Spuštění tréninku **Hiran v2** (jeden příkaz — venv + vastai + neinteraktivní rent):

```bash
cd HiranV2.1/finetune
export VAST_API_KEY='…'   # nebo .env v této složce (gitignored)

./start_hiran_v2_vast.sh              # RTX 4090, 5 epoch, --yes
./start_hiran_v2_vast.sh --find-only  # jen nabídky
VAST_GPU='RTX 5090' VAST_EPOCHS=5 ./start_hiran_v2_vast.sh
```

Ručně (stejné pod kapotou):

```bash
./vast_deploy.sh --gpu 'RTX 4090' --epochs 5 --yes
```

Po doběhu: `./vast_deploy.sh --status <INSTANCE_ID>`, pak `./vast_deploy.sh --download <INSTANCE_ID>`, GGUF nahraj na produkční Ollama jako nový tag (např. `zion-expert-v2`).

Další příkazy: `--destroy <id>` (ukonči platby).

## Hiran v2.1 — co patří na GPU vs. co patří do RAG

**QLoRA na Vastu** = expenzivní krok pro **ZION-doménové** váhy (kód, docs, CLI). Širší „světové“ znalosti (vědy, dějiny, texty, knihovna projektu, eticky kurátorované ne-ZION korpusy) se **nesnaž** narvat do stejného fine-tuningu jako jediný univerzální svazek — drž je v **samostatných retrieval kolekcích** podle [`Hiran_v2.1.md`](./Hiran_v2.1.md) § **3.6**.

**Záloha starého v1 na produkci (Ollama `zion-expert`)** před přepnutím na v2: [`docs/ops/BACKUP_HIRAN_V1_OLLAMA.md`](../docs/ops/BACKUP_HIRAN_V1_OLLAMA.md).

### 2.2 Training na Vast / malém disku

- **15 GB root** na levné instanci typicky nestačí na současně: plný `llama.cpp` CUDA build, HF cache, LoRA checkpointy a GGUF. Pro **Hiran v2.2 Phase 2** počítej **≥100 GB** volume nebo větší image disk (viz [`HiranV2.2/DETAILED_IMPLEMENTATION_PLAN.md`](../HiranV2.2/DETAILED_IMPLEMENTATION_PLAN.md) Resource Requirements).
- Před `cmake --build` uvolni místo (`docker system prune`, smaž staré `build/`, HF cache v `~/.cache/huggingface`), jinak build spadne na `No space left on device`.
- Inference-only: drž na disku jen **jeden** GGUF + předbuildnutý `llama-server` binární artefakt (ne celý zdroják llama.cpp), viz dřívější poznámky k `LD_LIBRARY_PATH` pro Conda images.

## Odkazy

- [Vast API overview](https://docs.vast.ai/api-reference/overview-and-quickstart)
- [Search bundles](https://docs.vast.ai/api-reference/search/search-offers) (`POST /api/v0/bundles/`)
