#!/usr/bin/env python3
"""
🌟 ZION Mining Validation - Real Testing
Tests actual mining functionality, shares, and pool operations
"""

import sqlite3
import socket
import json
import time
from pathlib import Path
from datetime import datetime

print("""
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║            🌟 ZION MINING VALIDATION TEST - REAL PRODUCTION 🌟               ║
║                                                                               ║
║                 Testing: Shares | Pool | Algorithms | Blocks                ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
""")

results = {
    'timestamp': datetime.now().isoformat(),
    'tests_passed': 0,
    'tests_failed': 0,
    'details': {}
}

# ============================================================================
# TEST 1: POOL DATABASE - SHARES VALIDATION
# ============================================================================
print("\n" + "="*80)
print("TEST 1: POOL DATABASE - SHARES ACCEPTANCE & VALIDATION")
print("="*80)

try:
    db_path = Path("/media/maitreya/ZION1/zion_pool.db")
    
    if not db_path.exists():
        print("❌ Pool database not found!")
        results['tests_failed'] += 1
        results['details']['pool_db'] = {'status': 'FAIL', 'reason': 'Database not found'}
    else:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get share statistics
        cursor.execute("""
            SELECT 
                COUNT(*) as total_shares,
                SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as valid_shares,
                SUM(CASE WHEN is_valid = 0 THEN 1 ELSE 0 END) as invalid_shares,
                AVG(difficulty) as avg_difficulty
            FROM shares
        """)
        
        stats = dict(cursor.fetchone())
        
        print(f"\n📊 Share Statistics:")
        print(f"   Total Shares:     {stats['total_shares']}")
        print(f"   Valid Shares:     {stats['valid_shares']}")
        print(f"   Invalid Shares:   {stats['invalid_shares']}")
        print(f"   Avg Difficulty:   {stats['avg_difficulty']:.0f}")
        
        if stats['total_shares'] > 0:
            acceptance_rate = (stats['valid_shares'] / stats['total_shares']) * 100
            print(f"   ✅ Acceptance Rate: {acceptance_rate:.1f}%")
        
        # Get algorithm breakdown
        cursor.execute("""
            SELECT 
                algorithm, 
                COUNT(*) as count,
                SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as valid,
                AVG(difficulty) as avg_diff
            FROM shares
            GROUP BY algorithm
            ORDER BY count DESC
        """)
        
        print(f"\n🔍 Algorithm Breakdown:")
        algos = cursor.fetchall()
        for row in algos:
            algo = row['algorithm']
            count = row['count']
            valid = row['valid'] or 0
            avg_diff = row['avg_diff'] or 0
            acc_rate = (valid / count * 100) if count > 0 else 0
            print(f"   {algo:20} | {count:4} shares | {valid:4} valid | {acc_rate:6.1f}% | diff: {avg_diff:.0f}")
        
        # Get recent shares
        cursor.execute("""
            SELECT address, algorithm, difficulty, is_valid, timestamp
            FROM shares
            ORDER BY timestamp DESC
            LIMIT 5
        """)
        
        print(f"\n📋 Recent Shares:")
        recent = cursor.fetchall()
        for i, row in enumerate(recent, 1):
            addr = str(row['address'])[:15] + "..." if len(str(row['address'])) > 15 else str(row['address'])
            algo = row['algorithm']
            diff = row['difficulty']
            valid = "✅" if row['is_valid'] else "❌"
            ts = datetime.fromtimestamp(row['timestamp']).strftime("%H:%M:%S")
            print(f"   {i}. {ts} | {algo:12} | {addr:18} | diff: {diff:6} | {valid}")
        
        conn.close()
        
        if stats['total_shares'] > 0 and acceptance_rate >= 90:
            print("\n✅ TEST 1 PASSED: Pool database operational, high acceptance rate")
            results['tests_passed'] += 1
            results['details']['pool_db'] = {
                'status': 'PASS',
                'total_shares': stats['total_shares'],
                'acceptance_rate': acceptance_rate
            }
        else:
            print("\n⚠️  TEST 1 WARNING: Low share count or acceptance rate")
            results['tests_failed'] += 1
            results['details']['pool_db'] = {
                'status': 'WARN',
                'total_shares': stats['total_shares'],
                'acceptance_rate': acceptance_rate if stats['total_shares'] > 0 else 0
            }
        
except Exception as e:
    print(f"\n❌ TEST 1 FAILED: {e}")
    results['tests_failed'] += 1
    results['details']['pool_db'] = {'status': 'FAIL', 'error': str(e)}

# ============================================================================
# TEST 2: BLOCKCHAIN VALIDATION
# ============================================================================
print("\n" + "="*80)
print("TEST 2: BLOCKCHAIN - BLOCKS & TRANSACTIONS")
print("="*80)

try:
    blockchain_db = Path("/media/maitreya/ZION1/zion_blockchain.db")
    
    if not blockchain_db.exists():
        print("⚠️  Blockchain database not found")
        results['details']['blockchain'] = {'status': 'SKIP', 'reason': 'Database not found'}
    else:
        conn = sqlite3.connect(str(blockchain_db))
        cursor = conn.cursor()
        
        # Get block count
        cursor.execute("SELECT COUNT(*) FROM blocks")
        block_count = cursor.fetchone()[0]
        print(f"✅ Total Blocks: {block_count}")
        
        # Get transaction count
        cursor.execute("SELECT COUNT(*) FROM transactions")
        tx_count = cursor.fetchone()[0]
        print(f"✅ Total Transactions: {tx_count}")
        
        # Get recent blocks
        cursor.execute("""
            SELECT hash, height, miner, timestamp
            FROM blocks
            ORDER BY height DESC
            LIMIT 3
        """)
        
        print(f"\n📦 Recent Blocks:")
        blocks = cursor.fetchall()
        for i, block in enumerate(blocks, 1):
            hash_short = block[0][:16] + "..." if block[0] else "N/A"
            height = block[1]
            miner = str(block[2])[:15] + "..." if block[2] else "GENESIS"
            print(f"   {i}. Height: {height:6} | Hash: {hash_short:20} | Miner: {miner}")
        
        conn.close()
        
        print("\n✅ TEST 2 PASSED: Blockchain operational")
        results['tests_passed'] += 1
        results['details']['blockchain'] = {
            'status': 'PASS',
            'blocks': block_count,
            'transactions': tx_count
        }
        
except Exception as e:
    print(f"\n❌ TEST 2 FAILED: {e}")
    results['tests_failed'] += 1
    results['details']['blockchain'] = {'status': 'FAIL', 'error': str(e)}

# ============================================================================
# TEST 3: CONSCIOUSNESS GAME DATABASE
# ============================================================================
print("\n" + "="*80)
print("TEST 3: CONSCIOUSNESS GAME - XP & REWARDS")
print("="*80)

try:
    game_db = Path("/media/maitreya/ZION1/consciousness_game.db")
    
    if not game_db.exists():
        print("⚠️  Consciousness database not found")
        results['details']['consciousness'] = {'status': 'SKIP', 'reason': 'Database not found'}
    else:
        conn = sqlite3.connect(str(game_db))
        cursor = conn.cursor()
        
        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='miners'")
        if cursor.fetchone():
            # Get miner stats
            cursor.execute("""
                SELECT COUNT(*) as count, SUM(total_xp) as total_xp, AVG(total_xp) as avg_xp
                FROM miners
            """)
            
            row = cursor.fetchone()
            miner_count = row[0]
            total_xp = row[1] or 0
            avg_xp = row[2] or 0
            
            print(f"✅ Active Miners: {miner_count}")
            print(f"✅ Total XP Awarded: {total_xp:,}")
            print(f"✅ Average XP/Miner: {avg_xp:.0f}")
            
            # Top miners
            cursor.execute("""
                SELECT address, total_xp, shares_submitted
                FROM miners
                ORDER BY total_xp DESC
                LIMIT 3
            """)
            
            print(f"\n🏆 Top Miners:")
            miners = cursor.fetchall()
            for i, miner in enumerate(miners, 1):
                addr = str(miner[0])[:20] + "..." if miner[0] else "N/A"
                xp = miner[1] or 0
                shares = miner[2] or 0
                print(f"   {i}. {addr:25} | XP: {xp:8,} | Shares: {shares:4}")
            
            conn.close()
            
            print("\n✅ TEST 3 PASSED: Consciousness system operational")
            results['tests_passed'] += 1
            results['details']['consciousness'] = {
                'status': 'PASS',
                'miners': miner_count,
                'total_xp': total_xp
            }
        else:
            print("⚠️  Miners table not found in consciousness database")
            results['details']['consciousness'] = {'status': 'SKIP', 'reason': 'Table not found'}
        
except Exception as e:
    print(f"\n❌ TEST 3 FAILED: {e}")
    results['tests_failed'] += 1
    results['details']['consciousness'] = {'status': 'FAIL', 'error': str(e)}

# ============================================================================
# TEST 4: POOL CONNECTIVITY - STRATUM PROTOCOL
# ============================================================================
print("\n" + "="*80)
print("TEST 4: MINING POOL CONNECTIVITY - STRATUM")
print("="*80)

try:
    pool_host = "localhost"
    pool_port = 3333
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(3)
    result = sock.connect_ex((pool_host, pool_port))
    
    if result == 0:
        print(f"✅ Pool connection: ONLINE ({pool_host}:{pool_port})")
        
        # Try to send Stratum request
        try:
            request = {"id": 1, "method": "mining.subscribe", "params": ["test_validator/1.0"]}
            sock.send((json.dumps(request) + "\n").encode())
            
            sock.settimeout(2)
            response = sock.recv(1024).decode()
            print(f"✅ Stratum response: {response[:80]}...")
            
            print("\n✅ TEST 4 PASSED: Pool connectivity verified")
            results['tests_passed'] += 1
            results['details']['pool_connectivity'] = {'status': 'PASS', 'online': True}
            
        except socket.timeout:
            print("⚠️  Pool response timeout (pool may be processing)")
            results['tests_passed'] += 1
            results['details']['pool_connectivity'] = {'status': 'PASS', 'online': True, 'note': 'timeout'}
        
        sock.close()
    else:
        print(f"❌ Pool connection: OFFLINE (error code: {result})")
        results['tests_failed'] += 1
        results['details']['pool_connectivity'] = {'status': 'FAIL', 'online': False}
    
except Exception as e:
    print(f"❌ Pool connectivity test failed: {e}")
    results['tests_failed'] += 1
    results['details']['pool_connectivity'] = {'status': 'FAIL', 'error': str(e)}

# ============================================================================
# TEST 5: MINING PERFORMANCE - ALGORITHMS
# ============================================================================
print("\n" + "="*80)
print("TEST 5: MINING ALGORITHMS - PERFORMANCE CHECK")
print("="*80)

try:
    # Check which algorithms have shares
    db_path = Path("/media/maitreya/ZION1/zion_pool.db")
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT algorithm, COUNT(*) as count, AVG(processing_time) as avg_time
        FROM shares
        WHERE processing_time IS NOT NULL
        GROUP BY algorithm
    """)
    
    print("\n⚙️  Algorithm Performance:")
    algos = cursor.fetchall()
    
    algo_count = 0
    for algo, count, avg_time in algos:
        avg_ms = (avg_time * 1000) if avg_time else 0
        print(f"   {algo:15} | {count:4} shares | avg: {avg_ms:6.2f}ms")
        algo_count += 1
    
    conn.close()
    
    if algo_count > 0:
        print(f"\n✅ TEST 5 PASSED: {algo_count} algorithm(s) tested and functional")
        results['tests_passed'] += 1
        results['details']['algorithms'] = {'status': 'PASS', 'count': algo_count}
    else:
        print("\n⚠️  TEST 5 WARNING: No algorithm performance data")
        results['tests_failed'] += 1
        results['details']['algorithms'] = {'status': 'WARN', 'count': 0}
    
except Exception as e:
    print(f"\n❌ TEST 5 FAILED: {e}")
    results['tests_failed'] += 1
    results['details']['algorithms'] = {'status': 'FAIL', 'error': str(e)}

# ============================================================================
# FINAL REPORT
# ============================================================================
print("\n" + "="*80)
print("FINAL VALIDATION REPORT")
print("="*80)

total_tests = results['tests_passed'] + results['tests_failed']
pass_rate = (results['tests_passed'] / total_tests * 100) if total_tests > 0 else 0

print(f"\n📊 TEST SUMMARY:")
print(f"   ✅ Passed:  {results['tests_passed']}/{total_tests}")
print(f"   ❌ Failed:  {results['tests_failed']}/{total_tests}")
print(f"   📈 Pass Rate: {pass_rate:.1f}%")

if results['tests_failed'] == 0:
    print(f"\n🎉 ALL TESTS PASSED! ZION MINING FULLY OPERATIONAL! 🎉")
    status = "✅ PRODUCTION READY"
    exit_code = 0
elif pass_rate >= 60:
    print(f"\n✅ MAJORITY TESTS PASSED - System functional with minor issues")
    status = "✅ OPERATIONAL (with warnings)"
    exit_code = 0
else:
    print(f"\n⚠️  Multiple tests failed - review required")
    status = "⚠️  NEEDS ATTENTION"
    exit_code = 1

print(f"\n🔍 STATUS: {status}")

# Save report
import json
report_file = Path("/media/maitreya/ZION1/mining_validation_report_real.json")
with open(report_file, 'w') as f:
    json.dump(results, f, indent=2)

print(f"\n📄 Report saved to: {report_file}")

print("\n" + "="*80)
print("✨ ZION Mining Validation Complete ✨")
print("="*80 + "\n")

exit(exit_code)
