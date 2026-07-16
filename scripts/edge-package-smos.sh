#!/usr/bin/env bash
set -euo pipefail

# Package zion-miner for SimpleMining OS (SMOS) custom miner.
# Run from the repo root: ./scripts/edge-package-smos.sh [VERSION]

VERSION="${1:-v3.0.5-gpu}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${2:-${REPO_ROOT}/target/release/zion-miner}"
OUT_DIR="${3:-/var/www/zion-miner}"
WORK="/tmp/zion-miner-${VERSION}"
OUT="${OUT_DIR}/zion-miner-${VERSION}.zip"

if [[ ! -f "${BIN}" ]]; then
    echo "ERROR: miner binary not found at ${BIN}"
    echo "Build it first: cargo build --release -p zion-miner --features 'gpu-opencl native-hashers'"
    exit 1
fi

python3 <<PY
import re
d=open("${BIN}","rb").read()
vs=sorted({int(x) for x in re.findall(rb"GLIBC_2\.(\d+)", d)})
print("GLIBC max:", f"2.{max(vs)}" if vs else "unknown")
if vs and max(vs)>31:
    print("WARNING: may break SMOS glibc 2.31")
PY

rm -rf "${WORK}"
mkdir -p "${WORK}"
cp "${BIN}" "${WORK}/zion-miner"

# SMOS custom miner entry point — keep the conventional name "miner".
cat > "${WORK}/miner" <<'EOF'
#!/bin/bash
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

# Pre-fetch EPIC ProgPow DAG if missing. Generating the ~2 GB DAG on a
# low-end rig CPU is slow; downloading a pre-built cache lets the miner
# start hashing EPIC immediately on the first run.
DAG_CACHE_DIR="${ZION_DAG_CACHE_DIR:-/home/miner/.zion/dag-cache}"
EPIC_DAG_URL="http://62.171.141.136/zion-miner/dag-cache/progpow_epoch120.bin"
EPIC_DAG_FILE="${DAG_CACHE_DIR}/progpow_epoch120.bin"
EPIC_DAG_SIZE=2080374792
if [ ! -f "$EPIC_DAG_FILE" ] || [ "$(stat -c%s "$EPIC_DAG_FILE" 2>/dev/null || echo 0)" != "$EPIC_DAG_SIZE" ]; then
    echo "[smos-wrapper] fetching EPIC ProgPow DAG (~2 GB) to $EPIC_DAG_FILE ..."
    mkdir -p "$DAG_CACHE_DIR"
    cd "$DAG_CACHE_DIR" || exit 1
    rm -f progpow_epoch120.bin.tmp

    # Download the DAG in 10 MB chunks. The rig's internet path drops sustained
    # HTTP transfers after ~130 MB, so we keep the rate low and resume across
    # miner restarts using the already-downloaded parts.
    ok=true
    for i in $(seq -f '%03g' 0 198); do
        part="progpow_epoch120.bin.part${i}.part"
        part_url="${EPIC_DAG_URL}.part${i}.part"

        # Last chunk is smaller than 10 MB.
        if [ "$i" = "198" ]; then
            expected_size=4194312
        else
            expected_size=10485760
        fi

        actual_size=$(stat -c%s "$part" 2>/dev/null || echo 0)
        if [ "$actual_size" = "$expected_size" ]; then
            echo "[smos-wrapper] $part already complete ($expected_size bytes), skipping"
            continue
        fi

        echo "[smos-wrapper] downloading $part (chunk $i/198) ..."
        if ! curl --http1.1 --retry 20 --retry-delay 5 --connect-timeout 30 \
                  --speed-time 120 --speed-limit 50000 \
                  -C - -fsSL -o "$part" "$part_url"; then
            echo "[smos-wrapper] failed to download $part; will resume on next start"
            ok=false
            break
        fi

        actual_size=$(stat -c%s "$part" 2>/dev/null || echo 0)
        if [ "$actual_size" != "$expected_size" ]; then
            echo "[smos-wrapper] $part size $actual_size != expected $expected_size; will resume on next start"
            ok=false
            break
        fi

        # Short pause to stay below the rig-side transfer throttle.
        sleep 10
    done

    if $ok; then
        echo "[smos-wrapper] assembling DAG ..."
        cat progpow_epoch120.bin.part*.part > progpow_epoch120.bin.tmp
        actual=$(stat -c%s progpow_epoch120.bin.tmp 2>/dev/null || echo 0)
        if [ "$actual" = "$EPIC_DAG_SIZE" ]; then
            mv progpow_epoch120.bin.tmp progpow_epoch120.bin
            rm -f progpow_epoch120.bin.part*.part
            echo "[smos-wrapper] EPIC DAG ready"
        else
            echo "[smos-wrapper] assembled DAG size $actual != expected $EPIC_DAG_SIZE; leaving parts for resume"
        fi
    fi
fi

# Allow overriding the miner binary path
MINER_BIN="${MINER_BIN:-${SCRIPT_DIR}/zion-miner}"

exec "${MINER_BIN}" --pool "${ZION_POOL_ADDR:-62.171.141.136:8444}" \
  --wallet "${ZION_MINER_ID:-${WALLET:-}}" \
  --worker "${ZION_WORKER_NAME:-${WORKER:-smos-rig}}" \
  --profile "${ZION_PROFILE}" \
  ${ZION_THREADS:+--threads "${ZION_THREADS}"} \
  "$@"
EOF
chmod +x "${WORK}/miner" "${WORK}/zion-miner"

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
