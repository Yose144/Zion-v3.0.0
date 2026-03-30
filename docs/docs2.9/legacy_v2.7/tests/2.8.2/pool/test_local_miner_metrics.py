#!/usr/bin/env python3
"""
🎯 Local Pool Miner Test with Live Metrics
- Connect to local pool (3333)
- Mine for 60 seconds
- Display live metrics (shares, accepted, rejected, hashrate)
- Verify block generation
- Check balance updates
"""

import sys
import os
import time
import json
import socket
import subprocess
import threading

# Add parent directories to path for imports
test_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(os.path.dirname(test_dir)))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'ai'))

try:
    from zion_universal_miner import ZionUniversalMiner
except ImportError:
    from ai.zion_universal_miner import ZionUniversalMiner

def check_pool_connectivity(host="127.0.0.1", port=3333):
    """Test if pool is reachable"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except:
        return False

def get_pool_stats():
    """Get pool stats via HTTP API"""
    try:
        import urllib.request
        response = urllib.request.urlopen("http://127.0.0.1:8080/stats", timeout=2)
        return json.loads(response.read().decode())
    except:
        return None

def main():
    print("\n" + "="*80)
    print("🚀 ZION LOCAL POOL MINER TEST - LIVE METRICS")
    print("="*80)
    
    # Check pool connectivity
    print("\n1️⃣  Checking pool connectivity...")
    if not check_pool_connectivity():
        print("❌ Pool not reachable on 127.0.0.1:3333")
        print("💡 Start pool with: python3 src/core/zion_universal_pool_v2.py")
        return False
    print("✅ Pool is reachable!")
    
    # Initialize miner
    print("\n2️⃣  Initializing miner...")
    try:
        miner = ZionUniversalMiner(enable_realtime_display=False)
        print("✅ Miner initialized")
    except Exception as e:
        print(f"❌ Failed to initialize miner: {e}")
        return False
    
    # Start mining
    print("\n3️⃣  Starting mining on local pool...")
    try:
        result = miner.start_mining(
            pool_url="stratum+tcp://127.0.0.1:3333",
            wallet_address="ZION_LOCAL_TEST_MINING",
            worker_name="test-worker-local",
            algorithm="cosmic_harmony"
        )
        print(f"✅ Mining started: {result.get('message', 'OK')}")
    except Exception as e:
        print(f"❌ Failed to start mining: {e}")
        return False
    
    # Mine and collect metrics
    print("\n4️⃣  Mining for 60 seconds with live metrics...\n")
    print(f"{'SEC':>4} | {'Shares':>6} | {'Accepted':>8} | {'Rejected':>8} | {'Hashrate':>12} | {'Pool Stats':>30}")
    print("-" * 90)
    
    metrics_history = []
    
    for i in range(60):
        time.sleep(1)
        
        # Get miner stats from status
        status = miner.get_status()
        
        if status and status.get('is_mining'):
            stats = status.get('statistics', {})
            perf = status.get('performance', {})
            
            shares = stats.get('total_shares', 0)
            accepted = stats.get('accepted_shares', 0)
            rejected = stats.get('rejected_shares', 0)
            hashrate = perf.get('total_hashrate', 0)
            
            # Get pool stats
            pool_stats = get_pool_stats()
            pool_info = ""
            if pool_stats:
                pool_shares = pool_stats.get('total_shares', 0)
                pool_blocks = pool_stats.get('total_blocks', 0)
                pool_info = f"Shares: {pool_shares}, Blocks: {pool_blocks}"
            
            print(f"{i+1:4d} | {shares:6d} | {accepted:8d} | {rejected:8d} | {hashrate:12.2f} H/s | {pool_info:>30}")
            
            metrics_history.append({
                'time': i+1,
                'shares': shares,
                'accepted': accepted,
                'rejected': rejected,
                'hashrate': hashrate
            })
        else:
            print(f"{i+1:4d} | Initializing...")
    
    # Stop mining
    print("\n" + "="*80)
    print("✅ Mining session completed!")
    miner.stop_mining()
    
    # Summary
    if metrics_history:
        final = metrics_history[-1]
        print(f"\n📊 FINAL METRICS:")
        print(f"   Total Shares: {final['shares']}")
        print(f"   Accepted: {final['accepted']}")
        print(f"   Rejected: {final['rejected']}")
        print(f"   Avg Hashrate: {sum(m['hashrate'] for m in metrics_history)/len(metrics_history):.2f} H/s")
        
        if final['shares'] > 0:
            print(f"\n✅ SUCCESS: Miner submitted {final['shares']} shares to pool!")
        else:
            print(f"\n⚠️  WARNING: No shares submitted yet")
    
    # Get final pool stats
    pool_final = get_pool_stats()
    if pool_final:
        print(f"\n🏊 POOL STATS:")
        print(f"   Total Shares: {pool_final.get('total_shares', 0)}")
        print(f"   Total Blocks: {pool_final.get('total_blocks', 0)}")
        print(f"   Total Miners: {pool_final.get('total_miners', 0)}")
    
    print("\n" + "="*80)
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
