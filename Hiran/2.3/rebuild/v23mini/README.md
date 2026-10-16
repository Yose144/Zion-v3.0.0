# Hiran v2.3-mini — QLoRA rebuild pipeline

Mini rebuild of the lost v2.3 (Qwen3-32B) weights — scaled to fit the
local node's Vega 8G: **Qwen3-8B QLoRA → merge → GGUF Q5_K_M (~5.7 G)**.

## Run 1 (2026-XX, vast.ai instance 56166675, RTX 3090 Ti 23G, $0.23/h)

- Data: `../merged_seed.jsonl` — 7 059 rows (6 918 train / 141 eval,
  `--drop_echo` removed 0; echo detection is conservative, refine later)
- Config: r=32 α=64 RSLoRA, 7 proj (q/k/v/o/gate/up/down), seq 4096,
  bs 4×ga8 (eff. 32), lr 1e-4 cosine, 2 epochs → 434 steps
- Attention: flash-attn if installed else sdpa
- Result: TBD

## Pipeline

```
train_v23mini.py   QLoRA SFT (trl), echo-row filter, eval split, TB logs
merge_v23mini.py   layer-by-layer LoRA merge (scale=α/√r for rslora) —
                   streams base shards, low RAM
run_remote.sh      instance-side: deps → train → merge → GGUF Q5_K_M
vast_v23mini.sh    local-side: find/create/push/train/status/pull/destroy
```

## Ops

```bash
vastai set api-key <key>                    # ~/.config/vastai/vast_api_key
bash vast_v23mini.sh find                   # gpu_ram>=24, sorted by $/h
bash vast_v23mini.sh create <offer_id>      # pytorch 2.6/cu124 image, 60G disk
bash vast_v23mini.sh push <id>              # rsync dataset + scripts
bash vast_v23mini.sh train <id>             # nohup run_remote.sh
bash vast_v23mini.sh status <id>            # instance + tail train.log
bash vast_v23mini.sh pull <id>              # out/ → ./artifacts/
bash vast_v23mini.sh destroy <id>           # STOP BILLING
```

SSH key must be registered on the account first:
`vastai create ssh-key "$(cat ~/.ssh/id_ed25519.pub)" -y`
(`vast_v23mini.sh` uses `$VAST_SSH_KEY` or `~/.ssh/id_ed25519`).

## Costs

3090 Ti ≈ 29 s/step → 434 steps ≈ 3.5 h ≈ **$0.80**. A100 80G would cut
to ~1.5 h at ~$1.5/h. Credit check: `vastai show user`.

## After pull

1. `artifacts/hiran-v2.3mini-Q5_K_M.gguf` → Vega llama-server (`hiran-core` alias)
2. Copy to Edge `/opt/zion/hiran-models/` — never single-disk a model again
3. Eval vs base Qwen3-8B on fixed Zion question set (F2 checklist)
4. Optionally `artifacts/adapter-final/` stays for re-merge/resume
