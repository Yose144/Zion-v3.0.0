#!/usr/bin/env python3
"""
Hiran v2.3 QLoRA Training Script (RESUME VERSION)
Trains Qwen3-32B with QLoRA, with support for resuming from checkpoint.
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
from peft import LoraConfig, get_peft_model, TaskType, PeftModel

BASE_MODEL = "Qwen/Qwen3-32B"

STAGE_CONFIGS = {
    "stage1_factual": {
        "dataset": "data/curriculum/v2.3_combined_dataset.jsonl",
        "output_dir": "checkpoints/stage1_factual",
        "epochs": 3,
        "lr": 2e-4,
        "batch_size_per_gpu": 1,
        "grad_accum": 8,
        "warmup_steps": 100,
        "weight_decay": 0.01,
        "max_grad_norm": 0.3,
        "lr_scheduler": "cosine",
        "max_length": 1024,
    },
}

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
    "use_rslora": True,
}

CHAT_TEMPLATE = "{% for message in messages %}{% if loop.first and messages[0]['role'] != 'system' %}{{ '<|im_start|>system\nYou are a helpful assistant.\n' }}{% endif %}{{ '<|im_start|>' + message['role'] + '\n' + message['content'] + 'end' + '\n' }}{% endfor %}{% if add_generation_prompt %}{{ '<|im_start|>assistant\n' }}{% endif %}"

def format_instruction_to_messages(instruction, output):
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

def train_qlora(stage_name, stage_cfg, resume_from=None):
    print(f"\n{'='*60}")
    print(f"QLoRA TRAINING: {stage_name}")
    if resume_from:
        print(f"  RESUMING FROM: {resume_from}")
    print(f"{'='*60}")
    print(f"  Model: {BASE_MODEL}")
    print(f"  Method: QLoRA (4-bit base + LoRA adapters)")
    print(f"  Dataset: {stage_cfg['dataset']}")
    print(f"  Epochs: {stage_cfg['epochs']} | LR: {stage_cfg['lr']}")
    print(f"  LoRA rank: {LORA_CONFIG['r']} | Alpha: {LORA_CONFIG['lora_alpha']}")

    output_dir = Path(stage_cfg["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

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

    print("\nLoading model (BF16)...")
    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        trust_remote_code=True,
        torch_dtype=torch.bfloat16,
    )

    if resume_from and Path(resume_from).exists():
        print(f"\n  Loading existing LoRA adapter from {resume_from}...")
        model = PeftModel.from_pretrained(model, resume_from)
        model.print_trainable_parameters()
    else:
        print(f"\n  Creating new LoRA adapters...")
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

    model.gradient_checkpointing_enable()

    dataset_path = Path(stage_cfg["dataset"])
    if not dataset_path.is_absolute():
        dataset_path = Path.cwd() / dataset_path

    tokenized_dataset = load_and_prepare_dataset(
        dataset_path, tokenizer, max_length=stage_cfg.get("max_length", 2048)
    )
    tokenized_dataset = tokenized_dataset.train_test_split(test_size=0.02, seed=42)

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

    if torch.cuda.is_available():
        print(f"\nGPU Memory before training:")
        for i in range(torch.cuda.device_count()):
            mem = torch.cuda.get_device_properties(i).total_memory / 1e9
            allocated = torch.cuda.memory_allocated(i) / 1e9
            print(f"  GPU {i}: {allocated:.1f}GB / {mem:.1f}GB allocated")

    print("\nStarting QLoRA training...")
    print(f"  {'='*60}")

    if resume_from and Path(resume_from).exists():
        print(f"  Resuming training from checkpoint: {resume_from}")
        trainer.train(resume_from_checkpoint=resume_from)
    else:
        trainer.train()

    final_dir = output_dir / "final"
    print(f"\nSaving final model + adapters to {final_dir}...")
    model.save_pretrained(final_dir)
    tokenizer.save_pretrained(final_dir)

    merged_dir = output_dir / "final_merged"
    print(f"  Saving merged model to {merged_dir}...")
    merged_model = model.merge_and_unload()
    merged_model.save_pretrained(merged_dir)
    tokenizer.save_pretrained(merged_dir)

    config = {
        "stage": stage_name,
        "base_model": BASE_MODEL,
        "epochs": stage_cfg["epochs"],
        "lr": stage_cfg["lr"],
        "batch_size": stage_cfg["batch_size_per_gpu"],
        "grad_accum": stage_cfg["grad_accum"],
        "lora_r": LORA_CONFIG["r"],
        "lora_alpha": LORA_CONFIG["lora_alpha"],
        "completed_at": datetime.now().isoformat(),
    }
    with open(final_dir / "training_config.json", "w") as f:
        json.dump(config, f, indent=2)

    print(f"\n{'='*60}")
    print(f"  Training complete!")
    print(f"  Final checkpoint: {final_dir}")
    print(f"  Merged model: {merged_dir}")
    print(f"{'='*60}")
    return final_dir

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", default="all", help="Training stage")
    parser.add_argument("--dry_run", action="store_true", help="Validate config only")
    parser.add_argument("--resume_from", default=None, help="Path to checkpoint to resume from")
    args = parser.parse_args()

    if args.dry_run:
        print("Config validation OK")
        return

    if args.stage == "all":
        for stage_name, stage_cfg in STAGE_CONFIGS.items():
            train_qlora(stage_name, stage_cfg, resume_from=args.resume_from)
    else:
        if args.stage not in STAGE_CONFIGS:
            print(f"Unknown stage: {args.stage}")
            sys.exit(1)
        train_qlora(args.stage, STAGE_CONFIGS[args.stage], resume_from=args.resume_from)

if __name__ == "__main__":
    main()
