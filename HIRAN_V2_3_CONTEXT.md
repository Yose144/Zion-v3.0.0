# Hiran v2.3 - Context pro pokracovani

> Posledni update: 2025-08-22
> Ulozeno pred ukoncenim session - pokracovat zitra

## Cil
Vygenerovat merged Q5_K_M GGUF model pro Hiran v2.3 (Qwen3-32B + LoRA checkpoint-8000).

## Aktualni stav

### Co je hotovo lokalne (Windows)
1. **Base model stazen**: `D:\Hiran\HiranV2.3\models\qwen\Qwen3-32B` (62GB HF format)
2. **Base model GGUF**: `C:\Users\yosef\.lmstudio\models\lmstudio-community\Qwen3-32B-GGUF\Qwen3-32B-Q4_K_M.gguf` (18.4GB)
3. **LoRA adapter**: `D:\Hiran\HiranV2.3\HiranV2.3-Checkpoints\checkpoint-8000` (2GB HF format)
4. **LoRA GGUF vytvoren**: `D:\Hiran\HiranV2.3\models\hiran-v2.3-lora.gguf` (2GB)
5. **Inference otestovano**: Qwen3-32B-Q4_K_M.gguf + hiran-v2.3-lora.gguf FUNGUJE pres llama-cpp-python
6. **Spousteci skript**: `D:\Hiran\HiranV2.3\start-inference.bat`

### Problém: Merge selhal lokalne
- 32GB RAM nestaci pro merge 32B modelu (potrebuje 64GB+)
- Pokusy s float16, device_map=auto, disk offload vsechny selhaly nebo byly extrémne pomale

### Cloud pokusy (Vast AI)
- API key: `07dbf6b85f0ab802b672f8d3f811ad8aed246c4af63717b5d51d45fae556d27e`
- Credit: $4.19
- Instance 41091916 (RTX 5090, Quebec) - status "created", SSH nefunguje, image: ubuntu:22.04
- Predchozi instance 41089376 (RTX 5090, CZ) - zrusena, SSH nefungoval
- Predchozi instance 41090963 (RTX 5090, Korea) - zrusena, SSH nefungoval

**Problem s Vast AI**: Instance se vytvari ale SSH neni pristupne. Mozna:
- Image nema SSH server
- Firewall blokuje port
- Vast AI ma problem s port forwardingem

### Alternativy pro zitra
1. **Vast AI s jinym image**: Zkusit `vastai/pytorch` nebo jiny image s predinstalovanym SSH
2. **RunPod**: Zkusit jinou sluzbu (maji lepsi SSH)
3. **Lokalne s disk offloodem**: Zkusit merge po vrstvach s ulozenim na disk (trva 3-5 hodin)
4. **HuggingFace Inference API**: Nahrát LoRA na HF a pouzit jejich inference

## Dulezite cesty
```
D:\Hiran\HiranV2.3\                     # Hiran v2.3 workspace
D:\Hiran\HiranV2.3\models\qwen\Qwen3-32B\          # Base model HF (62GB)
D:\Hiran\HiranV2.3\HiranV2.3-Checkpoints\          # Vsechny checkpointy (1-8000)
D:\Hiran\HiranV2.3\HiranV2.3-Checkpoints\checkpoint-8000\  # Pouzivany LoRA
D:\Hiran\HiranV2.3\models\hiran-v2.3-lora.gguf      # LoRA GGUF (2GB)
D:\Hiran\HiranV2.3\llama-cpp\                      # llama.cpp source
D:\Hiran\HiranV2.3\scripts\                        # Skripty
```

## Dalsi kroky
1. [ ] Rozchodit SSH na Vast AI instanci nebo najit alternativu
2. [ ] Prenest checkpoint-8000 na cloud (2GB pres SCP)
3. [ ] Stahnout base model Qwen3-32B z HuggingFace na cloud
4. [ ] Merge: `PeftModel.from_pretrained() + merge_and_unload()`
5. [ ] Convert HF merged -> GGUF Q5_K_M pres `convert_hf_to_gguf.py`
6. [ ] Stahnout vysledny GGUF (~22GB) na lokalni PC
7. [ ] Otestovat inference
8. [ ] Zrusit cloud instanci
