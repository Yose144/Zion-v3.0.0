#!/usr/bin/env python3
"""
ZION AI Native — QLoRA Fine-tuning skript pro A100
===================================================

Trénuje vlastní verzi Llama-3.1-8B na ZION-specifickém datasetu.
Používá QLoRA (4-bit quantization + LoRA adaptery) — minimální VRAM.

Hardware:
  - A100 40GB PCIe  (~$1.29/hr na Lambda Labs) — doporučeno
  - A100 80GB SXM   (~$1.99/hr)                — pro větší batch size
  - RTX 4090 24GB   (vlastní stroj)            — možné s menším batch

Čas tréninku:
  - 500 párů, 3 epochy, A100 40GB → ~15–25 minut → ~$0.35

Výstup:
  - outputs/zion-llama-lora/       — LoRA adaptér weights
  - outputs/zion-llama-merged/     — sloučený model (pro Ollama)

Použití
-------
    # Na Lambda Labs / RunPod (po naklonování projektu):
    pip install -r requirements.txt
    huggingface-cli login   # potřeba pro Llama-3 gated model

    python finetune_lora.py \\
        --dataset data/zion_train.jsonl \\
        --output  outputs/zion-llama-lora \\
        --epochs  3

    # Merge a export do GGUF pro Ollama:
    python merge_export.py \\
        --adapter outputs/zion-llama-lora \\
        --output  outputs/zion-llama-merged
"""

import argparse
import json
import os
from pathlib import Path

# ─── Konfigurace ─────────────────────────────────────────────────────────────

BASE_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct"  # HuggingFace model ID

# QLoRA parametry — optimalizováno pro A100 40GB
LORA_CONFIG = {
    "r": 16,               # LoRA rank — vyšší = více kapacity modelu
    "lora_alpha": 32,      # Škálování (typicky 2× rank)
    "lora_dropout": 0.1,   # Regularizace
    "bias": "none",
    "task_type": "CAUSAL_LM",
    # Cílové moduly — pro Llama-3 architekturu
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
    "Jsi ZION blockchain expert a AI Native agent. "
    "Odpovídáš přesně, technicky a v češtině."
)


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
            TrainingArguments,
        )
        from trl import SFTTrainer
    except ImportError as e:
        print(f"CHYBA: Chybí závislosti: {e}")
        print("Spusť: pip install -r requirements.txt")
        return

    print(f"PyTorch: {torch.__version__}")
    print(f"CUDA dostupné: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

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
    bnb_config = BitsAndBytesConfig(**BNB_CONFIG)

    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=bnb_config,
        device_map="auto",           # Automatické rozmístění na GPU
        trust_remote_code=True,
        attn_implementation="flash_attention_2",  # Flash Attention 2 na A100
    )
    model.config.use_cache = False  # Uvolní paměť při tréninku

    # 5. Připrav pro k-bit trénink
    model = prepare_model_for_kbit_training(model)

    # 6. Aplikuj LoRA
    lora_config = LoraConfig(**LORA_CONFIG)
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # 7. Training arguments
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=4,   # Efektivní batch = batch_size × 4
        warmup_ratio=0.05,
        learning_rate=2e-4,              # Typické pro QLoRA
        lr_scheduler_type="cosine",
        fp16=False,
        bf16=True,          # BF16 na A100 — lepší než FP16
        logging_steps=10,
        eval_strategy="steps",
        eval_steps=50,
        save_strategy="steps",
        save_steps=100,
        save_total_limit=2,
        load_best_model_at_end=True,
        report_to="none",   # Vypni wandb
        optim="paged_adamw_8bit",  # 8-bit AdamW — ušetří VRAM
        max_grad_norm=0.3,
        weight_decay=0.001,
        group_by_length=True,   # Seskup podobně dlouhé sekvence → méně paddingu
    )

    # 8. SFT Trainer
    trainer = SFTTrainer(
        model=model,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        tokenizer=tokenizer,
        args=training_args,
        dataset_text_field="text",
        max_seq_length=args.max_seq_length,
        packing=True,        # Packing sekvencí → vyšší GPU utilization
    )

    # 9. Trénuj
    print(f"\n🚀 Spouštím trénink: {args.epochs} epoch(y), batch={args.batch_size}")
    print(f"   Výstup: {output_dir}")
    trainer.train()

    # 10. Ulož LoRA adaptér
    print(f"\n💾 Ukládám LoRA adaptér do {output_dir}...")
    trainer.model.save_pretrained(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))

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
    parser.add_argument("--batch-size",      type=int,   default=4,
                        help="Batch size na GPU (default: 4; snižuj pokud OOM)")
    parser.add_argument("--max-seq-length",  type=int,   default=2048,
                        help="Max délka sekvence v tokenech (default: 2048)")
    parser.add_argument("--dry-run",         action="store_true",
                        help="Zkontroluj dataset a config bez spuštění tréninku")

    args = parser.parse_args()

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
