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
#   ./vast_deploy.sh --resume ID  # připoj se k existující instanci
#   ./vast_deploy.sh --download ID # stáhni výsledky
#   ./vast_deploy.sh --destroy ID  # zruš instanci
#   VAST_GPU='RTX 4090' ./vast_deploy.sh   # preferuj RTX 4090 (doporučeno pro v2 LoRA)
#   VAST_GPU='A100' ./vast_deploy.sh       # výchozí GPU dle VAST_GPU / A100
#   ./vast_deploy.sh --epochs 5   # více epoch
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Konfigurace ──────────────────────────────────────────────────────────────

VAST_API_KEY="${VAST_API_KEY:-}"
if [[ -z "$VAST_API_KEY" && -f "${HOME}/.config/vastai/vast_api_key" ]]; then
    VAST_API_KEY="$(tr -d ' \t\r\n' < "${HOME}/.config/vastai/vast_api_key")"
fi
HF_TOKEN="${HF_TOKEN:-}"
NVIDIA_API_KEY="${NVIDIA_API_KEY:-}"

# GPU požadavky (přepiš: export VAST_GPU='RTX 4090' — název musí sedět s Vast CLI / nabídkami)
GPU_NAME="${VAST_GPU:-A100}"
MIN_GPU_RAM=24            # GB — sníženo pro víc možností
MIN_DISK="${VAST_MIN_DISK:-100}"  # GB — base + checkpoints + GGUF (+ margin)
MIN_RELIABILITY="${VAST_MIN_RELIABILITY:-0.985}"
MAX_PRICE="${VAST_MAX_PRICE:-4.50}" # $/hr — budget limit (vážnou trénku neblokovat levným šuntem)
EPOCHS=3                  # Epochs (budget výchozí); víc: export přes --epochs nebo ZION_EPOCHS na instanci
AUTO_CONFIRM=false        # --yes = přeskočí read před vytvořením instance

# Projekt
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATASET="${ZION_TRAIN_DATASET:-$SCRIPT_DIR/data/zion_train_hiran_v2.jsonl}"
if [[ ! -f "$DATASET" ]]; then
    DATASET="$SCRIPT_DIR/data/zion_train.jsonl"
fi

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
        err "Spusť nejdřív: cd HiranV2.1/finetune && python collect_dataset.py"
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
    log "Hledám ${GPU_NAME} GPU (VRAM≥${MIN_GPU_RAM}GB, disk≥${MIN_DISK}GB, reliability≥${MIN_RELIABILITY}, max \$${MAX_PRICE}/hr, on‑demand)..."

    local offers
    local cli_gpu_name
    cli_gpu_name="${GPU_NAME// /_}"
    # On-demand (ne přerušované nabídky), nejdřív nejspolehlivější, pak nejnižší cena.
    # Pozor: nesmět psát `-d on-demand` — `-d` je přepínač bez hodnoty, další slovo by byl špatný query.
    # Celé GPU jen (gpu_frac=1), typicky jedna karta na instanci (num_gpus==1).
    # Cena používáme z dph_total (skutečný $/hod včetně disku/poplatků dle nabídky).
    offers=$(vastai search offers --on-demand \
        "reliability>${MIN_RELIABILITY} num_gpus==1 gpu_frac>=1 gpu_ram>=${MIN_GPU_RAM} disk_space>=${MIN_DISK} dph_total<${MAX_PRICE} gpu_name=${cli_gpu_name} rented=False" \
        --limit 15 \
        --order "reliability-,dph_total" \
        --raw \
        2>/dev/null || true)

    if [[ -z "$offers" || "$offers" == "[]" ]]; then
        warn "Žádné nabídky při reliability>${MIN_RELIABILITY} — zkouším uvolnění na 0.97..."
        offers=$(vastai search offers --on-demand \
            "reliability>0.97 num_gpus==1 gpu_frac>=1 gpu_ram>=${MIN_GPU_RAM} disk_space>=${MIN_DISK} dph_total<${MAX_PRICE} gpu_name=${cli_gpu_name} rented=False" \
            --limit 15 \
            --order "reliability-,dph_total" \
            --raw \
            2>/dev/null || true)
    fi

    if [[ -z "$offers" || "$offers" == "[]" ]]; then
        err "Žádné ${GPU_NAME} nabídky nenalezeny. Zkus jiný GPU (VAST_GPU=…), vyšší VAST_MAX_PRICE, nebo sniž MIN_DISK přes export VAST_MIN_DISK."
        exit 1
    fi

    echo ""
    echo "$offers" | python3 -c '
import json, sys
offers = json.load(sys.stdin)
print("ID\t$/hr\tGPU\tVRAM\tCUDA\tRel\tCountry")
for o in offers:
    hr = round(float(o.get("dph_total") or o.get("dph") or 0), 4)
    print("{}\t{}\t{}\t{}\t{}\t{}\t{}".format(
        o.get("id"),
        hr,
        o.get("gpu_name"),
        o.get("gpu_ram"),
        o.get("cuda_max_good"),
        round(float(o.get("reliability") or 0), 4),
        o.get("geolocation") or o.get("country") or "",
    ))
'
    echo ""

    # Extrahuj ID nejlevnější instance
    OFFER_ID=$(echo "$offers" | python3 -c 'import json,sys; offers=json.load(sys.stdin); print(offers[0]["id"] if offers else "")')
    OFFER_PRICE=$(echo "$offers" | python3 -c 'import json,sys; offers=json.load(sys.stdin); o=offers[0] if offers else {}; print(o.get("dph_total") or o.get("dph") or "")')

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
        --ssh \
        --direct \
        --cancel-unavail \
        --onstart-cmd "apt-get update && apt-get install -y git wget" \
        2>&1)

    INSTANCE_ID=$(echo "$result" | grep -oE '[0-9]+' | head -1)

    if [[ -z "$INSTANCE_ID" ]]; then
        err "Nepodařilo se vytvořit instanci: $result"
        exit 1
    fi

    log "Instance vytvořena: ID=${INSTANCE_ID}"
    if [[ -f "$HOME/.ssh/id_ed25519.pub" ]]; then
        log "Připojuji lokální SSH klíč k instanci..."
        vastai attach ssh "$INSTANCE_ID" "$HOME/.ssh/id_ed25519.pub" >/dev/null 2>&1 || \
            warn "Nepodařilo se připojit SSH klíč přes vastai attach ssh; zkusím pokračovat."
        sleep 5
    fi
    log "Čekám na spuštění..."

    # Wait for instance to be ready
    local retries=60
    while [[ $retries -gt 0 ]]; do
        local status
        status=$(vastai show instance "$INSTANCE_ID" --raw 2>/dev/null | python3 -c "
import sys, json, subprocess, os
d = json.load(sys.stdin)
a, c = d.get('actual_status'), d.get('cur_state')
host, port = d.get('ssh_host'), d.get('ssh_port')
# Primárně čekáme na actual_status=running (SSH + vast copy jsou stabilní až potom).
if a == 'running':
    print('running')
elif c == 'running' and host and port:
    key = os.path.expanduser('~/.ssh/id_ed25519')
    if os.path.isfile(key):
        r = subprocess.run(
            ['ssh', '-i', key, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=6',
             '-o', 'StrictHostKeyChecking=accept-new', '-p', str(int(port)), f'root@{host}', 'true'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=12,
        )
        if r.returncode == 0:
            print('running')
        else:
            print(a or 'waiting')
    else:
        print(a or 'waiting')
else:
    print(a or c or 'unknown')
" 2>/dev/null || echo "unknown")

        if [[ "$status" == "running" ]]; then
            log "Instance běží (SSH připojení OK — můžeme nahrávat soubory)."
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
export TOKENIZERS_PARALLELISM="${TOKENIZERS_PARALLELISM:-false}"
export ZION_DATALOADER_WORKERS="${ZION_DATALOADER_WORKERS:-0}"

# 1. Install deps
echo "[1/5] Instaluji závislosti..."
pip install -q -r requirements.txt

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

# 4. Fine-tune (budget výchozí: max_seq 1024, epoch 3 — přepni env ZION_MAX_SEQ_LENGTH / ZION_EPOCHS)
echo "[4/5] Spouštím QLoRA fine-tuning..."
python finetune_lora.py \
    --dataset data/zion_train.jsonl \
    --output  outputs/zion-llama-lora \
    --epochs  "${ZION_EPOCHS:-3}" \
    --max-seq-length "${ZION_MAX_SEQ_LENGTH:-1024}"

# 5. Merge + GGUF export
if [[ "${ZION_SKIP_GGUF:-0}" == "1" ]]; then
    echo "[5/5] ZION_SKIP_GGUF=1 — přeskakuji merge/GGUF na serveru."
    echo "  LoRA: outputs/zion-llama-lora/"
    exit 0
fi
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
    vastai execute "$instance_id" "export PYTHONUNBUFFERED=1; chmod +x /workspace/train.sh && HF_TOKEN='${HF_TOKEN}' ZION_EPOCHS='${EPOCHS}' ZION_MAX_SEQ_LENGTH='${ZION_MAX_SEQ_LENGTH:-1024}' ZION_SKIP_GGUF='${ZION_SKIP_GGUF:-0}' bash /workspace/train.sh"

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
  $0                              # Plný pipeline: find → create → train
  $0 --gpu 'RTX 4090' --find-only # Jen nabídky 4090 (stejné před ostatními příkazy)
  $0 --gpu 'RTX 4090'             # Plný pipeline na 4090
  $0 --find-only                  # Jen najdi GPU (VAST_GPU nebo výchozí A100)
  $0 --resume <ID>                # Nahraj soubory a spusť trénink na instanci
  $0 --download <ID>             # Stáhni výsledky z instance
  $0 --destroy <ID>               # Zruš instanci
  $0 --status <ID>                # Stav instance + logy
  $0 --epochs <N>                 # Počet epoch (lze předřadit před subpříkaz)
  $0 --yes                        # Neinteraktivně vytvoř instanci (s opatrností)

Env:
  VAST_API_KEY    Vast.ai API klíč (povinný — nikdy do gitu)
  VAST_GPU        Např. RTX 4090, A100 (výchozí A100)
  HF_TOKEN        HuggingFace token (pro Llama-3)
  NVIDIA_API_KEY  NVIDIA NIM klíč (volitelné, pro dataset gen)
  ZION_MAX_SEQ_LENGTH  Default 1024 na Vast (rychlejší); 2048 = pomalejší, často lepší kontext
  ZION_SKIP_GGUF       1 = po LoRA skončit (merge/GGUF udělej lokálně, ušetří čas stroje)
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

    # Volitelné příznaky před subpříkazem: --gpu / --epochs
    while [[ $# -gt 0 ]]; do
        case "${1:-}" in
            --gpu)
                GPU_NAME="${2:?Chybí GPU name (např. 'RTX 4090')}"
                shift 2
                ;;
            --epochs)
                EPOCHS="${2:?Chybí počet epoch}"
                shift 2
                ;;
            --yes|-y)
                AUTO_CONFIRM=true
                shift
                ;;
            *)
                break
                ;;
        esac
    done

    case "${1:-}" in
        --find-only)
            check_prereqs
            find_gpu
            log "Další krok — vytvoř instanci a trénink (interaktivně potvrdíš):"
            log "  VAST_GPU='${GPU_NAME}' $0"
            log "Nebo ručně: vastai create instance ${OFFER_ID} --image pytorch/pytorch:2.3.1-cuda12.1-cudnn8-devel --disk ${MIN_DISK}"
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
        --help|-h)
            usage
            ;;
        "")
            # Plný pipeline
            check_prereqs
            find_gpu

            echo ""
            if [[ "${AUTO_CONFIRM}" != true ]]; then
                read -rp "Vytvořit instanci z nabídky ${OFFER_ID}? (y/N) " confirm
                if [[ "${confirm,,}" != "y" ]]; then
                    log "Zrušeno."
                    exit 0
                fi
            else
                log "AUTO_CONFIRM: vytvářím instanci z nabídky ${OFFER_ID} bez dotazu."
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
