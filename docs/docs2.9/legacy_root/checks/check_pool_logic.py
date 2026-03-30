#!/usr/bin/env python3
"""Kontrola logiky poolu a rozdělení rewards"""
import sys
sys.path.insert(0, "/app")

print(f"\n🏊 POOL LOGIC - ANALÝZA\n" + "=" * 100)

# 1. Reward Calculator
from src.pool.blockchain.reward_calculator import RewardCalculator
from decimal import Decimal

config = {
    "fee_percent": 1.0,
    "consciousness_tithe": 1.618,
    "humanitarian_address": "zion1humanitarian_address_for_consciousness_fund"
}

calc = RewardCalculator(config)

print(f"\n💰 REWARD CALCULATOR:")
print(f"   Base Block Reward: {calc.BASE_BLOCK_REWARD} ZION")
print(f"   Pool Fee: {calc.pool_fee * 100}%")
print(f"   Humanitarian Tithe: {calc.humanitarian_tithe * 100}%")
print(f"   Humanitarian Address: {calc.humanitarian_address[:50]}...")

# Test reward distribution
block_reward = calc.calculate_block_reward(17)
distribution = calc.calculate_miner_reward(block_reward)

print(f"\n📊 BLOK #17 - REWARD DISTRIBUTION:")
print(f"   Total Block Reward:     {distribution['total']:>12} ZION")
print(f"   - Humanitarian Tithe:   {distribution['humanitarian_tithe']:>12} ZION ({calc.humanitarian_tithe*100}%)")
print(f"   - Pool Fee:             {distribution['pool_fee']:>12} ZION ({calc.pool_fee*100}%)")
print(f"   ─────────────────────────────────────")
print(f"   = Miner Receives:       {distribution['miner_reward']:>12} ZION")

# 2. PPLNS Share Calculation
print(f"\n⛏️  PPLNS - PAY PER LAST N SHARES:")
print(f"   Příklad: 3 mineři najdou blok")

shares_a = Decimal("1000000")  # Miner A: 1M difficulty
shares_b = Decimal("500000")   # Miner B: 500k difficulty  
shares_c = Decimal("250000")   # Miner C: 250k difficulty
total_diff = shares_a + shares_b + shares_c

miner_reward = distribution['miner_reward']

reward_a = calc.calculate_share_reward(shares_a, total_diff, miner_reward)
reward_b = calc.calculate_share_reward(shares_b, total_diff, miner_reward)
reward_c = calc.calculate_share_reward(shares_c, total_diff, miner_reward)

print(f"\n   Miner A (1,000,000 diff): {reward_a:.6f} ZION ({shares_a/total_diff*100:.1f}%)")
print(f"   Miner B (  500,000 diff): {reward_b:.6f} ZION ({shares_b/total_diff*100:.1f}%)")
print(f"   Miner C (  250,000 diff): {reward_c:.6f} ZION ({shares_c/total_diff*100:.1f}%)")
print(f"   ─────────────────────────────────────")
print(f"   Total:                   {reward_a + reward_b + reward_c:.6f} ZION")
print(f"   (should equal miner_reward: {miner_reward})")

# 3. Halving Schedule
print(f"\n📉 HALVING SCHEDULE:")
test_heights = [0, 1, 210000, 420000, 630000, 840000]
for h in test_heights:
    r = calc.calculate_block_reward(h)
    print(f"   Block {h:>7,}: {r:>10} ZION")

# 4. Database Status
print(f"\n💾 POOL DATABASE:")
import os
db_path = "/app/pool.db"
if os.path.exists(db_path):
    size = os.path.getsize(db_path)
    print(f"   ✅ Database exists: {db_path}")
    print(f"   Size: {size:,} bytes")
    
    import sqlite3
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f"\n   📊 Tables:")
    for (table_name,) in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cursor.fetchone()[0]
        print(f"      - {table_name}: {count} rows")
    
    conn.close()
else:
    print(f"   ⚠️  Database neexistuje: {db_path}")
    print(f"   Pool zatím neukládá statistiky do DB")
    print(f"   (funguje pouze in-memory)")

print(f"\n{'=' * 100}\n")
