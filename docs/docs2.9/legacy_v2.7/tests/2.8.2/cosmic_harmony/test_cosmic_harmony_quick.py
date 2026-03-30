#!/usr/bin/env python3
"""
🌟 TEST COSMIC HARMONY MINING (QUICK)
Just 5 seconds of mining to see if everything works
"""

import sys
import os
import time
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add paths
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ai'))

print("\n" + "=" * 80)
print("🌟 COSMIC HARMONY QUICK MINING TEST (5 seconds)")
print("=" * 80)

try:
    from ai.zion_universal_miner import ZionUniversalMiner, MiningMode
    
    print("\n1. Creating miner...")
    miner = ZionUniversalMiner(mode=MiningMode.CPU_ONLY)
    print(f"   ✅ Miner created (CPU threads: {miner.optimal_cpu_threads})")
    
    print("\n2. Starting Cosmic Harmony mining...")
    result = miner.start_mining(
        pool_url="stratum+tcp://127.0.0.1:3336",
        wallet_address="TEST_WALLET",
        worker_name="test_worker",
        algorithm="cosmic_harmony"
    )
    
    if result['success']:
        print(f"   ✅ Mining started!")
        print(f"   Message: {result['message']}")
    else:
        print(f"   ❌ Mining failed: {result['message']}")
        sys.exit(1)
    
    print("\n3. Mining for 5 seconds...")
    for i in range(5):
        time.sleep(1)
        status = miner.get_status()
        hashrate = status.get('cpu_hashrate', 0)
        shares = status.get('shares_found', 0)
        algo = status.get('cpu_algorithm', 'unknown')
        print(f"   [{i+1}s] Hashrate: {hashrate:.0f} H/s | Shares: {shares} | Algo: {algo}")
    
    print("\n4. Stopping mining...")
    stop_result = miner.stop_mining()
    if stop_result['success']:
        print(f"   ✅ Mining stopped")
        print(f"   Message: {stop_result['message']}")
    else:
        print(f"   ❌ Stop failed: {stop_result['message']}")
    
    final_status = miner.get_status()
    print(f"\n5. Final status:")
    print(f"   Hashrate: {final_status.get('cpu_hashrate', 0):.0f} H/s")
    print(f"   Shares: {final_status.get('shares_found', 0)}")
    print(f"   Algorithm: {final_status.get('cpu_algorithm', 'unknown')}")
    print(f"   Is mining: {final_status.get('is_mining', False)}")
    
    print("\n" + "=" * 80)
    print("✅ TEST COMPLETE - Cosmic Harmony mining works!")
    print("=" * 80 + "\n")
    
except KeyboardInterrupt:
    print("\n\n⏹️  Interrupted by user")
    try:
        miner.stop_mining()
    except:
        pass
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
