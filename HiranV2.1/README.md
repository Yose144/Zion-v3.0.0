# Hiran / Hiranyagarbha bundle (v2.1)

Komplexní adresář pro **váhy inference (v1)**, **LoRA trénink (v2)** a **jednotné SFT učivo (v2.1)**.

## Rychlé mapování

- **`curriculum/meta/`** — drobná metadata sledovatelná gitem (např. `hiranyagarbha-v1.Modelfile`).
- **`data/shards/`** — původní JSONL řádky (`zion_train*.jsonl`, …); **samotné `.jsonl` soubory nejsou v gitu** — vygeneruj collector/orchestrator skripty lokálně.
- **`data/hiran_curriculum_v2.1.jsonl`** — sloučené učivo; **není trackované**, vygeneruje `scripts/finetune/merge_hiran_curriculum_v2_1.py` po doplnění shardů.
- **`lineage/`** — velké binární stromy (**gitignored**): Ollama v1 Prague snapshot, výstupy Vast LoRA v2 runu.
- **`Hiran_v2.1.md`**, **`gpuVast.md`** — koncept + Vast playbook.

Po úpravě shardů regeneruj kurikulum:

```bash
python3 scripts/finetune/merge_hiran_curriculum_v2_1.py
```

Většina skriptů stále mluví na `scripts/finetune/data/` — ten adresář je symlink na `./data/` zde.
