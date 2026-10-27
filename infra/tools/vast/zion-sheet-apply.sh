#!/usr/bin/env bash
# zion-sheet-apply.sh — fleet-agent desired-state apply hook (W3 B3 v1).
#
# Installed on the rig at /root/zion-sheet-apply.sh by bootstrap-agent.sh.
# Translates a CP flight sheet (JSON, argv[1]) into tmux miner launches.
# The CP owns the *what* (miner/coin/pool/wallet/duty); this hook owns the
# *how* — the sheet can only steer what this script implements.
#
# Supported sheet.miner values:
#   "srbminer-dual"  → SRBMiner-MULTI sessions (qtu + prl, duty split)
#   "zion-miner"     → zion-miner native streams via our pool
#   "xmrig"          → xmrig CPU session
#   "none" / "stop"  → kill all known miner sessions
#
# Sheet fields: {miner, coin?, pool?, wallet?, args?, duty? {prl,qtu}}
set -euo pipefail
SHEET="${1:?usage: zion-sheet-apply.sh <sheet.json>}"

J() { python3 -c "import json,sys; print(json.load(open('$SHEET')).get('$1') or '')" 2>/dev/null; }

MINER="$(J miner)"; COIN="$(J coin)"; POOL="$(J pool)"; WALLET="$(J wallet)"
ARGS="$(J args)"; DUTY_PRL="$(python3 -c "import json; d=json.load(open('$SHEET')).get('duty') or {}; print(d.get('prl') or 50)" 2>/dev/null)"
DUTY_QTU=$((100 - DUTY_PRL))
WORKER="vast-$(hostname | cut -c1-12)"

# pool/wallet defaults mirror vastctl launch_* — sheet values win.
QTU_POOL="${POOL:-stratum+tcp://pool.luckypool.io:4434}"
PRL_POOL="${POOL:-stratum+tcp://eu.luckypool.io:3110}"
ZION_POOL="${POOL:-stratum+tcp://pool.zionterranova.com:8444}"
XMR_POOL="${POOL:-pool.supportxmr.com:3333}"
QTU_WALLET="${WALLET:-}"
PRL_WALLET="${WALLET:-}"
ZION_WALLET="${WALLET:-}"
XMR_WALLET="${WALLET:-}"
SRB_DIR="SRBMiner-MULTI-2-9-8"
XMR_DIR="xmrig-6.24.0"

kill_miners() {
    tmux kill-session -t zion 2>/dev/null || true
    tmux kill-session -t srb-qtu 2>/dev/null || true
    tmux kill-session -t srb-prl 2>/dev/null || true
    tmux kill-session -t xmrig 2>/dev/null || true
    pkill -x SRBMiner-MULTI 2>/dev/null || true
    pkill -f 'zion-miner --pool' 2>/dev/null || true
    pkill -x xmrig 2>/dev/null || true
    sleep 1
}

case "$MINER" in
    none|stop|"")
        kill_miners
        echo "sheet: all miners stopped"
        ;;
    srbminer-dual|srbminer)
        [ -x "/root/miners/$SRB_DIR/SRBMiner-MULTI" ] || {
            echo "sheet: SRBMiner not installed under /root/miners/$SRB_DIR" >&2; exit 3; }
        kill_miners
        if [ "$DUTY_QTU" -gt 0 ]; then
            tmux new-session -d -s srb-qtu \
                "cd /root/miners/$SRB_DIR && exec ./SRBMiner-MULTI \
                 --algorithm quantus --pool $QTU_POOL --wallet $QTU_WALLET \
                 --worker $WORKER-qtu --disable-cpu $ARGS"
        fi
        if [ "$DUTY_PRL" -gt 0 ]; then
            tmux new-session -d -s srb-prl \
                "cd /root/miners/$SRB_DIR && exec ./SRBMiner-MULTI \
                 --algorithm pearlhash --pool $PRL_POOL --wallet $PRL_WALLET \
                 --worker $WORKER-prl --disable-cpu $ARGS"
        fi
        echo "sheet: srbminer-dual launched (qtu=$DUTY_QTU prl=$DUTY_PRL)"
        ;;
    zion-miner|zion)
        [ -x /root/zion-native/zion-miner ] || {
            echo "sheet: zion-miner not installed at /root/zion-native/zion-miner" >&2; exit 3; }
        kill_miners
        s2="1"; s4="1"
        [ "$DUTY_PRL" -le 0 ] && s2="0"
        [ "$DUTY_QTU" -le 0 ] && s4="0"
        tmux new-session -d -s zion "while true; do env \
            ZION_MINER_ID=$WORKER ZION_GPU_BACKEND=cuda ZION_PROFILE=pool ZION_VERBOSE=1 \
            ZION_INTERACTIVE=0 ZION_NO_STICKY=1 ZION_LOG_INTERVAL=15 \
            ZION_V3_TRINITY=1 ZION_AUTOTUNE=1 ZION_AUTOTUNE_SECS=3 ZION_IGNORE_GPU_SELF_TEST_FAIL=1 \
            ZION_STREAM1_ENABLED=0 ZION_STREAM3_ENABLED=0 \
            ZION_STREAM2_ENABLED=$s2 ZION_STREAM2_FORCE_COIN=PRL ZION_PEARL_K=2048 \
            ZION_PEARL_BATCH=64 ZION_PEARL_STREAMS=4 ZION_PEARL_CUMULATIVE_MMA=1 \
            ZION_STREAM4_ENABLED=$s4 ZION_STREAM4_FORCE_COIN=QTU ZION_QPOW_BACKEND=cuda \
            ZION_EXT_GPU_TIME_DUTY_PCT=$DUTY_PRL ZION_EXT_GPU2_TIME_DUTY_PCT=$DUTY_QTU \
            ZION_EXT_GPU_GAP_MS=0 ZION_EXT_GPU_MAX_GAP_MS=5000 ZION_MINER_THREADS=4 \
            /root/zion-native/zion-miner --pool $ZION_POOL --wallet $ZION_WALLET \
            --worker $WORKER --gpu cuda --threads 4 --log-interval 15 --v3-trinity \
            >> /root/zion.log 2>&1; echo \"ZION_EXIT=\$? respawn in 5s\" >> /root/zion.log; sleep 5; done"
        echo "sheet: zion-miner launched (prl=$DUTY_PRL qtu=$DUTY_QTU)"
        ;;
    xmrig)
        [ -x "/root/$XMR_DIR/xmrig" ] || [ -x /root/xmrig ] || {
            echo "sheet: xmrig not installed" >&2; exit 3; }
        kill_miners
        BIN="/root/$XMR_DIR/xmrig"; [ -x "$BIN" ] || BIN=/root/xmrig
        tmux new-session -d -s xmrig \
            "$BIN -o $XMR_POOL -u $XMR_WALLET -p $WORKER --cpu-max-threads-hint=80 $ARGS"
        echo "sheet: xmrig launched"
        ;;
    *)
        echo "sheet: unknown miner '$MINER'" >&2
        exit 64
        ;;
esac
sleep 2
tmux ls 2>/dev/null || true
