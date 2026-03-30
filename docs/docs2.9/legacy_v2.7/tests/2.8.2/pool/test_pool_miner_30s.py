#!/usr/bin/env python3
"""
Mini test: spustit pool a miner na 30 sekund s debug loggingem,
abychom viděli přesně co se posílá a co pool validuje.
"""
import subprocess
import time
import os
import signal

print("=" * 80)
print("TEST: Pool + GPU Miner (30s) - Debug Mode")
print("=" * 80)

# Cleanup old dbs
os.system("rm -f zion_pool.db 2>/dev/null")

# Start pool
print("\n1. Starting pool with ZION_CH_CORE=1...")
pool_env = os.environ.copy()
pool_env['ZION_CH_CORE'] = '1'
pool_proc = subprocess.Popen(
    ["python3", "zion_universal_pool_v2.py"],
    env=pool_env,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    universal_newlines=True,
    bufsize=1
)

# Give pool time to start
time.sleep(3)

# Start miner
print("2. Starting GPU miner...")
miner_env = os.environ.copy()
miner_env['ZION_CH_CORE'] = '1'

# Create simple miner launcher
miner_code = """
import sys
sys.path.insert(0, '/media/maitreya/ZION1')
sys.path.insert(0, '/media/maitreya/ZION1/ai/mining')
import time
from cosmic_harmony_gpu_miner import ZionGPUMiner

miner = ZionGPUMiner()
miner.start_mining()
time.sleep(30)
miner.stop_mining()
"""

miner_proc = subprocess.Popen(
    ["python3", "-c", miner_code],
    env=miner_env,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    universal_newlines=True,
    bufsize=1
)

print("3. Collecting output for 35 seconds...")
try:
    # Read output
    start = time.time()
    outputs = {"pool": [], "miner": []}
    
    # Read from both processes
    for _ in range(70):  # 35 * 2 iterations
        try:
            # Pool output
            line = pool_proc.stdout.readline()
            if line and ("Invalid" in line or "Accepted" in line or "state0" in line or "target" in line):
                outputs["pool"].append(line.strip())
                print(f"[POOL] {line.strip()[:100]}")
        except:
            pass
        
        try:
            # Miner output
            line = miner_proc.stdout.readline()
            if line and ("submitted" in line or "Mining" in line or "Share" in line):
                outputs["miner"].append(line.strip())
                print(f"[MINER] {line.strip()[:100]}")
        except:
            pass
        
        time.sleep(0.5)

except KeyboardInterrupt:
    pass

finally:
    print("\n4. Stopping processes...")
    try:
        pool_proc.terminate()
        miner_proc.terminate()
        pool_proc.wait(timeout=5)
        miner_proc.wait(timeout=5)
    except:
        pool_proc.kill()
        miner_proc.kill()

print("\n" + "=" * 80)
print("TEST COMPLETE - Check logs for Invalid/Accepted patterns")
print("=" * 80)
