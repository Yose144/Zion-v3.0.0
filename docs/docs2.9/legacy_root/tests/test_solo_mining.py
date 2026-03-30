#!/usr/bin/env python3
"""
Simple Solo Mining Test - Direct Blockchain
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

import time
import json
from decimal import Decimal
from src.core.blockchain import Blockchain
from src.core.block import Block
from src.core.transaction import Transaction
import hashlib

# Whitelist address
MINER_ADDRESS = "ZION_SACRED_B0FA7E2A234D8C2F08545F02295C98"

def simple_mine_block(blockchain, miner_address):
    """Mine a simple block with low difficulty"""
    print(f"\n⛏️  Mining block {blockchain.get_height() + 1}...")
    print(f"   Miner: {miner_address[:40]}...")
    
    prev_block = blockchain.get_latest_block()
    height = blockchain.get_height() + 1
    
    # Create coinbase transaction
    from src.pool.blockchain.reward_calculator import RewardCalculator
    
    config = {
        "fee_percent": 1.0,
        "humanitarian_tithe": 10.0,
        "humanitarian_address": "ZION_CHILDREN_FUTURE_FUND_1ECCB72BC30AADD086656A59"
    }
    
    calc = RewardCalculator(config)
    
    # Calculate reward (use current timestamp for 2025)
    block_timestamp = time.time()
    block_reward = calc.calculate_block_reward(height, miner_address, block_timestamp)
    
    print(f"   Block reward: {block_reward:,.3f} ZION")
    
    # Create coinbase tx
    coinbase = Transaction(
        sender="COINBASE",
        receiver=miner_address,
        amount=float(block_reward),
        memo=f"Block {height} mining reward",
        signature="COINBASE"
    )
    
    # Create block
    block = Block(
        height=height,
        previous_hash=prev_block['hash'],
        transactions=[coinbase.to_dict()],
        miner_address=miner_address,
        difficulty=prev_block['difficulty']
    )
    
    # Mine with low difficulty (just for testing)
    target_difficulty = prev_block['difficulty']
    print(f"   Target difficulty: {target_difficulty}")
    
    nonce = 0
    start_time = time.time()
    
    while True:
        block.nonce = nonce
        block.timestamp = time.time()
        block_hash = block.calculate_hash()
        
        # Check if hash meets difficulty
        if int(block_hash[:16], 16) < 2**(64 - target_difficulty):
            elapsed = time.time() - start_time
            hashrate = nonce / elapsed if elapsed > 0 else 0
            
            print(f"\n✅ BLOCK FOUND!")
            print(f"   Hash: {block_hash}")
            print(f"   Nonce: {nonce:,}")
            print(f"   Time: {elapsed:.1f}s")
            print(f"   Hashrate: {hashrate:,.0f} H/s")
            
            # Add to blockchain
            block_dict = block.to_dict()
            block_dict['hash'] = block_hash
            
            if blockchain.add_block(block_dict):
                print(f"\n🎉 Block {height} added to blockchain!")
                print(f"   Reward: {block_reward:,.3f} ZION → {miner_address[:40]}...")
                return True
            else:
                print(f"\n❌ Block rejected by blockchain")
                return False
                
        nonce += 1
        
        # Progress every 10k hashes
        if nonce % 10000 == 0:
            elapsed = time.time() - start_time
            hashrate = nonce / elapsed if elapsed > 0 else 0
            print(f"   {nonce:,} hashes | {hashrate:,.0f} H/s", end='\r')


def main():
    print("=" * 80)
    print("🔥 ZION SOLO MINING TEST")
    print("=" * 80)
    print()
    
    # Load blockchain
    blockchain = Blockchain()
    
    print(f"📊 Blockchain state:")
    print(f"   Height: {blockchain.get_height()}")
    latest = blockchain.get_latest_block()
    print(f"   Latest hash: {latest['hash'][:32]}...")
    print(f"   Difficulty: {latest['difficulty']}")
    print()
    
    print(f"⛏️  Miner: {MINER_ADDRESS}")
    print(f"   Whitelist: ✅ YES (Sacred Mining Operator)")
    print(f"   Expected reward (2025): 6,969.697 ZION")
    print()
    
    # Mine one block
    input("Press ENTER to start mining...")
    
    success = simple_mine_block(blockchain, MINER_ADDRESS)
    
    if success:
        print("\n✅ Mining test successful!")
        
        # Show new state
        print(f"\n📊 New blockchain state:")
        print(f"   Height: {blockchain.get_height()}")
        latest = blockchain.get_latest_block()
        print(f"   Latest hash: {latest['hash'][:32]}...")
        print(f"   Transactions: {len(latest['transactions'])}")
    else:
        print("\n❌ Mining test failed")
    
    print("\n" + "=" * 80)


if __name__ == "__main__":
    main()
