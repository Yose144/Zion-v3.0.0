# Přesunuto

Celý fine-tuning stack pro Hiran v2.1 (Vast, LoRA, merge, dataset) je v repozitáři na jednom místě:

**[`HiranV2.1/finetune/`](../HiranV2.1/finetune/)** — viz [`README.md`](../HiranV2.1/finetune/README.md).

Tento adresář zůstává jen jako přesměrování kvůli starším odkazům a návykům.

### Migrace starých GGUF / LoRA

Pokud máš lokálně ještě `scripts/finetune/outputs/` (gitignored), přesuň vše do kanonické složky:

```bash
mkdir -p HiranV2.1/finetune/outputs
mv scripts/finetune/outputs/* HiranV2.1/finetune/outputs/ 2>/dev/null || true
rmdir scripts/finetune/outputs 2>/dev/null || true
```

Skript `HiranV2.1/finetune/package_hiran_release.sh` dočasně umí najít GGUF i v legacy cestě, ale **jednotný kanon** je `HiranV2.1/finetune/outputs/`.
