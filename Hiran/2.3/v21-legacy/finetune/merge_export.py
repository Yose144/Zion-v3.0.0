#!/usr/bin/env python3
"""
ZION — Merge LoRA weights + export do GGUF pro Ollama
======================================================

Sloučí LoRA adaptér s base modelem a exportuje do GGUF formátu
připraveného pro Ollama/llama.cpp.

Použití
-------
    # 1. Slučuj LoRA adaptér s base modelem:
    python merge_export.py \\
        --adapter outputs/zion-llama-lora \\
        --output  outputs/zion-llama-merged

    # 2. Konvertuj do GGUF (potřeba llama.cpp):
    python merge_export.py \\
        --adapter outputs/zion-llama-lora \\
        --output  outputs/zion-llama-merged \\
        --to-gguf \\
        --gguf-quant Q5_K_M     # Q5_K_M = nejlepší poměr kvality/velikosti
        --llamacpp /opt/llama.cpp

    # 3. Otestuj v Ollama:
    ollama create zion-expert -f Modelfile.zion
    ollama run zion-expert "Co je Ekam Deeksha algoritmus?"

    # 4. Komplexní ZIP pro jiný stroj (GGUF + přenosný Modelfile + manifest):
    #    ./package_hiran_release.sh --name hiran-v2.1
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

# Musí sedět s tréninkem ve finetune_lora.py (fallback, pokud v adapter_config chybí base).
DEFAULT_BASE_MODEL = os.environ.get(
    "ZION_BASE_MODEL",
    "unsloth/Meta-Llama-3.1-8B-Instruct",
)

OLLAMA_MODELFILE = '''\
# Ollama Modelfile pro ZION Expert
# Použití: ollama create zion-expert -f Modelfile.zion

FROM {gguf_path}

SYSTEM """Jsi ZION blockchain expert a AI Native agent Hiranyagarbha.
Máš hluboké znalosti o ZION blockchain projektu, Ekam Deeksha mining algoritmu,
PoW konsenzu, pool serveru, Rust implementaci a AI Native architektuře.
Odpovídáš přesně, technicky, v češtině."""

PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
PARAMETER stop "<|eot_id|>"
PARAMETER stop "<|end_of_text|>"
'''


def _read_base_model_id(adapter: Path) -> str:
    """Vezme base model z adapter_config.json (stejný jako při tréninku)."""
    cfg_path = adapter / "adapter_config.json"
    if not cfg_path.is_file():
        print(f"VAROVÁNÍ: chybí {cfg_path}, používám {DEFAULT_BASE_MODEL}")
        return DEFAULT_BASE_MODEL
    with cfg_path.open(encoding="utf-8") as f:
        cfg = json.load(f)
    base = cfg.get("base_model_name_or_path") or cfg.get("base_model_name")
    if not base:
        return DEFAULT_BASE_MODEL
    return str(base)


def merge_lora(adapter_path: str, output_path: str, base_model_override: str | None = None) -> Path:
    """Sloučí LoRA adaptér s base modelem a uloží jako HuggingFace model."""
    try:
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError as e:
        print(f"CHYBA: {e}\nSpusť: pip install -r requirements.txt")
        sys.exit(1)

    adapter = Path(adapter_path)
    output  = Path(output_path)
    output.mkdir(parents=True, exist_ok=True)

    base_id = base_model_override or _read_base_model_id(adapter)
    print(f"Načítám base model: {base_id}")
    print(f"Načítám LoRA adaptér z: {adapter}")

    use_cuda = torch.cuda.is_available()
    use_mps = getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available()

    hf_token = os.environ.get("HF_TOKEN")

    if use_cuda:
        torch_dtype = torch.bfloat16
        load_kw = dict(torch_dtype=torch_dtype, device_map="auto", trust_remote_code=True)
    elif use_mps:
        torch_dtype = torch.float16
        load_kw = dict(torch_dtype=torch_dtype, trust_remote_code=True)
    else:
        torch_dtype = torch.float32
        load_kw = dict(torch_dtype=torch_dtype, trust_remote_code=True)
    if hf_token:
        load_kw["token"] = hf_token

    try:
        base = AutoModelForCausalLM.from_pretrained(base_id, **load_kw)
        if use_mps:
            base = base.to("mps")
        # torch_dtype u PeftModel.from_pretrained není ve všech verzích peft — dtype drží base.
        model = PeftModel.from_pretrained(base, str(adapter))
        print("Slučuji LoRA adaptér s base modelem...")
        merged = model.merge_and_unload()
    except Exception as e:
        print(f"CHYBA při merge: {e}")
        print("Tip: ujisti se, že máš stejný stack jako při tréninku (transformers/peft z requirements.txt).")
        raise

    print(f"Ukládám sloučený model do: {output}")
    merged.save_pretrained(str(output), safe_serialization=True)

    print("Ukládám tokenizer...")
    tok_kw = dict(trust_remote_code=True)
    if hf_token:
        tok_kw["token"] = hf_token
    tokenizer = AutoTokenizer.from_pretrained(str(adapter), **tok_kw)
    tokenizer.save_pretrained(str(output))

    print(f"✅ Merge dokončen: {output}")
    return output


def convert_to_gguf(
    model_path: Path,
    llamacpp_dir: str,
    quant_type: str = "Q5_K_M",
) -> Path:
    """
    Konvertuje HuggingFace model do GGUF formátu přes llama.cpp.

    GGUF kvantizace — doporučení:
      Q4_K_M  — 4.8 GB, rychlé, mírná ztráta kvality
      Q5_K_M  — 5.5 GB, dobrý kompromis ⭐ doporučeno
      Q6_K    — 6.1 GB, vysoká přesnost
      Q8_0    — 8.0 GB, téměř beze ztráty
    """
    llamacpp = Path(llamacpp_dir)
    convert_script = llamacpp / "convert_hf_to_gguf.py"

    if not convert_script.exists():
        # Starší llama.cpp používá convert.py
        convert_script = llamacpp / "convert.py"

    if not convert_script.exists():
        print(f"CHYBA: Nenalezen convert script v {llamacpp}")
        print("Nainstaluj llama.cpp: git clone https://github.com/ggerganov/llama.cpp")
        sys.exit(1)

    gguf_f16 = model_path.parent / f"{model_path.name}-f16.gguf"

    # Krok 1: Konverze do FP16 GGUF
    print(f"\nKonvertuji do GGUF (FP16)...")
    result = subprocess.run(
        [sys.executable, str(convert_script), str(model_path), "--outfile", str(gguf_f16)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"CHYBA při konverzi:\n{result.stderr}")
        sys.exit(1)
    print(f"  → {gguf_f16}")

    # Krok 2: Kvantizace
    quantize_bin = llamacpp / "build" / "bin" / "llama-quantize"
    if not quantize_bin.exists():
        quantize_bin = llamacpp / "quantize"  # Starší verze
    if not quantize_bin.exists():
        print(f"VAROVÁNÍ: quantize binary nenalezena v {llamacpp}/build/bin/")
        print(f"Přeskakuji kvantizaci, ponechávám FP16: {gguf_f16}")
        return gguf_f16

    gguf_quant = model_path.parent / f"{model_path.name}-{quant_type.lower()}.gguf"
    print(f"\nKvantizuji do {quant_type}...")
    result = subprocess.run(
        [str(quantize_bin), str(gguf_f16), str(gguf_quant), quant_type],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"CHYBA při kvantizaci:\n{result.stderr}")
        return gguf_f16

    # Smažeme dočasný FP16 (ušetří místo)
    gguf_f16.unlink(missing_ok=True)
    print(f"  → {gguf_quant} ({gguf_quant.stat().st_size / 1e9:.1f} GB)")
    return gguf_quant


def create_modelfile(gguf_path: Path, output_dir: Path) -> Path:
    """Vytvoří Ollama Modelfile."""
    modelfile_path = output_dir / "Modelfile.zion"
    modelfile_path.write_text(
        OLLAMA_MODELFILE.format(gguf_path=gguf_path.resolve()),
        encoding="utf-8",
    )
    return modelfile_path


def main() -> None:
    parser = argparse.ArgumentParser(description="ZION LoRA merge + GGUF export")
    parser.add_argument("--adapter",    required=True,
                        help="Cesta k LoRA adaptéru (output z finetune_lora.py)")
    parser.add_argument("--output",     required=True,
                        help="Výstupní adresář pro sloučený model")
    parser.add_argument("--to-gguf",    action="store_true",
                        help="Také konvertuj do GGUF pro Ollama")
    parser.add_argument("--gguf-quant", default="Q5_K_M",
                        choices=["Q4_K_M", "Q5_K_M", "Q6_K", "Q8_0", "F16"],
                        help="Kvantizace pro GGUF (default: Q5_K_M)")
    parser.add_argument("--llamacpp",   default="/opt/llama.cpp",
                        help="Cesta k llama.cpp adresáři (pro GGUF konverzi)")
    parser.add_argument(
        "--base-model",
        default=None,
        help="Volitelně přepiš base model (výchozí z adapter_config.json / ZION_BASE_MODEL)",
    )

    args = parser.parse_args()
    output_dir = Path(args.output)

    # 1. Merge LoRA
    merged_path = merge_lora(args.adapter, args.output, base_model_override=args.base_model)

    # 2. GGUF konverze (volitelné)
    if args.to_gguf:
        gguf_path = convert_to_gguf(merged_path, args.llamacpp, args.gguf_quant)

        # 3. Vytvoř Ollama Modelfile
        modelfile = create_modelfile(gguf_path, output_dir)
        print(f"\n✅ GGUF model: {gguf_path}")
        print(f"   Ollama Modelfile: {modelfile}")
        print(f"\nDalší kroky:")
        print(f"  1. ollama create zion-expert -f {modelfile}")
        print(f"  2. ollama run zion-expert 'Co je Ekam Deeksha?'")
        print(f"\nNebo přes API:")
        print(f"  curl http://localhost:11434/api/generate -d '{{\"model\":\"zion-expert\",\"prompt\":\"Co je ZION?\"}}' ")
    else:
        print(f"\n✅ Sloučený model: {merged_path}")
        print(f"\nPro GGUF export: python merge_export.py --adapter {args.adapter} --output {args.output} --to-gguf")


if __name__ == "__main__":
    main()
