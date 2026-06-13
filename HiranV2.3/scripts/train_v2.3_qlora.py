#!/usr/bin/env python3
"""
Hiran v2.3 QLoRA Training Script
Trains Qwen3-32B with QLoRA (4-bit quantization + LoRA adapters).
Much faster and more reliable than Full FT. Fits on 1-2x A100 80GB.

Hardware Requirements:
- Minimum: 1x A100 80GB (QLoRA is efficient)
- Recommended: 2x A100 80GB for 2x speed with DDP
"""

import os
import sys
import json
import torch
import argparse
from pathlib import Path
from datetime import datetime

from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
)
from datasets import load_dataset
from peft import LoraConfig, get_peft_model, TaskType

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------

BASE_MODEL = "Qwen/Qwen3-32B"

STAGE_CONFIGS = {
    "stage1_factual": {
        "dataset": "data/curriculum/v2.3_combined_dataset.jsonl",
        "output_dir": "checkpoints/stage1_factual",
        "epochs": 3,
        "lr": 2e-4,  # Higher LR for LoRA
        "batch_size_per_gpu": 1,
        "grad_accum": 8,  # Lower than Full FT
        "warmup_steps": 100,
        "weight_decay": 0.01,
        "max_grad_norm": 0.3,
        "lr_scheduler": "cosine",
        "max_length": 1024,
    },
}

# LoRA Configuration
LORA_CONFIG = {
    "r": 64,
    "lora_alpha": 128,
    "target_modules": [
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    "lora_dropout": 0.05,
    "bias": "none",
    "task_type": TaskType.CAUSAL_LM,
    "use_rslora": True,  # Rank-stabilized LoRA for large models
}

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


def train_qlora(stage_name, stage_cfg):
    """Train with QLoRA (4-bit base + LoRA adapters)."""
    print(f"\n{'='*60}")
    print(f"QLoRA TRAINING: {stage_name}")
    print(f"{'='*60}")
    print(f"  Model: {BASE_MODEL} (32.8B parameters)")
    print(f"  Method: QLoRA (4-bit base + LoRA adapters)")
    print(f"  Trainable params: ~0.5-1% of total")
    print(f"  Dataset: {stage_cfg['dataset']}")
    print(f"  Epochs: {stage_cfg['epochs']} | LR: {stage_cfg['lr']}")
    print(f"  LoRA rank: {LORA_CONFIG['r']} | Alpha: {LORA_CONFIG['lora_alpha']}")
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

    # Load model (BF16, without 4-bit quantization for Qwen3 compatibility)
    # Note: Qwen3 has compatibility issues with transformers+BNB integration.
    # We use BF16 + LoRA instead, which still fits on 2x A100 80GB.
    print("\nLoading model (BF16 + LoRA, no 4-bit quantization)...")
    print("  Qwen3 has BNB compatibility issues; using BF16 + gradient checkpointing instead.")
    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        trust_remote_code=True,
        torch_dtype=torch.bfloat16,
    )

    # DDP (torchrun) handles device placement automatically
    # Do NOT call model.to() here

    # No prepare_model_for_kbit_training needed without quantization

    # Add LoRA adapters
    print(f"  Adding LoRA adapters (r={LORA_CONFIG['r']}, alpha={LORA_CONFIG['lora_alpha']})...")
    lora_config = LoraConfig(
        r=LORA_CONFIG["r"],
        lora_alpha=LORA_CONFIG["lora_alpha"],
        target_modules=LORA_CONFIG["target_modules"],
        lora_dropout=LORA_CONFIG["lora_dropout"],
        bias=LORA_CONFIG["bias"],
        task_type=LORA_CONFIG["task_type"],
        use_rslora=LORA_CONFIG["use_rslora"],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # Enable gradient checkpointing
    model.gradient_checkpointing_enable()

    # Load dataset
    dataset_path = Path(stage_cfg["dataset"])
    if not dataset_path.is_absolute():
        dataset_path = Path.cwd() / dataset_path

    tokenized_dataset = load_and_prepare_dataset(
        dataset_path, tokenizer, max_length=stage_cfg.get("max_length", 2048)
    )
    tokenized_dataset = tokenized_dataset.train_test_split(test_size=0.02, seed=42)

    # Training arguments (NO DeepSpeed needed for QLoRA)
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
        eval_strategy="steps",
        eval_steps=250,
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
        optim="adamw_torch",
        report_to="none",
        remove_unused_columns=False,
        dataloader_num_workers=4,
        dataloader_pin_memory=True,
        # Multi-GPU
        ddp_find_unused_parameters=False,
        ddp_bucket_cap_mb=50,
    )

    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,
    )

    print("\nInitializing QLoRA trainer...")
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset["train"],
        eval_dataset=tokenized_dataset["test"],
        data_collator=data_collator,
    )

    # Print memory info
    if torch.cuda.is_available():
        print(f"\nGPU Memory before training:")
        for i in range(torch.cuda.device_count()):
            mem = torch.cuda.get_device_properties(i).total_memory / 1e9
            allocated = torch.cuda.memory_allocated(i) / 1e9
            print(f"  GPU {i}: {allocated:.1f}GB / {mem:.1f}GB allocated")

    print("\nStarting QLoRA training...")
    print(f"  Estimated time: 8-12 hours on 2x A100 80GB")
    print(f"  Estimated time: 16-24 hours on 1x A100 80GB")
    print(f"  {'='*60}")

    trainer.train()

    # Save final model (merge adapters + base for inference)
    final_dir = output_dir / "final"
    print(f"\nSaving final model + adapters to {final_dir}...")
    model.save_pretrained(final_dir)
    tokenizer.save_pretrained(final_dir)

    # Also save merged model for inference
    merged_dir = output_dir / "final_merged"
    print(f"  Saving merged model (base + adapters) to {merged_dir}...")
    merged_model = model.merge_and_unload()
    merged_model.save_pretrained(merged_dir)
    tokenizer.save_pretrained(merged_dir)

    # Save config
    config = {
        "stage": stage_name,
        "base_model": BASE_MODEL,
        "method": "qlora",
        "lora_config": LORA_CONFIG,
        "timestamp": datetime.now().isoformat(),
        **{k: str(v) if isinstance(v, Path) else v for k, v in stage_cfg.items()},
    }
    with open(final_dir / "training_config.json", "w") as f:
        json.dump(config, f, indent=2, default=str)

    print(f"\n{'='*60}")
    print("QLoRA TRAINING COMPLETE!")
    print(f"{'='*60}")
    print(f"  Adapters saved: {final_dir}")
    print(f"  Merged model saved: {merged_dir}")
    print(f"  Best checkpoint: {trainer.state.best_model_checkpoint}")
    print(f"  Best eval loss: {trainer.state.best_metric}")
    print(f"\n  Next step: Evaluate with scripts/evaluate_v2.3.py")
    print(f"  Or quantize merged model to GGUF for inference")

    return str(final_dir)


def main():
    parser = argparse.ArgumentParser(description="Hiran v2.3 QLoRA Training")
    parser.add_argument(
        "--stage",
        type=str,
        choices=list(STAGE_CONFIGS.keys()) + ["all"],
        default="all",
        help="Which stage to train",
    )
    parser.add_argument(
        "--dry_run",
        action="store_true",
        help="Print config without training",
    )
    # Accept --local_rank for compatibility with torchrun/deepspeed launcher
    parser.add_argument(
        "--local_rank",
        type=int,
        default=-1,
        help="Local rank (set automatically by launcher)",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Hiran v2.3 QLoRA Training Pipeline")
    print("=" * 60)
    print(f"Base Model: {BASE_MODEL} (32.8B parameters)")
    print(f"Method: QLoRA (4-bit + LoRA adapters)")
    print(f"LoRA rank: {LORA_CONFIG['r']} | Alpha: {LORA_CONFIG['lora_alpha']}")
    print(f"Trainable: ~0.5-1% of parameters")
    print(f"Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}")
    print(f"GPUs available: {torch.cuda.device_count()}")
    print("=" * 60)

    if args.dry_run:
        print("\nDRY RUN -- configuration only:\n")
        for stage, cfg in STAGE_CONFIGS.items():
            print(f"\n{stage}:")
            for k, v in cfg.items():
                print(f"  {k}: {v}")
        print(f"\nLoRA config: {LORA_CONFIG}")
        return

    stages = [args.stage] if args.stage != "all" else list(STAGE_CONFIGS.keys())
    for stage_name in stages:
        train_qlora(stage_name, STAGE_CONFIGS[stage_name])


if __name__ == "__main__":
    main()
