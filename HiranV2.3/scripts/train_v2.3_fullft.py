#!/usr/bin/env python3
"""
Hiran v2.3 FULL FINE-TUNING Script
Trains Nemotron-32B with FULL parameter updates using DeepSpeed ZeRO-3.
This is NOT LoRA/DORA - all 32B parameters are updated.

Hardware Requirements:
- Minimum: 2x A100 80GB with DeepSpeed ZeRO-3 + CPU offload
- Recommended: 4x A100 80GB for faster training
- Alternative: 1x A100 80GB with aggressive CPU/NVMe offload (slow)
"""

import os
import sys
import json
import torch
import argparse
from pathlib import Path
from datetime import datetime

# Dependencies:
#   pip install transformers accelerate datasets
#   pip install deepspeed
#   (flash-attn optional but recommended)

from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
)
from datasets import load_dataset

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------

BASE_MODEL = "Qwen/Qwen3-32B"

STAGE_CONFIGS = {
    "stage1_factual": {
        "dataset": "data/curriculum/v2.3_combined_dataset.jsonl",
        "output_dir": "checkpoints/stage1_factual",
        "epochs": 3,
        "lr": 2e-5,
        "batch_size_per_gpu": 1,
        "grad_accum": 32,
        "warmup_steps": 500,
        "weight_decay": 0.01,
        "max_grad_norm": 1.0,
        "lr_scheduler": "cosine_with_restarts",
    },
}

# Nemotron-32B uses Qwen2.5 chat template
CHAT_TEMPLATE = "{% for message in messages %}{% if loop.first and messages[0]['role'] != 'system' %}{{ '<|im_start|>system\nYou are a helpful assistant.\n' }}{% endif %}{{ '<|im_start|>' + message['role'] + '\n' + message['content'] + '<|im_end|>' + '\n' }}{% endfor %}{% if add_generation_prompt %}{{ '<|im_start|>assistant\n' }}{% endif %}"


def format_instruction_to_messages(instruction, output):
    """Convert instruction/output to chat messages."""
    if "<|system|>" in instruction:
        parts = instruction.split("<|user|>")
        if len(parts) >= 2:
            system = parts[0].replace("<|system|>", "").strip()
            user_msg = parts[1].replace("<|assistant|>", "").strip()
            return [
                {"role": "system", "content": system},
                {"role": "user", "content": user_msg},
                {"role": "assistant", "content": output},
            ]
    return [
        {"role": "system", "content": "You are the Zion DAO technical assistant. Answer accurately and concisely about Zion blockchain, DAO governance, mining pools, and humanitarian funding."},
        {"role": "user", "content": instruction},
        {"role": "assistant", "content": output},
    ]


def load_and_prepare_dataset(dataset_path, tokenizer, max_length=2048):
    """Load and tokenize dataset."""
    print(f"Loading dataset from {dataset_path}...")
    dataset = load_dataset("json", data_files=str(dataset_path), split="train")
    print(f"  Loaded {len(dataset)} examples")

    def tokenize_function(examples):
        texts = []
        for inst, out in zip(examples["instruction"], examples["output"]):
            messages = format_instruction_to_messages(inst, out)
            text = tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=False,
            )
            texts.append(text)

        tokenized = tokenizer(
            texts,
            truncation=True,
            max_length=max_length,
            padding="max_length",
            return_tensors=None,
        )
        tokenized["labels"] = tokenized["input_ids"].copy()
        return tokenized

    tokenized = dataset.map(
        tokenize_function,
        batched=True,
        remove_columns=dataset.column_names,
        num_proc=4,
    )
    print(f"  Tokenized dataset ready")
    return tokenized


def train_full_ft(stage_name, stage_cfg, deepspeed_config="config/deepspeed_zero3.json"):
    """Train with full fine-tuning using DeepSpeed ZeRO-3."""
    print(f"\n{'='*60}")
    print(f"FULL FINE-TUNING: {stage_name}")
    print(f"{'='*60}")
    print(f"  Model: {BASE_MODEL} (32.8B parameters)")
    print(f"  Method: FULL parameter update (NOT LoRA/DORA)")
    print(f"  DeepSpeed: ZeRO-3 with CPU offload")
    print(f"  Dataset: {stage_cfg['dataset']}")
    print(f"  Epochs: {stage_cfg['epochs']} | LR: {stage_cfg['lr']}")
    print(f"  Batch: {stage_cfg['batch_size_per_gpu']} per GPU x {stage_cfg['grad_accum']} accum")

    output_dir = Path(stage_cfg["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load tokenizer
    print("\nLoading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        BASE_MODEL,
        trust_remote_code=True,
        padding_side="right",
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        tokenizer.pad_token_id = tokenizer.eos_token_id
    if not hasattr(tokenizer, "chat_template") or tokenizer.chat_template is None:
        tokenizer.chat_template = CHAT_TEMPLATE

    # Load model (NO quantization - full FT requires full precision)
    print(f"\nLoading model (BF16, NO quantization)...")
    print(f"  This requires significant VRAM. DeepSpeed will shard across GPUs.")
    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        torch_dtype=torch.bfloat16,
        trust_remote_code=True,
    )

    # Enable gradient checkpointing for memory savings
    model.gradient_checkpointing_enable()
    model.enable_input_require_grads()

    # Load dataset
    dataset_path = Path(stage_cfg["dataset"])
    if not dataset_path.is_absolute():
        dataset_path = Path.cwd() / dataset_path

    tokenized_dataset = load_and_prepare_dataset(dataset_path, tokenizer)
    tokenized_dataset = tokenized_dataset.train_test_split(test_size=0.02, seed=42)

    # Training arguments with DeepSpeed
    training_args = TrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=stage_cfg["epochs"],
        per_device_train_batch_size=stage_cfg["batch_size_per_gpu"],
        per_device_eval_batch_size=stage_cfg["batch_size_per_gpu"],
        gradient_accumulation_steps=stage_cfg["grad_accum"],
        learning_rate=stage_cfg["lr"],
        weight_decay=stage_cfg["weight_decay"],
        warmup_steps=stage_cfg["warmup_steps"],
        lr_scheduler_type=stage_cfg.get("lr_scheduler", "cosine"),
        max_grad_norm=stage_cfg["max_grad_norm"],
        evaluation_strategy="steps",
        eval_steps=200,
        save_strategy="steps",
        save_steps=500,
        save_total_limit=3,
        logging_steps=10,
        logging_first_step=True,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        bf16=True,
        fp16=False,
        deepspeed=str(deepspeed_config) if Path(deepspeed_config).exists() else None,
        optim="adamw_torch",
        group_by_length=True,
        report_to=["tensorboard"],
        remove_unused_columns=False,
        dataloader_num_workers=4,
        dataloader_pin_memory=True,
        # FSDP config for multi-node
        fsdp=["full_shard", "auto_wrap"] if not Path(deepspeed_config).exists() else "",
        fsdp_config={
            "min_num_params": 1e8,
            "backward_prefetch": "backward_pre",
            "cpu_offload": True,
        } if not Path(deepspeed_config).exists() else None,
    )

    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,
    )

    print("\nInitializing trainer with DeepSpeed...")
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset["train"],
        eval_dataset=tokenized_dataset["test"],
        data_collator=data_collator,
        tokenizer=tokenizer,
    )

    # Print memory info
    if torch.cuda.is_available():
        print(f"\nGPU Memory before training:")
        for i in range(torch.cuda.device_count()):
            mem = torch.cuda.get_device_properties(i).total_memory / 1e9
            allocated = torch.cuda.memory_allocated(i) / 1e9
            print(f"  GPU {i}: {allocated:.1f}GB / {mem:.1f}GB allocated")

    print("\nStarting FULL FINE-TUNING...")
    print("  This will update ALL 32.8 billion parameters.")
    print("  Estimated time: 24-48 hours on 4x A100 80GB")
    print("  Estimated time: 48-96 hours on 2x A100 80GB")
    print(f"  {'='*60}")

    trainer.train()

    # Save final model
    final_dir = output_dir / "final"
    print(f"\nSaving final model to {final_dir}...")
    trainer.save_model(final_dir)
    tokenizer.save_pretrained(final_dir)

    # Save config
    config = {
        "stage": stage_name,
        "base_model": BASE_MODEL,
        "method": "full_fine_tuning",
        "deepspeed": str(deepspeed_config),
        "timestamp": datetime.now().isoformat(),
        **{k: str(v) if isinstance(v, Path) else v for k, v in stage_cfg.items()},
    }
    with open(final_dir / "training_config.json", "w") as f:
        json.dump(config, f, indent=2, default=str)

    print(f"\n{'='*60}")
    print("FULL FINE-TUNING COMPLETE!")
    print(f"{'='*60}")
    print(f"  Model saved: {final_dir}")
    print(f"  Best checkpoint: {trainer.state.best_model_checkpoint}")
    print(f"  Best eval loss: {trainer.state.best_metric}")
    print(f"\n  Next step: Evaluate with scripts/evaluate_v2.3.py")
    print(f"  Or quantize to GGUF for inference")

    return str(final_dir)


def main():
    parser = argparse.ArgumentParser(description="Hiran v2.3 Full Fine-Tuning")
    parser.add_argument(
        "--stage",
        type=str,
        choices=list(STAGE_CONFIGS.keys()) + ["all"],
        default="all",
        help="Which stage to train",
    )
    parser.add_argument(
        "--deepspeed_config",
        type=str,
        default="config/deepspeed_zero3.json",
        help="Path to DeepSpeed config",
    )
    parser.add_argument(
        "--dry_run",
        action="store_true",
        help="Print config without training",
    )
    # DeepSpeed launcher injects --local_rank; accept but ignore it
    parser.add_argument(
        "--local_rank",
        type=int,
        default=-1,
        help="Local rank (set automatically by DeepSpeed)",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Hiran v2.3 FULL FINE-TUNING Pipeline")
    print("=" * 60)
    print(f"Base Model: {BASE_MODEL} (32.8B parameters)")
    print(f"Method: FULL parameter update (NOT LoRA/DORA)")
    print(f"DeepSpeed: ZeRO-3 with CPU offload")
    print(f"Hardware needed: 2-4x A100 80GB recommended")
    print(f"Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}")
    print(f"GPUs available: {torch.cuda.device_count()}")
    print("=" * 60)

    if args.dry_run:
        print("\nDRY RUN — configuration only:\n")
        for stage, cfg in STAGE_CONFIGS.items():
            print(f"\n{stage}:")
            for k, v in cfg.items():
                print(f"  {k}: {v}")
        print(f"\nDeepSpeed config: {args.deepspeed_config}")
        return

    if torch.cuda.device_count() < 2:
        print("\nWARNING: Only 1 GPU detected!")
        print("Full fine-tuning 32B model on single GPU requires:")
        print("  - DeepSpeed ZeRO-3 + aggressive CPU offload")
        print("  - OR use the DORA script (train_v2.3.py) instead")
        print("\nContinue anyway? This may be extremely slow or OOM.")
        # Don't block, just warn

    stages = [args.stage] if args.stage != "all" else list(STAGE_CONFIGS.keys())
    for stage_name in stages:
        train_full_ft(stage_name, STAGE_CONFIGS[stage_name], args.deepspeed_config)


if __name__ == "__main__":
    main()
