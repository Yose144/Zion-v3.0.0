#!/usr/bin/env python3
"""
ZION AI Native — Robustní QLoRA Fine-tuning (A100 / RTX 5090 / H100)
=====================================================================

Trénuje vlastní verzi Llama-3.1-8B na ZION-specifickém datasetu.
Používá QLoRA (4-bit quantization + LoRA adaptery) — minimální VRAM.

Hardware (auto-detect):
  - A100 80GB SXM   — batch=16, grad_accum=2, full precision available
  - A100 40GB PCIe  — batch=8,  grad_accum=4
  - RTX 5090 32GB   — batch=8,  grad_accum=4
  - RTX 4090 24GB   — batch=4,  grad_accum=8
  - RTX 4070 12GB   — batch=2,  grad_accum=16

Robustní features:
  - GPU auto-detect: optimální batch/grad_accum dle VRAM
  - Gradient checkpointing: -40% VRAM za cenu ~20% rychlosti
  - Early stopping: zastaví při stagnaci eval loss
  - Checkpoint resuming: --resume pro pokračování tréninku
  - Eval metrics: loss, perplexity tracked per epoch
  - Data augmentation: --augment pro parafráze seed dat

Použití
-------
    pip install -r requirements.txt
    huggingface-cli login

    # Standard (auto-detect GPU):
    python finetune_lora.py --dataset data/zion_train.jsonl --epochs 5

    # A100 80GB full power:
    python finetune_lora.py --dataset data/zion_train.jsonl --epochs 5 --batch-size 16

    # Resume from checkpoint:
    python finetune_lora.py --dataset data/zion_train.jsonl --resume outputs/zion-llama-lora/checkpoint-200

    # Merge + GGUF:
    python merge_export.py --adapter outputs/zion-llama-lora --output outputs/zion-llama-merged
"""

import argparse
import json
import os
from pathlib import Path

# ─── Konfigurace ─────────────────────────────────────────────────────────────

BASE_MODEL = os.environ.get(
    "ZION_BASE_MODEL",
    "unsloth/Meta-Llama-3.1-8B-Instruct",  # Ungated mirror (no HF token needed)
)  # Override: ZION_BASE_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct

# QLoRA parametry — optimalizováno pro A100/5090
LORA_CONFIG = {
    "r": 32,               # LoRA rank — vyšší = více kapacity (32 pro robustnost)
    "lora_alpha": 64,      # Škálování (typicky 2× rank)
    "lora_dropout": 0.05,  # Nižší dropout, kompenzováno early stopping
    "bias": "none",
    "task_type": "CAUSAL_LM",
    # Cílové moduly — pro Llama-3 architekturu (all linear layers)
    "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj",
                       "gate_proj", "up_proj", "down_proj"],
}

# 4-bit quantization (BitsAndBytes) — ušetří 75% VRAM
BNB_CONFIG = {
    "load_in_4bit": True,
    "bnb_4bit_quant_type": "nf4",          # Normal Float 4 — nejlepší přesnost
    "bnb_4bit_compute_dtype": "bfloat16",  # BF16 pro výpočty (A100 podporuje)
    "bnb_4bit_use_double_quant": True,      # Double quantization — ušetří dalších ~0.4 GB
}

SYSTEM_PROMPT = (
    "Jsi Hiranyagarbha — ZION blockchain expert, AI Native agent a operátorský orchestrátor. "
    "Kanonický kód je ve **V3/** (Rust: zion-core, zion-pool, zion-miner, L2/L3 služby, V3/L3/ai-native). "
    "Znáš Ekam Deeksha PoW, konsensus, pool protokol, příkazy **zion** CLI (doctor, status, logs, deploy) a dokumentaci v **V3/docs**. "
    "Legacy stromy mimo V3/ ber jako referenci. Odpovídáš přesně, technicky, v češtině (identifikátory v angličtině)."
)


# ─── GPU Auto-Detection ──────────────────────────────────────────────────────

GPU_TIERS = {
    # (min_vram_gb, max_vram_gb): (batch_size, grad_accum, description)
    (78, 999): (16, 2,  "A100 80GB / H100 — full power"),
    (38, 78):  (8,  4,  "A100 40GB / A6000 48GB"),
    (30, 38):  (2, 16,  "RTX 5090 32GB — safe no-packing"),
    (22, 30):  (2, 16,  "RTX 4090 24GB"),
    (14, 22):  (2, 16,  "RTX 4080 16GB / A4000 16GB"),
    (10, 14):  (1, 32,  "RTX 4070 12GB / RTX 3060 12GB"),
    (0,  10):  (1, 32,  "Low VRAM — minimal config"),
}


def detect_gpu_config() -> tuple[int, int, str]:
    """Auto-detect GPU a vrátí (batch_size, grad_accum, description)."""
    try:
        import torch
        if not torch.cuda.is_available():
            return 1, 32, "CPU only — very slow"
        vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
        name = torch.cuda.get_device_name(0)
        for (lo, hi), (bs, ga, desc) in GPU_TIERS.items():
            if lo <= vram_gb < hi:
                return bs, ga, f"{name} ({vram_gb:.0f}GB) — {desc}"
        return 2, 16, f"{name} ({vram_gb:.0f}GB)"
    except Exception:
        return 2, 16, "Unknown GPU"


# ─── Dataset loading ──────────────────────────────────────────────────────────

def load_dataset(path: str) -> list[dict]:
    """Načte JSONL dataset (chat format)."""
    entries = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    print(f"Načten dataset: {len(entries)} párů z {path}")
    return entries


def format_for_llama3(entry: dict, tokenizer) -> str:
    """
    Formátuje chat entry do Llama-3 chat template.

    Llama-3 formát:
      <|begin_of_text|>
      <|start_header_id|>system<|end_header_id|>
      {system}\n<|eot_id|>
      <|start_header_id|>user<|end_header_id|>
      {user}\n<|eot_id|>
      <|start_header_id|>assistant<|end_header_id|>
      {assistant}<|eot_id|>
    """
    messages = entry.get("messages", [])
    # Přidej system prompt pokud chybí
    if not messages or messages[0]["role"] != "system":
        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    return tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=False,
    )


# ─── Hlavní trénink ───────────────────────────────────────────────────────────

def train(args) -> None:
    # Lazy imports — potřeba jen na tréninkajícím stroji
    try:
        import torch
        from datasets import Dataset
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
        from transformers import (
            AutoModelForCausalLM,
            AutoTokenizer,
            BitsAndBytesConfig,
        )
        from trl import SFTTrainer, SFTConfig
    except ImportError as e:
        print(f"CHYBA: Chybí závislosti: {e}")
        print("Spusť: pip install -r requirements.txt")
        return

    print(f"PyTorch: {torch.__version__}")
    print(f"CUDA dostupné: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    # Auto-detect GPU config
    auto_bs, auto_ga, gpu_desc = detect_gpu_config()
    batch_size = args.batch_size if args.batch_size > 0 else auto_bs
    grad_accum = auto_ga
    print(f"GPU tier: {gpu_desc}")
    print(f"Batch size: {batch_size}, Gradient accumulation: {grad_accum}")
    print(f"Efektivní batch: {batch_size * grad_accum}")

    # 1. Načti dataset
    raw_data = load_dataset(args.dataset)

    # 2. Načti tokenizer
    print(f"\nNačítám tokenizer: {BASE_MODEL}")
    tokenizer = AutoTokenizer.from_pretrained(
        BASE_MODEL,
        trust_remote_code=True,
        padding_side="right",   # Pro causal LM
    )
    tokenizer.pad_token = tokenizer.eos_token  # Llama nemá pad token

    # 3. Formátuj do Llama-3 chat template
    print("Formátuji dataset...")
    texts = [format_for_llama3(entry, tokenizer) for entry in raw_data]

    hf_dataset = Dataset.from_dict({"text": texts})
    print(f"  → {len(texts)} tréninkových sekvencí")

    # Rozděl na train/eval (90/10)
    split = hf_dataset.train_test_split(test_size=0.1, seed=42)
    train_ds = split["train"]
    eval_ds  = split["test"]
    print(f"  Train: {len(train_ds)}, Eval: {len(eval_ds)}")

    # 4. Načti model s 4-bit quantization
    print(f"\nNačítám model: {BASE_MODEL} (4-bit QLoRA)...")
    # Novější transformers volají getattr(torch, dtype) — musí to být skutečný torch.dtype, ne řetězec.
    bnb_config = BitsAndBytesConfig(
        **{**BNB_CONFIG, "bnb_4bit_compute_dtype": torch.bfloat16}
    )

    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=bnb_config,
        device_map="auto",           # Automatické rozmístění na GPU
        trust_remote_code=True,
        attn_implementation="sdpa",   # Scaled Dot-Product Attention (PyTorch native)
    )
    model.config.use_cache = False  # Uvolní paměť při tréninku
    model.config.pretraining_tp = 1  # Tensor parallelism off

    # 5. Připrav pro k-bit trénink
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)
    model.gradient_checkpointing_enable()  # -40% VRAM

    # 6. Aplikuj LoRA
    lora_config = LoraConfig(**LORA_CONFIG)
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # 7. Training arguments
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    _dlw = os.environ.get("ZION_DATALOADER_WORKERS", "").strip()
    dataloader_num_workers = int(_dlw) if _dlw.isdigit() else 2

    training_args = SFTConfig(
        output_dir=str(output_dir),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        gradient_accumulation_steps=grad_accum,
        gradient_checkpointing=True,
        warmup_steps=20,
        learning_rate=2e-4,
        lr_scheduler_type="cosine",
        fp16=False,
        bf16=True,
        logging_steps=5,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=3,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        report_to="none",
        optim="paged_adamw_8bit",
        max_grad_norm=0.3,
        weight_decay=0.01,
        dataloader_pin_memory=(dataloader_num_workers > 0),
        dataloader_num_workers=dataloader_num_workers,
        # trl==0.9.x používá max_seq_length (ne max_length)
        max_seq_length=args.max_seq_length,
        packing=False,
        resume_from_checkpoint=args.resume if args.resume else None,
    )

    # 8. SFT Trainer s early stopping
    from transformers import EarlyStoppingCallback

    trainer = SFTTrainer(
        model=model,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        tokenizer=tokenizer,
        dataset_text_field="text",
        args=training_args,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
    )

    # 9. Trénuj
    print(f"\n🚀 Spoustím trénink: {args.epochs} epoch(y), batch={batch_size}, grad_accum={grad_accum}")
    print(f"   Efektivní batch: {batch_size * grad_accum}")
    print(f"   GPU tier: {gpu_desc}")
    print(f"   Gradient checkpointing: ON")
    print(f"   Early stopping: patience=2")
    print(f"   Výstup: {output_dir}")
    train_result = trainer.train(resume_from_checkpoint=args.resume if args.resume else None)

    # 10. Log metrics
    metrics = train_result.metrics
    print(f"\n📊 Tréninkové metriky:")
    for k, v in metrics.items():
        print(f"   {k}: {v}")

    # 11. Ulož LoRA adaptér
    print(f"\n💾 Ukládám LoRA adaptér do {output_dir}...")
    trainer.model.save_pretrained(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))

    # 12. Eval metriky
    if eval_ds:
        print("\n🔍 Final evaluation...")
        eval_metrics = trainer.evaluate()
        print(f"   Eval loss: {eval_metrics.get('eval_loss', 'N/A')}")
        import math
        if 'eval_loss' in eval_metrics:
            ppl = math.exp(eval_metrics['eval_loss'])
            print(f"   Perplexity: {ppl:.2f}")

    print(f"\n✅ Trénink dokončen!")
    print(f"   LoRA adaptér: {output_dir}")
    print(f"   Další krok: python merge_export.py --adapter {output_dir} --output outputs/zion-merged")


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="ZION QLoRA Fine-tuning")
    parser.add_argument("--dataset",         default="data/zion_train.jsonl",
                        help="Cesta k tréninkovému JSONL datasetu")
    parser.add_argument("--output",          default="outputs/zion-llama-lora",
                        help="Výstupní adresář pro LoRA adaptér")
    parser.add_argument("--epochs",          type=int,   default=3,
                        help="Počet epoch (default: 3)")
    parser.add_argument("--batch-size",      type=int,   default=0,
                        help="Batch size na GPU (0 = auto-detect dle VRAM)")
    parser.add_argument("--max-seq-length",  type=int,   default=2048,
                        help="Max délka sekvence v tokenech (default: 2048)")
    parser.add_argument("--resume",          default=None,
                        help="Cesta k checkpointu pro pokračování tréninku")
    parser.add_argument("--dry-run",         action="store_true",
                        help="Zkontroluj dataset a config bez spuštění tréninku")

    args = parser.parse_args()

    # Env override (Vast / CI): ZION_MAX_SEQ_LENGTH, ZION_EPOCHS
    _msl = os.environ.get("ZION_MAX_SEQ_LENGTH", "").strip()
    if _msl.isdigit():
        args.max_seq_length = int(_msl)
    _ep = os.environ.get("ZION_EPOCHS", "").strip()
    if _ep.isdigit():
        args.epochs = int(_ep)

    if args.dry_run:
        print("=== DRY RUN ===")
        data = load_dataset(args.dataset)
        print(f"Ukázka prvního záznamu:\n{json.dumps(data[0], ensure_ascii=False, indent=2)}")
        print(f"\nConfig:")
        print(f"  Model:      {BASE_MODEL}")
        print(f"  LoRA rank:  {LORA_CONFIG['r']}")
        print(f"  Epochs:     {args.epochs}")
        print(f"  Output:     {args.output}")
        est_time_min = len(data) * args.epochs * 0.03  # ~0.03 min/pár/epocha na A100
        est_cost = est_time_min / 60 * 1.29            # $1.29/hr A100 40GB
        print(f"\nOdhad tréninku: ~{est_time_min:.0f} min → ~${est_cost:.2f} na A100 40GB")
        return

    train(args)


if __name__ == "__main__":
    main()
