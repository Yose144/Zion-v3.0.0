#!/usr/bin/env python3
"""Start ZION services and capture logs to files."""
import subprocess
import sys
import os
import time
from pathlib import Path

REPO = Path(__file__).parent.resolve()
LOG_DIR = REPO / "logs"
LOG_DIR.mkdir(exist_ok=True)

env_node = os.environ.copy()
env_node.update({
    "ZION_NODE_ID": "local-backup-node",
    "ZION_P2P_BIND": "0.0.0.0:8333",
    "ZION_RPC_BIND": "0.0.0.0:8443",
    "ZION_NODE_STATE_PATH": "V3/data/zion-node-state.db",
    "ZION_SEED_PEERS": "62.171.141.136:8333",
    "ZION_MINER_ADDRESS": "zion1w523a76830x2t5m7f3j023w265e8g5c400a4790",
    "ZION_HUMANITARIAN_WALLET": "zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4",
    "ZION_ISSOBELLA_WALLET": "zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702",
})

env_miner = os.environ.copy()
env_miner.update({
    "ZION_POOL_ADDR": "62.171.141.136:8444",
    "ZION_LOOP_COUNT": "1000000",
    "ZION_MINER_THREADS": "1",
    "ZION_WORKER_NAME": "worker1",
    "ZION_MINER_ID": "w11-amd-gpu-miner-01",
    "ZION_PAYOUT_ADDRESS": "zion1w523a76830x2t5m7f3j023w265e8g5c400a4790",
    "ZION_GPU_BACKEND": "opencl",
    "ZION_GPU_WORK_SIZE": "16384",
    "ZION_OCL_WORK_CAP": "16384",
    "ZION_OCL_VRAM_PCT": "35",
})

procs = []

# Start node
node_log_path = LOG_DIR / f"node1_{int(time.time())}.log"
node_log = open(node_log_path, "a", encoding="utf-8")
node_proc = subprocess.Popen(
    [str(REPO / "V3" / "target" / "release" / "node.exe")],
    cwd=REPO,
    env=env_node,
    stdout=node_log,
    stderr=subprocess.STDOUT,
    text=True,
)
procs.append(("Node", node_proc, node_log))
print(f"Started Node (PID {node_proc.pid}) -> {node_log_path}")

time.sleep(5)

# Start miner
miner_log_path = LOG_DIR / f"miner_{int(time.time())}.log"
miner_log = open(miner_log_path, "a", encoding="utf-8")
miner_proc = subprocess.Popen(
    [str(REPO / "V3" / "target" / "release" / "zion-miner.exe")],
    cwd=REPO,
    env=env_miner,
    stdout=miner_log,
    stderr=subprocess.STDOUT,
    text=True,
)
procs.append(("Miner", miner_proc, miner_log))
print(f"Started Miner (PID {miner_proc.pid}) -> {miner_log_path}")

time.sleep(3)

# Start dashboard
dash_log_path = LOG_DIR / f"dashboard_{int(time.time())}.log"
dash_log = open(dash_log_path, "a", encoding="utf-8")
dash_proc = subprocess.Popen(
    [sys.executable, str(REPO / "ZION_OS" / "dashboard" / "app.py")],
    cwd=REPO,
    stdout=dash_log,
    stderr=subprocess.STDOUT,
    text=True,
)
procs.append(("Dashboard", dash_proc, dash_log))
print(f"Started Dashboard (PID {dash_proc.pid}) -> {dash_log_path}")

print("\nAll services started. Monitoring...")
print(f"Dashboard: http://127.0.0.1:8766")
print(f"Logs: {LOG_DIR}")
print("Press Ctrl+C to stop all.\n")

try:
    while True:
        for name, proc, _ in procs:
            if proc.poll() is not None:
                print(f"WARNING: {name} exited with code {proc.returncode}")
        time.sleep(5)
except KeyboardInterrupt:
    print("\nStopping all services...")
    for name, proc, _ in procs:
        print(f"  Stopping {name} (PID {proc.pid})...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
    print("All stopped.")
