# Hiran v2.3 - Dokonceno!

> Posledni update: 2025-08-22
> Status: **Q5_K_M GGUF USPESNE VYTVOREN!**

## Vysledek
- **Q5_K_M GGUF**: `D:\Hiran\HiranV2.3\models\hiran-v2.3-8000-q5_k_m.gguf` (21.62 GB)
- **Velikost**: ~22GB - optimalni pro RTX 3090/4090 s 24GB VRAM
- **Kvalita**: Q5_K_M (5-bit kvantizace s K-quant blokem) - vyborny pomer kvality/velikosti

## Proces (co bylo udelano)
1. **Layer-by-layer merge** lokalne na Windows s 32GB RAM
   - Qwen3-32B base model (62GB HF) + LoRA checkpoint-8000 (2GB)
   - Pouzit custom safetensors merge script (896 LoRA tensoru)
   - Vysledek: `hiran-v2.3-merged-FIXED` (61GB, 17 safetensors souboru)

2. **Konverze na F16 GGUF** (~61GB)
   - `convert_hf_to_gguf.py` z llama.cpp

3. **Kvantizace na Q5_K_M** (~22GB)
   - `llama-quantize.exe` z llama.cpp releases
   - F16 -> Q5_K_M: 707 tensoru zkvantizovano

4. **Uklid mezisouboru**
   - Smazano f16 (61GB) + q8_0 (32GB) = uvolneno 93GB

## Dulezite cesty
```
D:\Hiran\HiranV2.3\models\hiran-v2.3-8000-q5_k_m.gguf  # Finalni model (21.6GB)
D:\Hiran\HiranV2.3\start-q5_k_m.bat                    # Spousteci skript
D:\Hiran\HiranV2.3\models\hiran-v2.3-lora.gguf          # LoRA adapter (2GB)
D:\Hiran\HiranV2.3\HiranV2.3-Checkpoints\checkpoint-8000 # LoRA HF format
```

## Spusteni inference
```batch
D:\Hiran\HiranV2.3\start-q5_k_m.bat
```
Server bezi na http://localhost:8080 s API kompatibilnim s OpenAI.

## Testovani
- Model byl uspesne zkvantizovan a je pripraven k pouziti
- Doporuceno: RTX 3090 (24GB) nebo RTX 4090 (24GB)
- n_ctx=32768, n_threads=8
