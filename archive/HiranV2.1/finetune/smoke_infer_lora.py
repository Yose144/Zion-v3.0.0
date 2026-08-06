#!/usr/bin/env python3
"""
Rychlý kouřový test LoRA adaptéru (base + Peft) — bez merge, bez GGUF.

Vyžaduje: pip install -r requirements.txt (transformers, peft, torch).
Doporučeno: CUDA (4-bit jako při tréninku) nebo Apple MPS (fp16, potřebuje dost RAM/VRAM).

Python: použij 3.10–3.13. S 3.14 instalace často spadne na sestavení `tokenizers` (PyO3 zatím max
CPython 3.13). Na Macu např. `brew install python@3.12` → `python3.12 -m venv .venv-smoke`.

Příklad:
  cd HiranV2.1/finetune
  python3.12 -m venv .venv-smoke && . .venv-smoke/bin/activate
  pip install -U pip
  pip install -r requirements.txt
  python3 smoke_infer_lora.py \\
    --adapter outputs/vast-hiran-v2.1/zion-llama-lora \\
    --prompt "Stručně: co je V3 a kde je zion-core?"
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_ADAPTER = SCRIPT_DIR / "outputs/vast-hiran-v2.1/zion-llama-lora"

DEFAULT_BASE = os.environ.get(
    "ZION_BASE_MODEL",
    "unsloth/Meta-Llama-3.1-8B-Instruct",
)

SYSTEM_DEFAULT = (
    "Jsi Hiranyagarbha — ZION blockchain expert. Kanonický kód je ve V3/. "
    "Odpovídaj stručně a technicky v češtině."
)


def _read_base(adapter: Path) -> str:
    cfg_path = adapter / "adapter_config.json"
    if not cfg_path.is_file():
        return DEFAULT_BASE
    with cfg_path.open(encoding="utf-8") as f:
        cfg = json.load(f)
    return str(cfg.get("base_model_name_or_path") or cfg.get("base_model_name") or DEFAULT_BASE)


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke test LoRA (base + Peft)")
    parser.add_argument(
        "--adapter",
        type=Path,
        default=DEFAULT_ADAPTER,
        help=f"Cesta k LoRA (default: {DEFAULT_ADAPTER})",
    )
    parser.add_argument(
        "--prompt",
        default="Co je zion-core a k čemu slouží?",
        help="Uživatelská otázka",
    )
    parser.add_argument("--max-new-tokens", type=int, default=256)
    parser.add_argument("--system", default=SYSTEM_DEFAULT, help="System prompt")
    args = parser.parse_args()

    adapter: Path = args.adapter.expanduser().resolve()
    if not adapter.is_dir():
        print(f"CHYBA: adaptér není adresář: {adapter}")
        sys.exit(1)

    try:
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    except ImportError as e:
        print(f"CHYBA: {e}\nSpusť: pip install -r requirements.txt")
        sys.exit(1)

    base_id = _read_base(adapter)
    hf_token = os.environ.get("HF_TOKEN")
    auth_kw: dict = {"trust_remote_code": True}
    if hf_token:
        auth_kw["token"] = hf_token

    print(f"Base: {base_id}")
    print(f"Adapter: {adapter}")

    use_cuda = torch.cuda.is_available()
    use_mps = getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available()

    if use_cuda:
        bnb = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        )
        base = AutoModelForCausalLM.from_pretrained(
            base_id,
            quantization_config=bnb,
            device_map="auto",
            attn_implementation="sdpa",
            **auth_kw,
        )
    elif use_mps:
        base = AutoModelForCausalLM.from_pretrained(
            base_id,
            torch_dtype=torch.float16,
            attn_implementation="sdpa",
            **auth_kw,
        )
        base = base.to("mps")
    else:
        print(
            "CHYBA: není CUDA ani MPS. Lokální inference 8B na CPU bez kvantizace je typicky nepraktická.\n"
            "  Možnosti: spusť na stroji s NVIDIA GPU, na Macu s MPS, nebo merge+GGUF a Ollama."
        )
        sys.exit(2)

    print("Načítám LoRA…")
    model = PeftModel.from_pretrained(base, str(adapter))
    model.eval()

    tokenizer = AutoTokenizer.from_pretrained(str(adapter), **auth_kw)
    tokenizer.pad_token = tokenizer.eos_token

    messages = [
        {"role": "system", "content": args.system},
        {"role": "user", "content": args.prompt},
    ]
    enc = tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=True,
        return_tensors="pt",
    )
    device = next(model.parameters()).device
    if isinstance(enc, dict):
        enc = {k: v.to(device) for k, v in enc.items()}
        input_len = enc["input_ids"].shape[-1]
        with torch.inference_mode():
            out = model.generate(
                **enc,
                max_new_tokens=args.max_new_tokens,
                do_sample=True,
                temperature=0.3,
                top_p=0.9,
                pad_token_id=tokenizer.eos_token_id,
            )
    else:
        enc = enc.to(device)
        input_len = enc.shape[-1]
        with torch.inference_mode():
            out = model.generate(
                enc,
                max_new_tokens=args.max_new_tokens,
                do_sample=True,
                temperature=0.3,
                top_p=0.9,
                pad_token_id=tokenizer.eos_token_id,
            )

    reply = tokenizer.decode(out[0][input_len:], skip_special_tokens=True)
    print("\n--- odpověď ---\n")
    print(reply.strip())
    print("\n---------------")


if __name__ == "__main__":
    main()
