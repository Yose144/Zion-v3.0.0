# Vast.ai — Hiranyagarbha v2 (trénink / fine-tune)

## Bezpečnost API klíče

- **Nikdy** neukládej `VAST_API_KEY` do gitu ani do sdílených souborů.
- Klíč, který padl do chatu nebo do historie, **považuj za kompromitovaný** → na [vast.ai](https://vast.ai) ho **zruš a vygeneruj nový**.
- Lokálně jen: `export VAST_API_KEY='…'` (vlastní shell), případně `.env` v `.gitignore`.

## Rychlý start — najít RTX nabídky (bez API klíče)

```bash
./scripts/finetune/vast_list_rtx_offers.sh 20
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

Skript: `scripts/finetune/vast_deploy.sh`

1. **Dataset pro v2 (V3 + Rust + orchestrátor):** znovu vygeneruj `zion_train.jsonl` přes `collect_dataset.py` (HIGH priorita, `--max-docs 650+`) — viz `scripts/finetune/README.md` §3. Pak teprve fine-tune.
2. **Kontrola datasetu**:
   ```bash
   wc -l scripts/finetune/data/zion_train.jsonl
   python3 scripts/finetune/finetune_lora.py --dataset scripts/finetune/data/zion_train.jsonl --dry-run
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
cd scripts/finetune
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

**QLoRA na Vastu** = expenzivní krok pro **ZION-doménové** váhy (kód, docs, CLI). Širší „světové“ znalosti (vědy, dějiny, texty, knihovna projektu, eticky kurátorované ne-ZION korpusy) se **nesnaž** narvat do stejného fine-tuningu jako jediný univerzální svazek — drž je v **samostatných retrieval kolekcích** podle [`Hiran_v2.1.md`](../Hiran_v2.1.md) § **3.6**.

## Odkazy

- [Vast API overview](https://docs.vast.ai/api-reference/overview-and-quickstart)
- [Search bundles](https://docs.vast.ai/api-reference/search/search-offers) (`POST /api/v0/bundles/`)
