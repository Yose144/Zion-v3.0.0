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
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

BASE_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct"

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


def merge_lora(adapter_path: str, output_path: str) -> Path:
    """Sloučí LoRA adaptér s base modelem a uloží jako HuggingFace model."""
    try:
        import torch
        from peft import AutoPeftModelForCausalLM
        from transformers import AutoTokenizer
    except ImportError as e:
        print(f"CHYBA: {e}\nSpusť: pip install -r requirements.txt")
        sys.exit(1)

    adapter = Path(adapter_path)
    output  = Path(output_path)
    output.mkdir(parents=True, exist_ok=True)

    print(f"Načítám LoRA model z: {adapter}")
    model = AutoPeftModelForCausalLM.from_pretrained(
        str(adapter),
        device_map="auto",
        torch_dtype=torch.float16,
    )

    print("Slučuji LoRA adaptér s base modelem...")
    merged = model.merge_and_unload()

    print(f"Ukládám sloučený model do: {output}")
    merged.save_pretrained(str(output), safe_serialization=True)

    print("Ukládám tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(str(adapter))
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

    args = parser.parse_args()
    output_dir = Path(args.output)

    # 1. Merge LoRA
    merged_path = merge_lora(args.adapter, args.output)

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
