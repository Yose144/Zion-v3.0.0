#!/usr/bin/env python3
"""
2min mining test - start local pool and GPU miner, log stats every 10s
"""
import sys
import os
import time
import subprocess

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ai', 'mining'))

# Ensure clean pool DB
os.system("rm -f zion_pool.db 2>/dev/null")

# Set core mode (pool uses direct state0<=target32 validation path)
os.environ['ZION_CH_CORE'] = '1'

print("=" * 80)
print("🌟 2-MINUTE GPU MINING TEST - Pool + Miner")
print("=" * 80)

# Start pool
print("\n1. Starting mining pool...")
pool_env = os.environ.copy()
pool_proc = subprocess.Popen(
    [sys.executable, "zion_universal_pool_v2.py"],
    env=pool_env,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    universal_newlines=True,
    bufsize=1
)

# Wait for pool to be ready - just give it 3 seconds
print("⏳ Waiting 3s for pool startup...")
time.sleep(3)
print("✅ Pool should be ready")

# Start miner
print("2. Starting GPU miner (2 minutes)...")
from ai.mining.cosmic_harmony_gpu_miner import ZionGPUMiner
miner = ZionGPUMiner()
if not miner.start_mining():
    print("❌ Failed to start miner")
    pool_proc.terminate()
    sys.exit(1)

# Run for 2 minutes
print("3. Mining for 2 minutes...")
start_time = time.time()
last_stats = time.time()

try:
    while time.time() - start_time < 120:  # 2 minutes
        elapsed = time.time() - start_time
        if time.time() - last_stats >= 10:
            stats = miner.get_stats()
            kt = stats.get('kernel_time_ms_last')
            kt_str = f"{kt:.2f}ms" if kt else "n/a"
            temp = stats.get('gpu_temp_c')
            temp_str = f"{temp:.0f}°C" if temp else "n/a"
            rtt = stats.get('submit_latency_ms_last')
            rtt_str = f"{rtt:.1f}ms" if rtt else "n/a"
            ab_temp = stats.get('afterburner_temp_c')
            ab_temp_str = f"AB:{ab_temp:.0f}°C" if ab_temp else ""
            ab_eff = stats.get('afterburner_efficiency_pct')
            ab_eff_str = f"{ab_eff:.0f}%" if ab_eff else ""
            
            print(f"[{int(elapsed):3d}s] {stats['hashrate']} | Shares: {stats['shares']} | "
                  f"Hashes: {stats['total_hashes']:,} | GPU: {temp_str} | "
                  f"Kt: {kt_str} | RTT: {rtt_str} {ab_temp_str} {ab_eff_str}")
            last_stats = time.time()
        time.sleep(1)
except KeyboardInterrupt:
    print("\n⏹️  Interrupted by user")

# Stop
print("\n4. Stopping mining...")
miner.stop_mining()
# Give a moment to flush
time.sleep(1)

# Final stats
final = miner.get_stats()
print("\n" + "=" * 80)
print("FINAL STATS:")
print(f"  Total hashes: {final['total_hashes']:,}")
print(f"  Hashrate: {final['hashrate']}")
print(f"  Shares found: {final['shares']}")
print(f"  Uptime: {final['uptime']:.1f}s")
print("=" * 80)

# Stop pool
try:
    pool_proc.terminate()
    pool_proc.wait(timeout=5)
except Exception:
    pass

print("\n✅ Test complete")
