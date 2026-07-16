#!/usr/bin/env bash
set -euo pipefail

# Package a THIN zion-miner wrapper for SimpleMining OS (SMOS).
#
# The SMOS custom-miner cache (/root/miner_org) on the Vega rig is very small
# and fills up quickly, so we ship only a tiny "miner" entry-point script.
# That script cleans the SMOS cache, downloads the real zion-miner binary from
# the edge server, and then (if needed) downloads the EPIC ProgPow DAG in the
# background while the miner already produces hashrate.

VERSION="${1:-v3.0.5-gpu}"
OUT_DIR="${2:-/var/www/zion-miner}"
WORK="/tmp/zion-miner-${VERSION}"
OUT="${OUT_DIR}/zion-miner-${VERSION}.zip"

rm -rf "${WORK}"
mkdir -p "${WORK}"

# SMOS custom miner entry point — keep the conventional name "miner".
cat > "${WORK}/miner" <<'EOF'
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Defaults for SMOS / SimpleMining OS
export ZION_GPU_BACKEND="${ZION_GPU_BACKEND:-opencl}"
export ZION_PROFILE="${ZION_PROFILE:-pool}"
export ZION_LOOP_COUNT="${ZION_LOOP_COUNT:-1000000}"
export ZION_NONCE_AUTOTUNE="${ZION_NONCE_AUTOTUNE:-true}"
export ZION_METRICS_REPORT_SECS="${ZION_METRICS_REPORT_SECS:-30}"
export ZION_OCL_BUILD_OPTS="${ZION_OCL_BUILD_OPTS:--cl-std=CL1.2 -cl-mad-enable}"
export ZION_IGNORE_GPU_SELF_TEST_FAIL="${ZION_IGNORE_GPU_SELF_TEST_FAIL:-1}"
export ZION_VERBOSE=1
export ZION_INTERACTIVE=0
export ZION_MINER_ALGORITHM=deeksha_lite_v1
# ZION_AUXPOW_EASY_TARGET intentionally NOT set; pool server uses real upstream targets.

# Direct edge IP avoids HTTPS/HTTP2 and any domain-level proxying.
EDGE_BASE="http://62.171.141.136/zion-miner"
MINER_BIN_URL="${EDGE_BASE}/zion-miner"
DAG_CACHE_DIR="${ZION_DAG_CACHE_DIR:-/home/miner/.zion/dag-cache}"
EPIC_DAG_URL="${EDGE_BASE}/dag-cache/progpow_epoch120.bin"
EPIC_DAG_FILE="${DAG_CACHE_DIR}/progpow_epoch120.bin"
EPIC_DAG_SIZE=2080374792

# 5 MB chunks keep each HTTP transfer short and stay below the rig-side
# ~130 MB transfer throttle. Chunk-level resume survives SMOS restarts.
LAST_PART_INDEX=396
FULL_CHUNK_SIZE=5242880
LAST_CHUNK_SIZE=4194312

# Clean old SMOS custom-miner tarballs that fill up the tiny /root partition.
echo "[smos-wrapper] cleaning old SMOS miner packages ..."
rm -rf /root/miner_org/custom_zion-miner-* /root/miner_org/*.tar.gz* /root/miner_org/*.md5 || true

# Ensure we have the real miner binary locally.
LOCAL_MINER="/tmp/zion-miner-real"
download_miner() {
    echo "[smos-wrapper] downloading real miner binary ..."
    rm -f "${LOCAL_MINER}.tmp"
    curl --http1.1 --retry 20 --retry-delay 5 --connect-timeout 30 \
         --speed-time 60 --speed-limit 10000 \
         -fsSL -o "${LOCAL_MINER}.tmp" "${MINER_BIN_URL}" || return 1
    chmod +x "${LOCAL_MINER}.tmp"
    mv "${LOCAL_MINER}.tmp" "${LOCAL_MINER}"
    echo "[smos-wrapper] miner binary ready ($(stat -c%s "${LOCAL_MINER}") bytes)"
}

if [ ! -x "${LOCAL_MINER}" ] || [ "$(stat -c%s "${LOCAL_MINER}" 2>/dev/null || echo 0)" -lt 500000 ]; then
    download_miner || {
        echo "[smos-wrapper] FATAL: could not download miner binary"
        exit 1
    }
fi

start_miner() {
    echo "[smos-wrapper] starting miner ..."
    exec "${LOCAL_MINER}" --pool "${ZION_POOL_ADDR:-62.171.141.136:8444}" \
      --wallet "${ZION_MINER_ID:-${WALLET:-}}" \
      --worker "${ZION_WORKER_NAME:-${WORKER:-smos-rig}}" \
      --profile "${ZION_PROFILE}" \
      ${ZION_THREADS:+--threads "${ZION_THREADS}"} \
      "$@"
}

# If DAG is already present and valid, just run the miner.
if [ -f "$EPIC_DAG_FILE" ] && [ "$(stat -c%s "$EPIC_DAG_FILE" 2>/dev/null || echo 0)" = "$EPIC_DAG_SIZE" ]; then
    start_miner "$@"
fi

mkdir -p "$DAG_CACHE_DIR"
cd "$DAG_CACHE_DIR" || exit 1
# Remove leftover partials from earlier chunk sizes / failed attempts so that
# resume only matches the current 5 MB chunk naming scheme.
rm -f progpow_epoch120.bin.tmp progpow_epoch120.bin.part*.part

fetch_dag_in_background() {
    local miner_pid=$1
    local ok=true
    for i in $(seq -f '%03g' 0 $LAST_PART_INDEX); do
        part="progpow_epoch120.bin.part${i}.part"
        part_url="${EPIC_DAG_URL}.part${i}.part"

        if [ "$i" = "$LAST_PART_INDEX" ]; then
            expected_size=$LAST_CHUNK_SIZE
        else
            expected_size=$FULL_CHUNK_SIZE
        fi

        actual_size=$(stat -c%s "$part" 2>/dev/null || echo 0)
        if [ "$actual_size" = "$expected_size" ]; then
            echo "[smos-wrapper] $part already complete, skipping"
            continue
        fi

        # The rig's network throttle kicks in after roughly 130 MB of continuous
        # HTTP traffic. Pause for a minute every 25 chunks (~125 MB) to reset it.
        local idx_dec=$((10#$i))
        if [ $idx_dec -gt 0 ] && [ $((idx_dec % 25)) -eq 0 ]; then
            echo "[smos-wrapper] throttle pause after $i chunks ..."
            sleep 60
        fi

        local attempts=0
        local got_chunk=false
        while [ $attempts -lt 20 ] && [ "$got_chunk" = false ]; do
            attempts=$((attempts + 1))
            echo "[smos-wrapper] downloading $part (chunk $i/$LAST_PART_INDEX, attempt $attempts) ..."
            if curl --http1.1 --retry 5 --retry-delay 5 --connect-timeout 30 \
                    --speed-time 60 --speed-limit 30000 \
                    -C - -fsSL -o "$part" "$part_url"; then
                actual_size=$(stat -c%s "$part" 2>/dev/null || echo 0)
                if [ "$actual_size" = "$expected_size" ]; then
                    got_chunk=true
                else
                    echo "[smos-wrapper] $part size $actual_size != expected $expected_size; retry after pause"
                    sleep 60
                fi
            else
                echo "[smos-wrapper] $part download failed; retry after pause"
                sleep 60
            fi
        done

        if [ "$got_chunk" = false ]; then
            echo "[smos-wrapper] giving up on $part; leaving parts for resume"
            ok=false
            break
        fi

        sleep 5
    done

    if $ok; then
        echo "[smos-wrapper] assembling DAG ..."
        cat progpow_epoch120.bin.part*.part > progpow_epoch120.bin.tmp
        actual=$(stat -c%s progpow_epoch120.bin.tmp 2>/dev/null || echo 0)
        if [ "$actual" = "$EPIC_DAG_SIZE" ]; then
            mv progpow_epoch120.bin.tmp progpow_epoch120.bin
            rm -f progpow_epoch120.bin.part*.part
            echo "[smos-wrapper] EPIC DAG ready; restarting miner to load it"
            kill "$miner_pid" 2>/dev/null || true
        else
            echo "[smos-wrapper] assembled DAG size $actual != expected $EPIC_DAG_SIZE; leaving parts for resume"
        fi
    fi
}

# Start the miner in the background so SMOS sees hashrate while DAG downloads.
"${LOCAL_MINER}" --pool "${ZION_POOL_ADDR:-62.171.141.136:8444}" \
  --wallet "${ZION_MINER_ID:-${WALLET:-}}" \
  --worker "${ZION_WORKER_NAME:-${WORKER:-smos-rig}}" \
  --profile "${ZION_PROFILE}" \
  ${ZION_THREADS:+--threads "${ZION_THREADS}"} \
  "$@" &
MINER_PID=$!

fetch_dag_in_background "$MINER_PID" &
wait "$MINER_PID"
EOF
chmod +x "${WORK}/miner"

# Optional env file example
cat > "${WORK}/smos.env.example" <<'EOF'
# Optional SMOS env overrides
ZION_POOL_ADDR=62.171.141.136:8444
ZION_MINER_ID=zion1...
ZION_WORKER_NAME=vega-smos
ZION_GPU_BACKEND=opencl
ZION_PROFILE=pool
EOF

cd /tmp
rm -f "${OUT}"
zip -r "${OUT}" "$(basename "${WORK}")"
chmod 644 "${OUT}"
ls -la "${OUT}"
unzip -l "${OUT}"
echo "URL=https://zionterranova.com/zion-miner/zion-miner-${VERSION}.zip"
