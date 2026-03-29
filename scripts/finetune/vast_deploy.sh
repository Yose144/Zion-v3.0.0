#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZION AI Native — Vast.ai Fine-tuning Deploy Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# One-click deployment: najde A100/RTX 5090, uploadne dataset, spustí trénink, stáhne GGUF.
#
# Prerekvizity:
#   pip install vastai
#   export VAST_API_KEY="e0fe6cd4..."
#   export HF_TOKEN="hf_..."   (pro Llama-3 gated model)
#
# Použití:
#   ./vast_deploy.sh              # plný pipeline
#   ./vast_deploy.sh --find-only  # jen najdi GPU, nespouštěj
#   ./vast_deploy.sh --resume ID  # připoj se k existující instanci#   ./vast_deploy.sh --download ID # stáhni výsledky
#   ./vast_deploy.sh --destroy ID  # zruš instanci
#   ./vast_deploy.sh --gpu RTX_5090   # preferuj RTX 5090
#   ./vast_deploy.sh --gpu A100   # preferuj A100 (default)
#   ./vast_deploy.sh --epochs 5   # více epoch# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Konfigurace ──────────────────────────────────────────────────────────────

VAST_API_KEY="${VAST_API_KEY:-e0fe6cd434a2b4f24c12dc59b2ab65034da77832a9e23440d32b5e399ce6afa0}"
HF_TOKEN="${HF_TOKEN:-}"
NVIDIA_API_KEY="${NVIDIA_API_KEY:-}"

# GPU požadavky
GPU_NAME="A100"           # A100 nebo RTX_5090 dle --gpu
MIN_GPU_RAM=24            # GB — sníženo pro víc možností
MIN_DISK=80               # GB — model + dataset + output
MAX_PRICE=3.00            # $/hr — budget limit
EPOCHS=5                  # Epochs pro robustní trénink

# Projekt
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATASET="$SCRIPT_DIR/data/zion_train.jsonl"

# Barvy
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[ZION]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERR]${NC} $*" >&2; }

# ─── Prerekvizity check ──────────────────────────────────────────────────────

check_prereqs() {
    log "Kontroluji prerekvizity..."

    if ! command -v vastai &>/dev/null; then
        log "Instaluji vastai CLI..."
        pip3 install --quiet vastai
    fi

    if [[ -z "$VAST_API_KEY" ]]; then
        err "VAST_API_KEY není nastaven. Export: export VAST_API_KEY='...'"
        exit 1
    fi

    vastai set api-key "$VAST_API_KEY"

    if [[ ! -f "$DATASET" ]]; then
        err "Dataset nenalezen: $DATASET"
        err "Spusť nejdřív: cd scripts/finetune && python collect_dataset.py"
        exit 1
    fi

    local n_pairs
    n_pairs=$(wc -l < "$DATASET" | tr -d ' ')
    log "Dataset: $n_pairs Q&A párů v $DATASET"

    if [[ -z "$HF_TOKEN" ]]; then
        warn "HF_TOKEN není nastaven — budeš potřebovat pro Llama-3 gated model."
        warn "  export HF_TOKEN='hf_...'"
    fi
}

# ─── Najdi A100 instanci ─────────────────────────────────────────────────────

find_gpu() {
    log "Hledám ${GPU_NAME} GPU (min ${MIN_GPU_RAM}GB VRAM, max \$${MAX_PRICE}/hr)..."

    local offers
    offers=$(vastai search offers \
        --type on-demand \
        --gpu-name "$GPU_NAME" \
        --gpu-ram ">=${MIN_GPU_RAM}" \
        --disk ">=${MIN_DISK}" \
        --order "dph_total" \
        --limit 10 \
        2>/dev/null || true)

    if [[ -z "$offers" ]]; then
        err "Žádné ${GPU_NAME} nabídky nenalezeny. Zkus jiný GPU nebo zvyš budget."
        exit 1
    fi

    echo ""
    echo "$offers"
    echo ""

    # Extrahuj ID nejlevnější instance
    OFFER_ID=$(echo "$offers" | tail -n +2 | head -1 | awk '{print $1}')
    OFFER_PRICE=$(echo "$offers" | tail -n +2 | head -1 | awk '{for(i=1;i<=NF;i++) if ($i ~ /^[0-9]+\.[0-9]+$/) {print $i; exit}}')

    log "Nejlevnější nabídka: ID=${OFFER_ID}, cena ~\$${OFFER_PRICE}/hr"
}

# ─── Vytvoř instanci ─────────────────────────────────────────────────────────

create_instance() {
    local offer_id="$1"
    log "Vytvářím instanci z nabídky ${offer_id}..."

    # PyTorch image s CUDA support
    local result
    result=$(vastai create instance "$offer_id" \
        --image "pytorch/pytorch:2.3.1-cuda12.1-cudnn8-devel" \
        --disk "$MIN_DISK" \
        --onstart-cmd "apt-get update && apt-get install -y git wget" \
        2>&1)

    INSTANCE_ID=$(echo "$result" | grep -oE '[0-9]+' | head -1)

    if [[ -z "$INSTANCE_ID" ]]; then
        err "Nepodařilo se vytvořit instanci: $result"
        exit 1
    fi

    log "Instance vytvořena: ID=${INSTANCE_ID}"
    log "Čekám na spuštění..."

    # Wait for instance to be ready
    local retries=60
    while [[ $retries -gt 0 ]]; do
        local status
        status=$(vastai show instance "$INSTANCE_ID" --raw 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('actual_status', 'unknown'))
" 2>/dev/null || echo "unknown")

        if [[ "$status" == "running" ]]; then
            log "Instance běží!"
            break
        fi
        echo -n "."
        sleep 10
        retries=$((retries - 1))
    done

    if [[ $retries -eq 0 ]]; then
        err "Timeout — instance se nespustila do 10 minut."
        err "Zkontroluj: vastai show instance $INSTANCE_ID"
        exit 1
    fi

    # Získej SSH info
    SSH_INFO=$(vastai ssh-url "$INSTANCE_ID" 2>/dev/null || true)
    log "SSH: $SSH_INFO"
}

# ─── Upload dataset + skripty ─────────────────────────────────────────────────

upload_files() {
    local instance_id="$1"
    log "Uploaduji dataset a skripty..."

    # Vast.ai copy (SCP-style)
    vastai copy "$SCRIPT_DIR/finetune_lora.py"   "$instance_id:/workspace/finetune_lora.py"
    vastai copy "$SCRIPT_DIR/merge_export.py"     "$instance_id:/workspace/merge_export.py"
    vastai copy "$SCRIPT_DIR/evaluate.py"          "$instance_id:/workspace/evaluate.py" 2>/dev/null || true
    vastai copy "$SCRIPT_DIR/requirements.txt"    "$instance_id:/workspace/requirements.txt"
    vastai copy "$DATASET"                         "$instance_id:/workspace/data/zion_train.jsonl"

    log "Upload hotov."
}

# ─── Spusť trénink na instanci ───────────────────────────────────────────────

run_training() {
    local instance_id="$1"
    log "Spouštím fine-tuning na instanci ${instance_id}..."

    # Prepare a run train script
    local train_script
    train_script=$(cat <<'TRAIN_EOF'
#!/bin/bash
set -euo pipefail

echo "═══════════════════════════════════════════════"
echo "  ZION AI Native — Fine-tuning na $(hostname)"
echo "═══════════════════════════════════════════════"

cd /workspace

# 1. Install deps
echo "[1/5] Instaluji závislosti..."
pip install -q -r requirements.txt
pip install -q flash-attn --no-build-isolation 2>/dev/null || echo "Flash Attention not available, continuing"

# 2. HuggingFace login
if [[ -n "${HF_TOKEN:-}" ]]; then
    echo "[2/5] HuggingFace login..."
    huggingface-cli login --token "$HF_TOKEN"
else
    echo "[2/5] HF_TOKEN not set — skip login (model may fail if gated)"
fi

# 3. Dataset check
PAIRS=$(wc -l < data/zion_train.jsonl)
echo "[3/5] Dataset: $PAIRS Q&A párů"

# 4. Fine-tune
echo "[4/5] Spouštím QLoRA fine-tuning..."
python finetune_lora.py \
    --dataset data/zion_train.jsonl \
    --output  outputs/zion-llama-lora \
    --epochs  "${ZION_EPOCHS:-5}"

# 5. Merge + GGUF export
echo "[5/5] Merge LoRA + GGUF export..."
# Clone llama.cpp for GGUF conversion
if [[ ! -d /opt/llama.cpp ]]; then
    git clone --depth 1 https://github.com/ggerganov/llama.cpp /opt/llama.cpp
    cd /opt/llama.cpp && pip install -q -r requirements.txt && cd /workspace
fi
pip install -q sentencepiece

python merge_export.py \
    --adapter outputs/zion-llama-lora \
    --output  outputs/zion-llama-merged \
    --to-gguf \
    --gguf-quant Q5_K_M \
    --llamacpp /opt/llama.cpp

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ HOTOVO!"
echo ""
echo "  LoRA:  outputs/zion-llama-lora/"
echo "  GGUF:  outputs/zion-llama-merged/"
echo ""
echo "  Stáhni GGUF na lokální Mac:"
echo "    vastai copy $VAST_INSTANCE_ID:/workspace/outputs/zion-llama-merged/ ./zion-model/"
echo "═══════════════════════════════════════════════"
TRAIN_EOF
)

    # Upload train script
    echo "$train_script" > /tmp/zion_train_remote.sh
    vastai copy /tmp/zion_train_remote.sh "$instance_id:/workspace/train.sh"

    # Execute
    vastai execute "$instance_id" "chmod +x /workspace/train.sh && HF_TOKEN='${HF_TOKEN}' ZION_EPOCHS='${EPOCHS}' bash /workspace/train.sh"

    log "Trénink spuštěn! Sleduj logy:"
    log "  vastai logs $instance_id"
}

# ─── Download výsledky ────────────────────────────────────────────────────────

download_results() {
    local instance_id="$1"
    local output_dir="$SCRIPT_DIR/outputs"
    mkdir -p "$output_dir"

    log "Stahuji výsledky z instance ${instance_id}..."

    # Download GGUF
    vastai copy "$instance_id:/workspace/outputs/zion-llama-merged/" "$output_dir/zion-llama-merged/"

    # Download eval results
    vastai copy "$instance_id:/workspace/outputs/eval_results.json" "$output_dir/" 2>/dev/null || true

    log "Výsledky staženy do: $output_dir/zion-llama-merged/"

    # Check for GGUF file
    local gguf
    gguf=$(find "$output_dir" -name "*.gguf" -type f 2>/dev/null | head -1)
    if [[ -n "$gguf" ]]; then
        local size
        size=$(du -h "$gguf" | cut -f1)
        log "GGUF model: $gguf ($size)"
        echo ""
        log "Další kroky:"
        echo "  1. ollama create zion-expert -f $output_dir/zion-llama-merged/Modelfile.zion"
        echo "  2. ollama run zion-expert 'Co je Ekam Deeksha mining algoritmus?'"
        echo ""
    fi
}

# ─── Cleanup ──────────────────────────────────────────────────────────────────

cleanup_instance() {
    local instance_id="$1"
    log "Zastavuji instanci ${instance_id}..."
    vastai destroy instance "$instance_id"
    log "Instance zrušena — přestaň platit."
}

# ─── Usage ────────────────────────────────────────────────────────────────────

usage() {
    cat <<EOF
ZION AI Native — Vast.ai Robustní Fine-tuning Deploy

Použití:
  $0                      # Plný pipeline: find → create → train → download
  $0 --find-only          # Jen najdi dostupné GPU
  $0 --resume <ID>        # Připoj se k existující instanci
  $0 --download <ID>      # Stáhni výsledky z instance
  $0 --destroy <ID>       # Zruš instanci
  $0 --status <ID>        # Stav instance + logy
    $0 --gpu <NAME>         # GPU preference (A100, RTX_5090, RTX_4090, H100)
  $0 --epochs <N>         # Počet epoch (default: 5)

Env:
  VAST_API_KEY    Vast.ai API klíč (povinný)
  HF_TOKEN        HuggingFace token (pro Llama-3)
  NVIDIA_API_KEY  NVIDIA NIM klíč (volitelné, pro dataset gen)
EOF
}

# ─── Status check ─────────────────────────────────────────────────────────────

check_status() {
    local instance_id="$1"
    log "Status instance ${instance_id}:"
    vastai show instance "$instance_id"
    echo ""
    log "Poslední logy:"
    vastai logs "$instance_id" --tail 30
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
    echo -e "${BLUE}"
    echo "═══════════════════════════════════════════════════════════"
    echo "  🤖 ZION AI Native — Vast.ai Fine-tuning Pipeline"
    echo "═══════════════════════════════════════════════════════════"
    echo -e "${NC}"

    case "${1:-}" in
        --find-only)
            check_prereqs
            find_gpu
            log "Použij: $0 --resume <OFFER_ID> pro vytvoření instance"
            ;;
        --resume)
            INSTANCE_ID="${2:?Chybí instance ID}"
            check_prereqs
            upload_files "$INSTANCE_ID"
            run_training "$INSTANCE_ID"
            log "Až bude hotovo, stáhni: $0 --download $INSTANCE_ID"
            ;;
        --download)
            INSTANCE_ID="${2:?Chybí instance ID}"
            download_results "$INSTANCE_ID"
            ;;
        --destroy)
            INSTANCE_ID="${2:?Chybí instance ID}"
            cleanup_instance "$INSTANCE_ID"
            ;;
        --status)
            INSTANCE_ID="${2:?Chybí instance ID}"
            check_status "$INSTANCE_ID"
            ;;
        --gpu)
            GPU_NAME="${2:?Chybí GPU name}"
            shift 2
            check_prereqs
            find_gpu
            ;;
        --epochs)
            EPOCHS="${2:?Chybí počet epoch}"
            shift 2
            ;;
        --help|-h)
            usage
            ;;
        "")
            # Plný pipeline
            check_prereqs
            find_gpu

            echo ""
            read -rp "Vytvořit instanci z nabídky ${OFFER_ID}? (y/N) " confirm
            if [[ "${confirm,,}" != "y" ]]; then
                log "Zrušeno."
                exit 0
            fi

            create_instance "$OFFER_ID"
            upload_files "$INSTANCE_ID"
            run_training "$INSTANCE_ID"

            echo ""
            log "Trénink běží na instanci ${INSTANCE_ID}!"
            log ""
            log "Sleduj logy:     $0 --status $INSTANCE_ID"
            log "Stáhni GGUF:     $0 --download $INSTANCE_ID"
            log "Zruš instanci:   $0 --destroy $INSTANCE_ID"
            ;;
        *)
            err "Neznámý argument: $1"
            usage
            exit 1
            ;;
    esac
}

main "$@"
