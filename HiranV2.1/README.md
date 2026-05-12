# Hiran / Hiranyagarbha bundle (v2.1)

Komplexní adresář pro **váhy inference (v1)**, **LoRA trénink (v2)** a **jednotné SFT učivo (v2.1)**.

## Provádění v2.1 („stavíme“)

1. **[`PLAN_v2.1.md`](PLAN_v2.1.md)** — kompletní phased plán (data → SFT → GGUF → RAG → prod).
2. **Bootstrap** (z kořene repa):

```bash
./HiranV2.1/bootstrap_workspace.sh
```

## Rychlé mapování

- **`curriculum/meta/`** — drobná metadata sledovatelná gitem (např. `hiranyagarbha-v1.Modelfile`).
- **`data/shards/`** — JSONL shardy; standardně **gitignored**, generuj je collector nebo orchestrátorem. **Výjimka:** malá šablona `zion_train_buddhism_guided.jsonl` je součástí repa.
- **`data/hiran_curriculum_v2.1.jsonl`** — sloučené učivo; **není trackované**, vygeneruje `finetune/merge_hiran_curriculum_v2_1.py` po doplnění shardů.
- **`lineage/`** — velké binární stromy (**gitignored**): Ollama v1 Prague snapshot, výstupy Vast LoRA v2 runu.
- **`Hiran_v2.1.md`**, **`gpuVast.md`** — koncept + Vast playbook.
- **Buddhismus RAG:** `./HiranV2.1/scripts/rag/autopilot_buddhism_rag.sh` (z kořene repa) + `write_ingest_manifest.py`. Naplní `data/rag/…/generated` a zápis **oddíl D.2** [`PLAN_v2.1.md`](./PLAN_v2.1.md). API: nastav **`ZION_RAG_BUDDHISM=all`** (nebo `classical` / `tibetan`) a **`ZION_WORKSPACE_ROOT`**. Rust knihovna: `BUDDHISM_RAG_CORPUS_ROOTS`, `collect_markdown_chunks_from_relative_roots`, `HiranyagarbhaAgent::index_buddhism_rag_corpora`.

Po úpravě shardů regeneruj kurikulum:

```bash
python3 HiranV2.1/finetune/merge_hiran_curriculum_v2_1.py
```

Komplexní export natrénovaného modelu (GGUF + přenosný Modelfile + manifest + návod) na jiný stroj jako ZIP: [`finetune/package_hiran_release.sh`](./finetune/package_hiran_release.sh) — viz [`finetune/README.md`](./finetune/README.md) oddíl 12.

Většina skriptů mluví na `finetune/data/` — ten adresář je symlink na `./data/` zde.
