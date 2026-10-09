#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "huggingface-hub>=0.23",
#   "transformers>=4.43",
#   "torch>=2.2",
#   "sentencepiece",
#   "protobuf",
# ]
# ///
"""
Hiran v2.2 — konverze FP16 safetensors → GGUF + kvantizace.

Použití:
    uv run HiranV2.2/quantization/convert_to_gguf.py

Vyžaduje: llama.cpp nainstalovaný (viz HIRAN_LOCAL_SETUP.md)
"""

import os
import sys
import shutil
import subprocess
import platform
from pathlib import Path

# ── Cesty ──────────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).parent.parent.parent
MODEL_DIR = REPO_ROOT / "HiranV2.2" / "models" / "hiran-v2.2-merged"
GGUF_DIR = REPO_ROOT / "HiranV2.2" / "models" / "gguf"

# Kvantizace cíl — Q4_K_M se vejde do 8 GB VRAM AMD 5600 XT
QUANT_TARGET = "q4_k_m"
GGUF_F16_NAME = "hiran-v2.2-f16.gguf"
GGUF_QUANT_NAME = f"hiran-v2.2-{QUANT_TARGET}.gguf"

# ── Hledat llama.cpp ───────────────────────────────────────────────────────────

LLAMA_CPP_SEARCH = [
    Path("C:/llama.cpp"),
    Path("C:/tools/llama.cpp"),
    Path.home() / "llama.cpp",
    Path.home() / "llama-cpp",
    Path("/opt/llama.cpp"),
    Path("/usr/local/llama.cpp"),
    # Ollama bundled llama.cpp (Windows)
    Path("C:/Users") / os.environ.get("USERNAME", "") / "AppData/Local/Programs/Ollama",
]

CONVERT_SCRIPTS = [
    "convert_hf_to_gguf.py",
    "convert.py",
]

QUANTIZE_BINS = [
    "llama-quantize",
    "llama-quantize.exe",
    "quantize",
    "quantize.exe",
]


def find_llama_convert() -> Path | None:
    """Najdi convert_hf_to_gguf.py v llama.cpp."""
    # Zkontroluj PATH
    for script in CONVERT_SCRIPTS:
        if shutil.which(script):
            return Path(shutil.which(script))
    # Prohledej běžné cesty
    for base in LLAMA_CPP_SEARCH:
        for script in CONVERT_SCRIPTS:
            p = base / script
            if p.exists():
                return p
    return None


def find_llama_quantize() -> str | None:
    """Najdi llama-quantize binary."""
    for name in QUANTIZE_BINS:
        if shutil.which(name):
            return name
    for base in LLAMA_CPP_SEARCH:
        for name in QUANTIZE_BINS:
            p = base / name
            if p.exists():
                return str(p)
            p = base / "build" / "bin" / name
            if p.exists():
                return str(p)
    return None


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    print(f"\n$ {' '.join(str(c) for c in cmd)}")
    return subprocess.run(cmd, check=True, **kwargs)


def main():
    print("=" * 60)
    print("Hiran v2.2 — GGUF konverze a kvantizace")
    print("=" * 60)

    # Ověř model
    if not MODEL_DIR.exists():
        print(f"\n❌ Model nenalezen: {MODEL_DIR}")
        print("   Ujisti se, že složka hiran-v2.2-merged existuje.")
        sys.exit(1)

    safetensors = list(MODEL_DIR.glob("*.safetensors"))
    print(f"\n✓ Model nalezen: {MODEL_DIR}")
    print(f"  safetensors souborů: {len(safetensors)}")

    # Najdi nástroje
    convert_script = find_llama_convert()
    quantize_bin = find_llama_quantize()

    if not convert_script:
        print("\n❌ convert_hf_to_gguf.py nenalezen!")
        print("   Nainstaluj llama.cpp:")
        print("   Windows: https://github.com/ggerganov/llama.cpp/releases")
        print("   Nebo: git clone https://github.com/ggerganov/llama.cpp && cmake -B build && cmake --build build")
        print("\n   Alternativa — použij Ollama (viz HIRAN_LOCAL_SETUP.md)")
        sys.exit(1)

    if not quantize_bin:
        print("\n❌ llama-quantize nenalezen!")
        print("   Zkompiluj llama.cpp nebo stáhni pre-built binary.")
        sys.exit(1)

    print(f"\n✓ convert script: {convert_script}")
    print(f"✓ llama-quantize: {quantize_bin}")

    # Vytvoř output dir
    GGUF_DIR.mkdir(parents=True, exist_ok=True)
    f16_path = GGUF_DIR / GGUF_F16_NAME
    quant_path = GGUF_DIR / GGUF_QUANT_NAME

    # Krok 1: Konverze HF → GGUF F16
    if f16_path.exists():
        size_gb = f16_path.stat().st_size / 1e9
        print(f"\n✓ F16 GGUF již existuje ({size_gb:.1f} GB): {f16_path}")
    else:
        print(f"\n[1/2] Konvertuji {MODEL_DIR} → GGUF F16...")
        run([
            sys.executable, str(convert_script),
            str(MODEL_DIR),
            "--outfile", str(f16_path),
            "--outtype", "f16",
        ])
        print(f"✓ F16 GGUF uložen: {f16_path}")

    # Krok 2: Kvantizace F16 → Q4_K_M
    if quant_path.exists():
        size_gb = quant_path.stat().st_size / 1e9
        print(f"\n✓ Kvantizovaný model již existuje ({size_gb:.1f} GB): {quant_path}")
    else:
        print(f"\n[2/2] Kvantizuji {QUANT_TARGET.upper()}...")
        run([quantize_bin, str(f16_path), str(quant_path), QUANT_TARGET])
        size_gb = quant_path.stat().st_size / 1e9
        print(f"✓ Kvantizovaný model uložen ({size_gb:.1f} GB): {quant_path}")

    print("\n" + "=" * 60)
    print(f"✅ Hotovo! Model připraven:")
    print(f"   {quant_path}")
    print(f"\nDalší krok: spusť inference server:")
    print(f"   HiranV2.2\\inference\\start_hiran_ollama.bat")
    print(f"   nebo: HiranV2.2\\inference\\start_hiran_llamacpp.bat")
    print("=" * 60)


if __name__ == "__main__":
    main()
