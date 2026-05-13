#!/usr/bin/env python3
"""
Hiran v2.3 Training Script
===========================
DeepSpeed-enabled multi-stage curriculum training for Llama 3.1 70B.
Supports LoRA + optional full fine-tune on later stages.

Usage:
    # Single node, 8 GPUs
    deepspeed scripts/train_v2.3.py \
        --base_model meta-llama/Llama-3.1-70B-Instruct \
        --curriculum_config config/curriculum_v2.3.json \
        --deepspeed_config config/deepspeed_config.json \
        --output_dir checkpoints

    # Dry run / test on small model
    python scripts/train_v2.3.py --base_model meta-llama/Llama-3.1-8B-Instruct \
        --dry_run --max_steps 10

    # Resume from checkpoint
    python scripts/train_v2.3.py --resume_from_checkpoint checkpoints/stage_2/checkpoint-500

Requirements:
    torch>=2.1.0 transformers>=4.40.0 peft>=0.11.0 deepspeed>=0.14.0
    bitsandbytes>=0.43.0 accelerate>=0.30.0
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any

import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
    set_seed,
)
from peft import LoraConfig, get_peft_model, TaskType, PeftModel
from datasets import Dataset

logger = logging.getLogger("hiran_v2.3_train")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def setup_logging(level: int = logging.INFO) -> None:
    logging.basicConfig(
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        level=level,
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def load_curriculum_config(path: Path) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_dataset_for_stage(stage_cfg: dict[str, Any], data_dir: Path) -> Dataset:
    dataset_file = data_dir / stage_cfg.get("dataset", f"{stage_cfg['name']}.jsonl")
    if not dataset_file.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_file}")

    records = []
    with open(dataset_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            # Build prompt in Llama 3.1 chat format
            instruction = obj.get("instruction", "")
            output = obj.get("output", "")
            text = (
                "<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n"
                f"{instruction}<|eot_id|>"
                "<|start_header_id|>assistant<|end_header_id|>\n\n"
                f"{output}<|eot_id|>"
            )
            records.append({"text": text})

    return Dataset.from_list(records)


def create_lora_config(stage_cfg: dict[str, Any]) -> LoraConfig:
    target_modules = stage_cfg.get("target_modules", ["q_proj", "v_proj"])
    if target_modules == ["all"]:
        target_modules = [
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ]
    return LoraConfig(
        r=stage_cfg.get("rank", 128),
        lora_alpha=stage_cfg.get("alpha", 256),
        target_modules=target_modules,
        lora_dropout=stage_cfg.get("dropout", 0.05),
        bias="none",
        task_type=TaskType.CAUSAL_LM,
        use_rslora=True,  # Rank-stabilized LoRA for large ranks
    )


# ---------------------------------------------------------------------------
# Stage training
# ---------------------------------------------------------------------------

def train_stage(
    model,
    tokenizer,
    stage_cfg: dict[str, Any],
    data_dir: Path,
    output_dir: Path,
    training_config: dict[str, Any],
    deepspeed_config: Path | None = None,
    resume_from: str | None = None,
    dry_run: bool = False,
) -> Path:
    stage_name = stage_cfg["name"]
    stage_output = output_dir / stage_name
    stage_output.mkdir(parents=True, exist_ok=True)

    logger.info(f"--- Stage: {stage_name} ---")
    logger.info(f"  Output: {stage_output}")
    logger.info(f"  Rank: {stage_cfg.get('rank')}, Alpha: {stage_cfg.get('alpha')}")

    # Load dataset
    logger.info("  Loading dataset...")
    dataset = load_dataset_for_stage(stage_cfg, data_dir)
    logger.info(f"  Dataset size: {len(dataset)}")

    if dry_run:
        dataset = dataset.select(range(min(20, len(dataset))))
        stage_cfg["max_steps"] = 10
        logger.info("  DRY RUN: truncated to 20 samples, 10 steps")

    # Training arguments
    max_steps = stage_cfg.get("max_steps", 1000)
    batch_size = stage_cfg.get("batch_size", 1)
    grad_accum = stage_cfg.get("gradient_accumulation_steps", 8)
    lr = stage_cfg.get("learning_rate", 1e-5)
    warmup = stage_cfg.get("warmup_steps", 100)

    train_args = TrainingArguments(
        output_dir=str(stage_output),
        overwrite_output_dir=True,
        num_train_epochs=stage_cfg.get("epochs", 2),
        max_steps=max_steps if not dry_run else 10,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=grad_accum,
        learning_rate=lr,
        warmup_steps=warmup,
        logging_steps=stage_cfg.get("logging_steps", 10),
        save_steps=stage_cfg.get("save_steps", 100),
        eval_strategy="no",
        save_strategy="steps",
        save_total_limit=3,
        load_best_model_at_end=False,
        bf16=training_config.get("bf16", True),
        fp16=training_config.get("fp16", False),
        gradient_checkpointing=training_config.get("gradient_checkpointing", True),
        gradient_clipping=training_config.get("gradient_clipping", 1.0),
        weight_decay=training_config.get("weight_decay", 0.01),
        lr_scheduler_type=training_config.get("lr_scheduler_type", "cosine"),
        report_to=["tensorboard"],
        logging_dir=str(stage_output / "logs"),
        deepspeed=str(deepspeed_config) if deepspeed_config else None,
        dataloader_num_workers=4,
        remove_unused_columns=False,
        resume_from_checkpoint=resume_from,
    )

    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,
    )

    trainer = Trainer(
        model=model,
        args=train_args,
        train_dataset=dataset,
        data_collator=data_collator,
    )

    logger.info("  Starting training...")
    start = time.time()
    result = trainer.train(resume_from_checkpoint=resume_from)
    elapsed = time.time() - start
    logger.info(f"  Training complete: {result.metrics}")
    logger.info(f"  Elapsed: {elapsed / 60:.1f} min")

    # Save final adapter
    adapter_dir = stage_output / "final_adapter"
    model.save_pretrained(str(adapter_dir))
    tokenizer.save_pretrained(str(adapter_dir))
    logger.info(f"  Adapter saved to {adapter_dir}")

    # Save stage metrics
    metrics_path = stage_output / "stage_metrics.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump({
            "stage": stage_name,
            "metrics": result.metrics,
            "elapsed_seconds": elapsed,
            "adapter_dir": str(adapter_dir),
        }, f, indent=2)

    return adapter_dir


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Hiran v2.3 Training")
    parser.add_argument("--base_model", required=True, help="Base model HF name or local path")
    parser.add_argument("--curriculum_config", default="HiranV2.3/config/curriculum_v2.3.json")
    parser.add_argument("--deepspeed_config", default="HiranV2.3/config/deepspeed_config.json")
    parser.add_argument("--data_dir", default="HiranV2.3/data/curriculum")
    parser.add_argument("--output_dir", default="HiranV2.3/checkpoints")
    parser.add_argument("--resume_from_checkpoint", default=None)
    parser.add_argument("--stages", default="all", help="Comma-separated stage names or 'all'")
    parser.add_argument("--dry_run", action="store_true", help="Quick test run")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    setup_logging(logging.DEBUG if args.dry_run else logging.INFO)
    set_seed(args.seed)

    curriculum = load_curriculum_config(Path(args.curriculum_config))
    stages = curriculum["stages"]
    training_config = curriculum.get("training_config", {})
    deepspeed_path = Path(args.deepspeed_config) if args.deepspeed_config else None
    data_dir = Path(args.data_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Filter stages
    if args.stages != "all":
        selected = {s.strip() for s in args.stages.split(",")}
        stages = [s for s in stages if s["name"] in selected]

    logger.info(f"Stages to train: {[s['name'] for s in stages]}")
    logger.info(f"Base model: {args.base_model}")

    # Load base model + tokenizer
    logger.info("Loading base model and tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Load with DeepSpeed will happen via Trainer
    # For initialization we load normally; DeepSpeed handles partitioning
    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        torch_dtype=torch.bfloat16 if training_config.get("bf16") else torch.float16,
        trust_remote_code=True,
        attn_implementation="flash_attention_2" if not args.dry_run else "eager",
    )

    # Apply LoRA to base model (will be saved per stage)
    lora_cfg = create_lora_config(stages[0])  # Initial LoRA config
    model = get_peft_model(model, lora_cfg)
    model.print_trainable_parameters()

    # Train stages sequentially
    prev_adapter: Path | None = None
    for stage_cfg in stages:
        # Update LoRA config per stage if needed
        if prev_adapter is not None:
            # Load previous stage adapter as base for next
            logger.info(f"Loading previous adapter: {prev_adapter}")
            model = PeftModel.from_pretrained(model, str(prev_adapter), is_trainable=True)
            # Re-initialize LoRA with new rank if different
            new_lora = create_lora_config(stage_cfg)
            # Note: in practice you'd merge and re-init; simplified here

        adapter_dir = train_stage(
            model=model,
            tokenizer=tokenizer,
            stage_cfg=stage_cfg,
            data_dir=data_dir,
            output_dir=output_dir,
            training_config=training_config,
            deepspeed_config=deepspeed_path,
            resume_from=args.resume_from_checkpoint,
            dry_run=args.dry_run,
        )
        prev_adapter = adapter_dir

    logger.info("=== All stages complete ===")
    logger.info(f"Final adapter: {prev_adapter}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
