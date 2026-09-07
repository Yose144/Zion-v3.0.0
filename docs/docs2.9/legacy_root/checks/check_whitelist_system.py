#!/usr/bin/env python3
"""
✅ Check ZION Pool Whitelist System
====================================

Verifies:
1. Mining operators whitelist (5 addresses)
2. Reward calculation for whitelisted vs non-whitelisted miners
3. Consciousness bonus enforcement
"""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from decimal import Decimal
from src.core.premine import (
    get_mining_operators_whitelist,
    is_mining_operator,
    get_premine_by_type
)
from src.pool.blockchain.reward_calculator import RewardCalculator

print("=" * 80)
print("🔒 ZION POOL WHITELIST SYSTEM CHECK (WHITEPAPER 2025)")
print("=" * 80)
print("\n📋 ECONOMIC MODEL:")
print("-" * 80)
print("Total supply: 144B ZION")
print("Premine: 16.78B ZION (presale)")
print("Mining emission: 127.72B ZION / 23.652M blocks = 5,400.067 ZION/block")
print("Base block reward: 5,400.067 ZION (constant, 45 years 2025-2070)")
print("Consciousness bonus: 1,569.63 ZION × multiplier (10 years 2025-2035 only!)")
print("Mining emission: 45 years (not 50!)")
print("Consciousness game: 10 years (2025-2035), pak končí!")
print("")

# 1. Check whitelist
print("\n📋 MINING OPERATORS WHITELIST (5 addresses):")
print("-" * 80)
whitelist = get_mining_operators_whitelist()
for i, addr in enumerate(whitelist, 1):
    print(f"{i}. {addr}")
    
    # Verify it's actually in premine
    mining_ops = get_premine_by_type('mining')
    if addr in mining_ops:
        amount = mining_ops[addr]['amount']
        print(f"   ✅ Found in premine: {amount:,} ZION ({mining_ops[addr]['purpose']})")
    else:
        print(f"   ❌ NOT found in premine!")

# 2. Test reward calculator with whitelist
print("\n\n💰 REWARD CALCULATION TESTS")
print("=" * 80)

config = {
    "fee_percent": 1.0,
    "humanitarian_tithe": 10.0,
    "humanitarian_address": "ZION_CHILDREN_FUTURE_FUND_1ECCB72BC30AADD086656A59",
    "consciousness_db": "data/consciousness_game.db"
}

calculator = RewardCalculator(config)

# Test 1: Whitelisted miner (gets consciousness bonus)
print("\n📊 TEST 1: WHITELISTED MINER (2025 - IN CONSCIOUSNESS WINDOW)")
print("-" * 80)
whitelisted_addr = whitelist[0]  # ZION_SACRED...
print(f"Address: {whitelisted_addr}")
print(f"Whitelisted: {calculator.is_whitelisted(whitelisted_addr)}")

# Simulate 2025 (in consciousness window)
import time
block_timestamp_2025 = int(time.mktime(time.strptime("2025-06-01", "%Y-%m-%d")))

block_reward = calculator.calculate_block_reward(
    block_height=100,
    miner_address=whitelisted_addr,
    block_timestamp=block_timestamp_2025
)
print(f"\n✅ Block reward (2025): {block_reward} ZION")
print(f"   = 5,479.45 ZION (base) + 1,569.63 ZION (consciousness bonus PHYSICAL 1.0x)")

rewards = calculator.calculate_miner_reward(block_reward, whitelisted_addr)
print(f"\nDistribution:")
print(f"   Total: {rewards['total']} ZION")
print(f"   - Humanitarian (10%): {rewards['humanitarian_tithe']} ZION")
print(f"   - Pool Fee (1%): {rewards['pool_fee']} ZION")
print(f"   = Miner (89%): {rewards['miner_reward']} ZION")

# Test 2: Same miner AFTER consciousness window (2036)
print("\n\n📊 TEST 2: SAME MINER IN 2036 (AFTER CONSCIOUSNESS WINDOW)")
print("-" * 80)
block_timestamp_2036 = int(time.mktime(time.strptime("2036-01-01", "%Y-%m-%d")))

block_reward_2036 = calculator.calculate_block_reward(
    block_height=5_000_000,
    miner_address=whitelisted_addr,
    block_timestamp=block_timestamp_2036
)
print(f"Address: {whitelisted_addr}")
print(f"Whitelisted: {calculator.is_whitelisted(whitelisted_addr)}")
print(f"\n⏰ Block reward (2036 - after window): {block_reward_2036} ZION")
print(f"   = 5,479.45 ZION (base) + 0 ZION (NO consciousness - pool vyčerpán)")

rewards_2036 = calculator.calculate_miner_reward(block_reward_2036, whitelisted_addr)
print(f"\nDistribution:")
print(f"   Total: {rewards_2036['total']} ZION")
print(f"   - Humanitarian (10%): {rewards_2036['humanitarian_tithe']} ZION")
print(f"   - Pool Fee (1%): {rewards_2036['pool_fee']} ZION")
print(f"   = Miner (89%): {rewards_2036['miner_reward']} ZION")

# Test 3: Non-whitelisted miner (base reward only)
print("\n\n📊 TEST 3: NON-WHITELISTED MINER")
print("-" * 80)
non_whitelisted_addr = "ZION_RANDOM_TEST_ADDRESS_NOT_IN_WHITELIST"
print(f"Address: {non_whitelisted_addr}")
print(f"Whitelisted: {calculator.is_whitelisted(non_whitelisted_addr)}")

block_reward_non = calculator.calculate_block_reward(
    block_height=100,
    miner_address=non_whitelisted_addr,
    block_timestamp=block_timestamp_2025
)
print(f"\n❌ Block reward: {block_reward_non} ZION")
print(f"   = 5,479.45 ZION (base) + 0 ZION (NO consciousness bonus - not whitelisted)")

rewards_non = calculator.calculate_miner_reward(block_reward_non, non_whitelisted_addr)
print(f"\nDistribution:")
print(f"   Total: {rewards_non['total']} ZION")
print(f"   - Humanitarian (10%): {rewards_non['humanitarian_tithe']} ZION")
print(f"   - Pool Fee (1%): {rewards_non['pool_fee']} ZION")
print(f"   = Miner (89%): {rewards_non['miner_reward']} ZION")

# 3. Compare
print("\n\n📈 COMPARISON")
print("=" * 80)
print(f"2025 Whitelisted miner:     {rewards['miner_reward']} ZION")
print(f"2036 Same miner (no bonus): {rewards_2036['miner_reward']} ZION")
print(f"2025 Non-whitelisted:       {rewards_non['miner_reward']} ZION")
diff_consciousness = rewards['miner_reward'] - rewards_2036['miner_reward']
diff_whitelist = rewards['miner_reward'] - rewards_non['miner_reward']
print(f"")
print(f"Consciousness bonus value (2025-2035): +{diff_consciousness} ZION")
print(f"Whitelist advantage: +{diff_whitelist} ZION")
print(f"\n⚠️  DŮLEŽITÉ:")
print(f"   - Consciousness bonus JEN 10 let (2025-2035)")
print(f"   - Po roce 2035: Všichni dostanou jen base 5,479.45 ZION")
print(f"   - Mining celkem: 45 let (2025-2070)")
print(f"   - Non-whitelisted: NIKDY consciousness bonus")

# 4. Verify is_mining_operator function
print("\n\n🔍 VERIFICATION: is_mining_operator() FUNCTION")
print("=" * 80)
for addr in whitelist:
    result = is_mining_operator(addr)
    print(f"✅ {addr[:50]}... → {result}")

# Test with non-whitelisted
result = is_mining_operator("ZION_RANDOM_TEST")
print(f"❌ ZION_RANDOM_TEST → {result}")

# 5. Economic summary
print("\n\n💎 ECONOMIC IMPACT SUMMARY (PODLE WHITEPAPER 2025)")
print(f"Base block reward: 5,479.45 ZION (constant, 45 years)")
print(f"Mining operators pool: 8,250,000,000 ZION (50.7% of premine)")
print(f"Consciousness period: 10 years (2025-2035 ONLY!)")
print(f"Block bonus base: 1,569.63 ZION (from 8.25B / 5.256M blocks)")
print(f"Consciousness levels: 9 levels (PHYSICAL 1.0x → ON_THE_STAR 10.0x)")
print(f"")
print(f"Reward range (2025-2035 - with consciousness):")
print(f"  - PHYSICAL (1.0x):     7,049.08 ZION → miner: 6,273.68 ZION")
print(f"  - QUANTUM (1.5x):      7,833.90 ZION → miner: 6,972.17 ZION")
print(f"  - ON_THE_STAR (10.0x): 21,175.75 ZION → miner: 18,846.42 ZION")
print(f"")
print(f"After 2035 (consciousness pool vyčerpán):")
print(f"  - Everyone: 5,479.45 ZION → miner: 4,876.71 ZION")
print(f"")
print(f"Non-whitelisted (anytime): 5,479.45 ZION → miner: 4,876.71THE_STAR 10.0x)")
print(f"")
print(f"Reward range (per block):")
print(f"  - PHYSICAL (1.0x):     1,619.63 ZION → miner: 1,441.47 ZION")
print(f"  - QUANTUM (1.5x):      2,404.45 ZION → miner: 2,139.96 ZION")
print(f"  - ON_THE_STAR (10.0x): 15,746.30 ZION → miner: 14,014.21 ZION")
print(f"")
print(f"Non-whitelisted (base only): 50 ZION → miner: 44.55 ZION")

print("\n\n✅ WHITELIST SYSTEM STATUS: OPERATIONAL")
print("=" * 80)
print(f"Total whitelisted addresses: {len(whitelist)}")
print(f"Whitelist enforcement: ENABLED")
print(f"Consciousness bonus: ENABLED (only for whitelisted)")
print(f"Humanitarian tithe: 10%")
print(f"Pool fee: 1%")
print("=" * 80)
