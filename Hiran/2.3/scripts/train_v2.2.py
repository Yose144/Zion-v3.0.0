#!/usr/bin/env python3
"""
Multi-stage QLoRA curriculum training for Hiran v2.2 (Phase 2).

Each stage reloads the 4-bit base model and trains a fresh LoRA adapter, then saves
to ``output_dir/<stage>/final``. This avoids stacking incompatible LoRA ranks on one
adapter (carryover merge can be added later).

Run from repo root or from ``HiranV2.2/``::

    pip install -r HiranV2.2/requirements-train.txt
    python3 HiranV2.2/scripts/train_v2.2.py --dry_run
    python3 HiranV2.2/scripts/train_v2.2.py --stages foundation --max_steps 5
    python3 HiranV2.2/scripts/train_v2.2.py --tensorboard  # logs v checkpoints/logs/<stage>/
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

_SCRIPT_DIR = Path(__file__).resolve().parent
_HIRAN22_ROOT = _SCRIPT_DIR.parent
if str(_HIRAN22_ROOT) not in sys.path:
    sys.path.insert(0, str(_HIRAN22_ROOT))

from config.dynamic_lora import CURRICULUM_STAGES, get_stage_config  # noqa: E402
from trainer_utils import free_cuda, log_trainable_params, set_seed  # noqa: E402

# data_loader imported inside train_one_stage to keep `python train_v2.2.py --dry_run`
# usable without `datasets` on a minimal machine.


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Hiran v2.2 curriculum QLoRA training")
    p.add_argument(
        "--base_model",
        type=str,
        default="unsloth/Meta-Llama-3.1-8B-Instruct",
        help="HF model id for base",
    )
    p.add_argument(
        "--full_finetune",
        action="store_true",
        help="Enable full fine-tuning (no quantization)",
    )
    p.add_argument(
        "--output_dir",
        type=str,
        default=str(_HIRAN22_ROOT / "checkpoints"),
        help="Root directory for stage checkpoints",
    )
    p.add_argument(
        "--data_dir",
        type=str,
        default=str(_HIRAN22_ROOT / "data" / "curriculum"),
        help="Directory containing <stage>.jsonl files",
    )
    p.add_argument(
        "--stages",
        nargs="+",
        default=list(CURRICULUM_STAGES.keys()),
        help="Ordered curriculum stages",
    )
    p.add_argument("--seed", type=int, default=42)
    p.add_argument(
        "--max_rows",
        type=int,
        default=None,
        help="Cap rows per stage (debug / smoke)",
    )
    p.add_argument(
        "--max_steps",
        type=int,
        default=None,
        help="If set, overrides num_train_epochs for short smoke runs",
    )
    p.add_argument(
        "--dry_run",
        action="store_true",
        help="Print config and dataset sizes only (no GPU)",
    )
    p.add_argument(
        "--resume_stage",
        type=str,
        default=None,
        help="Skip stages before this name (resume_stage is trained first)",
    )
    p.add_argument("--logging_steps", type=int, default=10)
    p.add_argument("--save_steps", type=int, default=200)
    p.add_argument(
        "--tensorboard",
        action="store_true",
        help="Log to TensorBoard under output_dir/logs/<stage>/",
    )
    return p.parse_args()


def _tokenize_map(tokenizer, max_length: int):
    def _map(batch):
        return tokenizer(
            batch["text"],
            truncation=True,
            max_length=max_length,
            padding=False,
        )

    return _map


def _load_model_tokenizer(base_model: str, full_finetune: bool = False):
    import torch
    from peft import prepare_model_for_kbit_training
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
    )

    if full_finetune:
        tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        tokenizer.padding_side = "right"

        model = AutoModelForCausalLM.from_pretrained(
            base_model,
            torch_dtype=torch.float16,
            device_map="cuda",  # Single GPU, no offloading
            trust_remote_code=True,
        )
        model.gradient_checkpointing_enable()  # Enable gradient checkpointing for memory efficiency
        return model, tokenizer
    else:
        from transformers import BitsAndBytesConfig

        bnb = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
        )
        tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        tokenizer.padding_side = "right"

        model = AutoModelForCausalLM.from_pretrained(
            base_model,
            quantization_config=bnb,
            device_map="auto",
            trust_remote_code=True,
        )
        model = prepare_model_for_kbit_training(model)
        model.enable_input_require_grads()
        return model, tokenizer


def train_one_stage(
    *,
    base_model: str,
    stage: str,
    data_path: Path,
    output_root: Path,
    max_rows: Optional[int],
    max_steps: Optional[int],
    logging_steps: int,
    save_steps: int,
    full_finetune: bool = False,
    use_tensorboard: bool,
) -> Path:
    from data_loader import build_hf_dataset

    import torch
    from peft import get_peft_model
    from transformers import DataCollatorForLanguageModeling, Trainer, TrainingArguments

    cfg = get_stage_config(stage)
    ds = build_hf_dataset(data_path, max_rows=max_rows)

    model, tokenizer = _load_model_tokenizer(base_model, full_finetune=full_finetune)

    if full_finetune:
        # Full fine-tuning: no PEFT adapter
        log_trainable_params(model, prefix=f"[{stage} full-finetune] ")
    else:
        peft_config = cfg.to_peft_config()
        model = get_peft_model(model, peft_config)
        log_trainable_params(model, prefix=f"[{stage} QLoRA] ")

    max_length = cfg.max_seq_length
    tokenized = ds.map(
        _tokenize_map(tokenizer, max_length),
        batched=True,
        remove_columns=ds.column_names,
        desc=f"tokenize-{stage}",
    )

    collator = DataCollatorForLanguageModeling(tokenizer, mlm=False, pad_to_multiple_of=8)

    stage_out = output_root / stage
    stage_out.mkdir(parents=True, exist_ok=True)

    # Auto-resume: find the latest checkpoint-* dir inside stage_out
    resume_ckpt: Optional[str] = None
    ckpt_dirs = sorted(
        [d for d in stage_out.iterdir() if d.is_dir() and d.name.startswith("checkpoint-")],
        key=lambda d: int(d.name.split("-")[1]),
        reverse=True,
    )
    if ckpt_dirs:
        resume_ckpt = str(ckpt_dirs[0])
        print(f"  Auto-resuming from checkpoint: {resume_ckpt}")

    log_dir = output_root / "logs" / stage if use_tensorboard else None
    if log_dir is not None:
        log_dir.mkdir(parents=True, exist_ok=True)

    training_kwargs = dict(
        output_dir=str(stage_out),
        num_train_epochs=cfg.epochs,
        per_device_train_batch_size=cfg.batch_size,
        gradient_accumulation_steps=cfg.gradient_accumulation_steps,
        learning_rate=cfg.learning_rate,
        warmup_ratio=cfg.warmup_ratio,
        weight_decay=cfg.weight_decay,
        logging_steps=logging_steps,
        save_steps=save_steps,
        save_total_limit=2,
        fp16=True,
        gradient_checkpointing=True,
        optim="paged_adamw_32bit",
        lr_scheduler_type="cosine",
        dataloader_num_workers=0,
        remove_unused_columns=False,
    )
    if use_tensorboard:
        training_kwargs["report_to"] = ["tensorboard"]
        training_kwargs["logging_dir"] = str(log_dir)
    else:
        training_kwargs["report_to"] = []
    if max_steps is not None:
        training_kwargs["max_steps"] = max_steps
        training_kwargs.pop("num_train_epochs", None)

    args = TrainingArguments(**training_kwargs)

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=tokenized,
        data_collator=collator,
        tokenizer=tokenizer,
    )
    if resume_ckpt:
        trainer.train(resume_from_checkpoint=resume_ckpt)
    else:
        trainer.train()

    final_dir = stage_out / "final"
    trainer.save_model(str(final_dir))
    tokenizer.save_pretrained(str(final_dir))

    hist_path = output_root / "training_history.json"
    history = {}
    if hist_path.is_file():
        history = json.loads(hist_path.read_text(encoding="utf-8"))
    history.setdefault("stages", {})[stage] = {
        "global_step": trainer.state.global_step,
        "log_history_tail": trainer.state.log_history[-5:],
    }
    history["last_stage"] = stage
    hist_path.write_text(json.dumps(history, indent=2), encoding="utf-8")

    del trainer
    del model
    free_cuda()
    return final_dir


def main() -> None:
    args = _parse_args()
    set_seed(args.seed)
    data_dir = Path(args.data_dir)
    output_root = Path(args.output_dir)
    output_root.mkdir(parents=True, exist_ok=True)

    if args.dry_run:
        print("Dry run — no model load.\n")
        for st in args.stages:
            p = data_dir / f"{st}.jsonl"
            n = 0
            if p.is_file():
                with p.open("r", encoding="utf-8") as f:
                    n = sum(1 for line in f if line.strip())
            cfg = get_stage_config(st)
            print(
                f"  {st}: rows={n} rank={cfg.rank} epochs={cfg.epochs} "
                f"lr={cfg.learning_rate} batch={cfg.batch_size}"
            )
        print(f"\nOutput root: {output_root}")
        return

    resume_from = args.resume_stage
    started = resume_from is None
    for stage in args.stages:
        if not started:
            if stage == resume_from:
                started = True
            else:
                print(f"Skipping stage {stage} (resume from {resume_from})")
                continue
        path = data_dir / f"{stage}.jsonl"
        if not path.is_file():
            print(f"Warning: missing data for stage {stage}: {path}", file=sys.stderr)
            continue
        print(f"\n=== Training stage: {stage} ===")
        final_path = train_one_stage(
            base_model=args.base_model,
            stage=stage,
            data_path=path,
            output_root=output_root,
            max_rows=args.max_rows,
            max_steps=args.max_steps,
            logging_steps=args.logging_steps,
            save_steps=args.save_steps,
            full_finetune=args.full_finetune,
            use_tensorboard=args.tensorboard,
        )
        print(f"Saved adapter: {final_path}")

    print("\nAll requested stages finished.")


if __name__ == "__main__":
    main()
