#!/usr/bin/env python3
"""
Hiran v2.3 DORA Training Script
Trains DORA (Weight-Decomposed Low-Rank Adaptation) adapters on Nemotron-32B.
Uses 8-bit quantization for base model to fit on single A100 80GB.
"""

import os
import sys
import json
import torch
import argparse
from pathlib import Path
from datetime import datetime

# ---------------------------------------------------------------------------
# Dependencies (install before training):
#   pip install transformers accelerate peft bitsandbytes trl datasets
# ---------------------------------------------------------------------------

from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
    BitsAndBytesConfig,
)
from peft import (
    LoraConfig,
    get_peft_model,
    PeftModel,
    TaskType,
    prepare_model_for_kbit_training,
)
from datasets import load_dataset

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------

BASE_MODEL = "Qwen/Qwen3-32B"

STAGE_CONFIGS = {
    "stage1_factual": {
        "dataset": "data/curriculum/stage1_factual_reinforcement.jsonl",
        "output_dir": "checkpoints/stage1_factual",
        "rank": 512,
        "alpha": 362,  # rsLoRA: rank^0.5 * 16 ≈ 362
        "dropout": 0.05,
        "epochs": 5,
        "lr": 1e-4,
        "batch_size": 1,
        "grad_accum": 16,
        "warmup_steps": 500,
        "weight_decay": 0.01,
        "max_grad_norm": 1.0,
        "lr_scheduler": "cosine_with_restarts",
        "target_modules": "all-linear",
        "use_rslora": True,
    },
    "stage2_domain": {
        "dataset": "data/curriculum/stage2_domain_expertise.jsonl",
        "output_dir": "checkpoints/stage2_domain",
        "rank": 512,
        "alpha": 362,
        "dropout": 0.03,
        "epochs": 3,
        "lr": 5e-5,
        "batch_size": 1,
        "grad_accum": 16,
        "warmup_steps": 300,
        "weight_decay": 0.01,
        "max_grad_norm": 1.0,
        "lr_scheduler": "cosine",
        "target_modules": "all-linear",
        "use_rslora": True,
        "continue_from": "checkpoints/stage1_factual/final",
    },
    "stage3_cross": {
        "dataset": "data/curriculum/stage3_cross_domain.jsonl",
        "output_dir": "checkpoints/stage3_cross",
        "rank": 512,
        "alpha": 362,
        "dropout": 0.02,
        "epochs": 2,
        "lr": 2e-5,
        "batch_size": 1,
        "grad_accum": 16,
        "warmup_steps": 200,
        "weight_decay": 0.01,
        "max_grad_norm": 1.0,
        "lr_scheduler": "cosine",
        "target_modules": "all-linear",
        "use_rslora": True,
        "continue_from": "checkpoints/stage2_domain/final",
    },
}

# 8-bit quantization config for base model
BNB_CONFIG = BitsAndBytesConfig(
    load_in_8bit=True,
    bnb_8bit_use_double_quant=True,
    bnb_8bit_quant_type="nf4",
    bnb_8bit_compute_dtype=torch.bfloat16,
)

# Nemotron-32B uses Qwen2.5 chat template
CHAT_TEMPLATE = "{% for message in messages %}{% if loop.first and messages[0]['role'] != 'system' %}{{ '<|im_start|>system\nYou are a helpful assistant.<|im_end|>\n' }}{% endif %}{{ '<|im_start|>' + message['role'] + '\n' + message['content'] + '<|im_end|>' + '\n' }}{% endfor %}{% if add_generation_prompt %}{{ '<|im_start|>assistant\n' }}{% endif %}"


def format_instruction_to_messages(instruction, output):
    """Convert instruction/output to chat messages for Nemotron/Qwen format."""
    # Detect if instruction already contains system prompt
    if "<|system|>" in instruction:
        # Parse existing system prompt
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
    """Load JSONL dataset and tokenize."""
    print(f"Loading dataset from {dataset_path}...")

    dataset = load_dataset("json", data_files=str(dataset_path), split="train")
    print(f"  Loaded {len(dataset)} examples")

    def tokenize_function(examples):
        # Format as chat
        texts = []
        for inst, out in zip(examples["instruction"], examples["output"]):
            messages = format_instruction_to_messages(inst, out)
            text = tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=False,
            )
            texts.append(text)

        # Tokenize
        tokenized = tokenizer(
            texts,
            truncation=True,
            max_length=max_length,
            padding="max_length",
            return_tensors=None,
        )
        tokenized["labels"] = tokenized["input_ids"].copy()
        return tokenized

    # Process in batches
    tokenized_dataset = dataset.map(
        tokenize_function,
        batched=True,
        remove_columns=dataset.column_names,
        num_proc=4,
    )

    print(f"  Tokenized dataset ready")
    return tokenized_dataset


def get_dora_config(stage_cfg):
    """Create DORA LoraConfig from stage config."""
    use_rslora = stage_cfg.get("use_rslora", False)

    return LoraConfig(
        r=stage_cfg["rank"],
        lora_alpha=stage_cfg["alpha"],
        target_modules=stage_cfg.get("target_modules", "all-linear"),
        lora_dropout=stage_cfg["dropout"],
        bias="none",
        task_type=TaskType.CAUSAL_LM,
        use_rslora=use_rslora,
        # DORA specific: use_dora=True enables weight decomposition
        use_dora=True,
        # Train all layers for maximum adaptability
        modules_to_save=None,
    )


def train_stage(stage_name, stage_cfg, base_model_path=None):
    """Train a single curriculum stage."""
    print(f"\n{'='*60}")
    print(f"Training Stage: {stage_name}")
    print(f"{'='*60}")
    print(f"  Dataset: {stage_cfg['dataset']}")
    print(f"  Output: {stage_cfg['output_dir']}")
    print(f"  Rank: {stage_cfg['rank']} | Alpha: {stage_cfg['alpha']}")
    print(f"  Epochs: {stage_cfg['epochs']} | LR: {stage_cfg['lr']}")
    print(f"  Batch: {stage_cfg['batch_size']} × {stage_cfg['grad_accum']} steps")
    print(f"  Method: DORA {'+ rsLoRA' if stage_cfg.get('use_rslora') else ''}")

    output_dir = Path(stage_cfg["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    # Determine base model to load
    if base_model_path and Path(base_model_path).exists():
        load_path = base_model_path
        print(f"  Loading from previous stage: {load_path}")
    else:
        load_path = BASE_MODEL
        print(f"  Loading base model: {load_path}")

    # Load tokenizer
    print("\nLoading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        BASE_MODEL,  # Always use base model tokenizer
        trust_remote_code=True,
        padding_side="right",
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        tokenizer.pad_token_id = tokenizer.eos_token_id

    # Apply chat template if not present
    if not hasattr(tokenizer, "chat_template") or tokenizer.chat_template is None:
        tokenizer.chat_template = CHAT_TEMPLATE

    # Load model
    print(f"Loading model (8-bit quantized)...")
    model = AutoModelForCausalLM.from_pretrained(
        load_path,
        quantization_config=BNB_CONFIG,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.bfloat16,
        attn_implementation="flash_attention_2" if torch.cuda.is_available() else None,
    )

    # Prepare for k-bit training
    model = prepare_model_for_kbit_training(model)

    # Apply DORA config
    print("Applying DORA configuration...")
    lora_config = get_dora_config(stage_cfg)
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # Load dataset
    dataset_path = Path(stage_cfg["dataset"])
    if not dataset_path.is_absolute():
        dataset_path = Path.cwd() / dataset_path

    tokenized_dataset = load_and_prepare_dataset(dataset_path, tokenizer)

    # Split train/val
    tokenized_dataset = tokenized_dataset.train_test_split(test_size=0.05, seed=42)
    train_dataset = tokenized_dataset["train"]
    eval_dataset = tokenized_dataset["test"]

    # Training arguments
    training_args = TrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=stage_cfg["epochs"],
        per_device_train_batch_size=stage_cfg["batch_size"],
        per_device_eval_batch_size=stage_cfg["batch_size"],
        gradient_accumulation_steps=stage_cfg["grad_accum"],
        learning_rate=stage_cfg["lr"],
        weight_decay=stage_cfg["weight_decay"],
        warmup_steps=stage_cfg["warmup_steps"],
        lr_scheduler_type=stage_cfg.get("lr_scheduler", "cosine"),
        max_grad_norm=stage_cfg["max_grad_norm"],
        evaluation_strategy="steps",
        eval_steps=100,
        save_strategy="steps",
        save_steps=100,
        save_total_limit=3,
        logging_steps=10,
        logging_first_step=True,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        bf16=True,
        fp16=False,
        gradient_checkpointing=True,
        optim="adamw_8bit",
        group_by_length=True,
        report_to=["tensorboard"],
        remove_unused_columns=False,
        dataloader_num_workers=4,
        dataloader_pin_memory=True,
    )

    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,
    )

    # Trainer
    print("\nInitializing trainer...")
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=data_collator,
        tokenizer=tokenizer,
    )

    # Train
    print("\nStarting training...")
    trainer.train()

    # Save final adapter
    final_dir = output_dir / "final"
    print(f"\nSaving final adapter to {final_dir}...")
    model.save_pretrained(final_dir)
    tokenizer.save_pretrained(final_dir)

    # Save training config
    config = {
        "stage": stage_name,
        "base_model": BASE_MODEL,
        "timestamp": datetime.now().isoformat(),
        **{k: str(v) if isinstance(v, Path) else v for k, v in stage_cfg.items()},
        "trainable_params": model.print_trainable_parameters(),
    }
    with open(final_dir / "training_config.json", "w") as f:
        json.dump(config, f, indent=2, default=str)

    print(f"\nStage {stage_name} complete!")
    print(f"  Final adapter saved: {final_dir}")
    print(f"  Best checkpoint: {trainer.state.best_model_checkpoint}")
    print(f"  Best eval loss: {trainer.state.best_metric}")

    return str(final_dir)


def main():
    parser = argparse.ArgumentParser(description="Hiran v2.3 DORA Training")
    parser.add_argument(
        "--stage",
        type=str,
        choices=list(STAGE_CONFIGS.keys()) + ["all"],
        default="all",
        help="Which stage to train (or 'all')",
    )
    parser.add_argument(
        "--resume_from",
        type=str,
        default=None,
        help="Resume from a specific checkpoint directory",
    )
    parser.add_argument(
        "--dry_run",
        action="store_true",
        help="Print config without training",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Hiran v2.3 DORA Training Pipeline")
    print("=" * 60)
    print(f"Base Model: {BASE_MODEL}")
    print(f"Method: DORA (8-bit base + rank-512 adapters)")
    print(f"Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}")
    print(f"CUDA: {torch.cuda.is_available()}")
    print(f"CUDA Version: {torch.version.cuda if torch.cuda.is_available() else 'N/A'}")
    print("=" * 60)

    if args.dry_run:
        print("\nDRY RUN — configuration only:\n")
        stages = [args.stage] if args.stage != "all" else list(STAGE_CONFIGS.keys())
        for stage in stages:
            cfg = STAGE_CONFIGS[stage]
            print(f"\n{stage}:")
            for k, v in cfg.items():
                print(f"  {k}: {v}")
        return

    # Training loop
    stages_to_train = [args.stage] if args.stage != "all" else list(STAGE_CONFIGS.keys())
    previous_checkpoint = args.resume_from

    for stage_name in stages_to_train:
        stage_cfg = STAGE_CONFIGS[stage_name].copy()

        # Override continue_from if resuming
        if previous_checkpoint:
            stage_cfg["continue_from"] = previous_checkpoint

        final_path = train_stage(
            stage_name,
            stage_cfg,
            base_model_path=stage_cfg.get("continue_from"),
        )
        previous_checkpoint = final_path

    print(f"\n{'='*60}")
    print("ALL STAGES COMPLETE")
    print(f"{'='*60}")
    print(f"Final checkpoint: {previous_checkpoint}")
    print("Next step: merge adapters with scripts/merge_model.py")


if __name__ == "__main__":
    main()
