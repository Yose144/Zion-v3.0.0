# Hiran v2.3-mini training artifacts — restore

`adapter-final/adapter_model.safetensors` (167 MB) přesahuje GitHub 100MB
limit → v repu je uložený jako **xz split**:

```bash
# v tomto adresáři (adapter-final/):
cat adapter_model.safetensors.xz.aa adapter_model.safetensors.xz.ab \
  | xz -d > adapter_model.safetensors

# verify — sha256 musí být:
# 8ca53d98c8fd33bee49ac11a251367f36c81f433703e78dfeaf58f6e0f182308
sha256sum adapter_model.safetensors
```

Raw `.safetensors` je v `.gitignore` — drží se jen lokálně + na Edge/Vega
(v podobě mergnutého `hiran-v2.3mini-Q5_K_M.gguf` 5.85G).

Obsah: Qwen3-8B QLoRA adapter (r=32/α=64 RSLoRA, 2 ep, merged_seed.jsonl
7059 rows, vast.ai run 56166675) + tokenizer/config/chat_template.
Merge → GGUF: `../merge_v23mini.py` (scale α/√r pro rslora).
