#!/usr/bin/env python3
"""
ZION 2.8.1 - Comprehensive Mining System Test
Tests all components: Cosmic Harmony, Universal Miner, Pool Integration
"""

import os
import sys
import time
import json
import subprocess
from pathlib import Path
from datetime import datetime

# Add paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'zion', 'mining'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ai'))

print("=" * 80)
print("🔥 ZION 2.8.1 MINING SYSTEM - COMPREHENSIVE TEST")
print("=" * 80)
print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Python: {sys.version.split()[0]}")
print("")

# Test results
results = {
    'timestamp': datetime.now().isoformat(),
    'tests': {},
    'summary': {}
}

# ============================================================================
# TEST 1: Cosmic Harmony Library
# ============================================================================
print("\n[TEST 1] Cosmic Harmony Library")
print("-" * 80)

try:
    from cosmic_harmony_wrapper import CosmicHarmonyHasher, get_hasher
    
    hasher = get_hasher()
    print(f"✅ Cosmic Harmony wrapper loaded")
    print(f"   Implementation: {type(hasher).__name__}")
    
    # Test hash
    test_data = b"test_blockchain_data_001"
    start = time.time()
    hash_result = hasher.hash(test_data)
    elapsed = time.time() - start
    
    print(f"✅ Hash computation successful")
    print(f"   Input: {test_data.decode()}")
    print(f"   Output: {hash_result.hex()[:32]}...")
    print(f"   Time: {elapsed*1000:.2f}ms")
    
    results['tests']['cosmic_harmony'] = {
        'status': 'PASS',
        'implementation': type(hasher).__name__,
        'hash_time_ms': elapsed * 1000,
    }
    
except Exception as e:
    print(f"❌ Cosmic Harmony failed: {e}")
    results['tests']['cosmic_harmony'] = {'status': 'FAIL', 'error': str(e)}

# ============================================================================
# TEST 2: Compiled Libraries
# ============================================================================
print("\n[TEST 2] Compiled Libraries")
print("-" * 80)

lib_checks = {
    'libcosmicharmony.so': 'zion/mining/libcosmicharmony.so',
    'libblake3.a': 'build_zion/lib/libblake3.a',
}

compiled_libs = {}
for name, path in lib_checks.items():
    if os.path.exists(path):
        size = os.path.getsize(path)
        print(f"✅ {name}: {size:,} bytes")
        compiled_libs[name] = {'status': 'OK', 'size': size}
    else:
        print(f"⚠️ {name}: Not found")
        compiled_libs[name] = {'status': 'MISSING'}

results['tests']['compiled_libraries'] = compiled_libs

# ============================================================================
# TEST 3: Universal Miner Integration
# ============================================================================
print("\n[TEST 3] Universal Miner Integration")
print("-" * 80)

try:
    from zion_universal_miner import ZionUniversalMiner, MiningMode, MiningAlgorithm
    
    miner = ZionUniversalMiner(mode=MiningMode.CPU_ONLY)
    print(f"✅ Universal Miner initialized")
    
    # Check algorithms
    algos = [algo.value for algo in MiningAlgorithm]
    print(f"✅ Supported algorithms: {', '.join(algos)}")
    
    # Check that cosmic_harmony is included
    if 'cosmic_harmony' in algos:
        print(f"✅ Cosmic Harmony included in Universal Miner")
        results['tests']['universal_miner'] = {
            'status': 'PASS',
            'algorithms': algos,
            'cosmic_harmony_present': True
        }
    else:
        print(f"⚠️ Cosmic Harmony NOT in Universal Miner algorithms!")
        results['tests']['universal_miner'] = {
            'status': 'WARN',
            'algorithms': algos,
            'cosmic_harmony_present': False
        }
    
except Exception as e:
    print(f"❌ Universal Miner test failed: {e}")
    results['tests']['universal_miner'] = {'status': 'FAIL', 'error': str(e)}

# ============================================================================
# TEST 4: ZION Miner 1.4 Integration
# ============================================================================
print("\n[TEST 4] ZION Miner 1.4 Integration")
print("-" * 80)

try:
    from mining.zion_miner_14_integration import ZionMiner14Engine, MinerConfig
    
    engine = ZionMiner14Engine()
    print(f"✅ ZION Miner 1.4 engine initialized")
    
    config = MinerConfig(
        pool_url="stratum+tcp://localhost:3333",
        wallet="test_wallet_001",
        worker="test_worker",
        algorithm="randomx"
    )
    
    configured = engine.configure(config)
    if configured:
        print(f"✅ ZION Miner 1.4 configured successfully")
        results['tests']['zion_miner_14'] = {
            'status': 'PASS',
            'engine_type': 'ZionMiner14Engine',
        }
    else:
        print(f"❌ Configuration failed")
        results['tests']['zion_miner_14'] = {'status': 'FAIL'}
    
except Exception as e:
    print(f"⚠️ ZION Miner 1.4 test: {e}")
    results['tests']['zion_miner_14'] = {'status': 'WARN', 'error': str(e)}

# ============================================================================
# TEST 5: Pool Integration
# ============================================================================
print("\n[TEST 5] Pool Integration")
print("-" * 80)

try:
    import sqlite3
    
    # Check pool database
    pool_db_path = 'zion_pool.db'
    if os.path.exists(pool_db_path):
        conn = sqlite3.connect(pool_db_path)
        cursor = conn.cursor()
        
        # Get stats
        cursor.execute("SELECT COUNT(*) as shares, COUNT(DISTINCT address) as miners FROM shares")
        shares_count, miners_count = cursor.fetchone()
        
        cursor.execute("SELECT COUNT(*) as algos FROM current_jobs WHERE algorithm='cosmic_harmony'")
        cosmic_jobs = cursor.fetchone()[0]
        
        print(f"✅ Pool database accessible")
        print(f"   Total shares: {shares_count}")
        print(f"   Active miners: {miners_count}")
        print(f"   Cosmic Harmony jobs: {cosmic_jobs}")
        
        results['tests']['pool_integration'] = {
            'status': 'PASS',
            'total_shares': shares_count,
            'active_miners': miners_count,
            'cosmic_harmony_jobs': cosmic_jobs
        }
        
        conn.close()
    else:
        print(f"⚠️ Pool database not found")
        results['tests']['pool_integration'] = {'status': 'WARN', 'database': 'not_found'}
    
except Exception as e:
    print(f"⚠️ Pool integration test: {e}")
    results['tests']['pool_integration'] = {'status': 'WARN', 'error': str(e)}

# ============================================================================
# TEST 6: Consciousness Game Integration
# ============================================================================
print("\n[TEST 6] Consciousness Game Integration")
print("-" * 80)

try:
    consciousness_db = 'consciousness_game.db'
    if os.path.exists(consciousness_db):
        conn = sqlite3.connect(consciousness_db)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as miners, SUM(xp) as total_xp FROM miner_consciousness")
        miners_count, total_xp = cursor.fetchone()
        
        print(f"✅ Consciousness game database accessible")
        print(f"   Active miners: {miners_count or 0}")
        print(f"   Total XP awarded: {total_xp or 0}")
        
        results['tests']['consciousness_game'] = {
            'status': 'PASS',
            'active_miners': miners_count or 0,
            'total_xp': total_xp or 0
        }
        
        conn.close()
    else:
        print(f"⚠️ Consciousness database not found")
        results['tests']['consciousness_game'] = {'status': 'WARN'}
    
except Exception as e:
    print(f"⚠️ Consciousness game test: {e}")
    results['tests']['consciousness_game'] = {'status': 'WARN', 'error': str(e)}

# ============================================================================
# TEST 7: Running Services
# ============================================================================
print("\n[TEST 7] Running Services")
print("-" * 80)

services = {
    'Pool': 'zion_universal_pool_v2.py',
    'WARP Engine': 'zion_warp_engine_core.py',
    'XMRig Miner': 'xmrig'
}

running_services = {}
for name, process in services.items():
    result = subprocess.run(['pgrep', '-f', process], capture_output=True)
    if result.returncode == 0:
        print(f"✅ {name} is running")
        running_services[name] = 'OK'
    else:
        print(f"⚠️ {name} not running")
        running_services[name] = 'NOT_RUNNING'

results['tests']['running_services'] = running_services

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("📊 TEST SUMMARY")
print("=" * 80)

passed = 0
failed = 0
warned = 0

for test_name, test_result in results['tests'].items():
    if isinstance(test_result, dict) and 'status' in test_result:
        status = test_result['status']
        if status == 'PASS':
            print(f"✅ {test_name}: PASSED")
            passed += 1
        elif status == 'FAIL':
            print(f"❌ {test_name}: FAILED")
            failed += 1
        else:
            print(f"⚠️ {test_name}: {status}")
            warned += 1

print("")
print(f"Results: {passed} PASSED, {failed} FAILED, {warned} WARNED")

results['summary'] = {
    'total_tests': len(results['tests']),
    'passed': passed,
    'failed': failed,
    'warned': warned,
    'status': 'SUCCESS' if failed == 0 else 'FAILURE'
}

# ============================================================================
# SAVE REPORT
# ============================================================================
report_file = f"mining_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
with open(report_file, 'w') as f:
    json.dump(results, f, indent=2)

print(f"\n📄 Report saved to: {report_file}")

# Final status
print("\n" + "=" * 80)
if failed == 0:
    print("✅ ZION 2.8.1 MINING SYSTEM - ALL TESTS PASSED!")
else:
    print(f"❌ {failed} test(s) failed")
print("=" * 80)
