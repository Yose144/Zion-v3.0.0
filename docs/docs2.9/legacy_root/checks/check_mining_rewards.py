#!/usr/bin/env python3
"""Kontrola mining rewards ve všech blocích"""
import sys
sys.path.insert(0, "/app")

from src.core.new_zion_blockchain import NewZionBlockchain

bc = NewZionBlockchain()

print(f"\n⛏️  MINING REWARDS - ANALÝZA VŠECH BLOKŮ")
print(f"=" * 100)

print(f"Celkem bloků: {len(bc.blocks)}")

total_mined = 0
for i, block in enumerate(bc.blocks):
    if i == 0:  # Genesis
        print(f"\n{i:3d}. GENESIS BLOCK")
        print(f"     Hash: {block['hash'][:50]}...")
        print(f"     Premine: 16,282,857,143 ZION")
        continue
    
    reward = block.get('reward', 0)
    miner = block.get('miner', 'N/A')
    height = block.get('height', i)
    block_hash = block['hash'][:50]
    txs = len(block.get('transactions', []))
    
    total_mined += reward
    
    print(f"\n{height:3d}. Blok (mined)")
    print(f"     Hash: {block_hash}...")
    print(f"     Miner: {miner[:50]}")
    print(f"     Reward: {reward:,.2f} ZION")
    print(f"     Transakce: {txs}")

print(f"\n{'=' * 100}")
print(f"📊 SOUHRN:")
print(f"   Genesis premine:   16,282,857,143.00 ZION")
print(f"   Vytěženo bloků:    {len(bc.blocks) - 1}")
print(f"   Mining rewards:    {total_mined:>20,.2f} ZION")
print(f"   Celková supply:    {16282857143 + total_mined:>20,.2f} ZION")
print(f"{'=' * 100}\n")

# Zkontroluj balances minerů
print(f"💰 BALANCES MINERŮ:")
print(f"-" * 100)

miner_balances = {}
for block in bc.blocks[1:]:  # Skip genesis
    miner = block.get('miner', 'UNKNOWN')
    reward = block.get('reward', 0)
    
    if miner not in miner_balances:
        miner_balances[miner] = {'expected': 0, 'actual': 0}
    
    miner_balances[miner]['expected'] += reward
    miner_balances[miner]['actual'] = bc.balances.get(miner, 0)

for miner, data in miner_balances.items():
    match = "✅" if abs(data['actual'] - data['expected']) < 0.01 else "❌"
    print(f"{match} {miner[:60]}")
    print(f"   Očekáváno: {data['expected']:>20,.2f} ZION")
    print(f"   Skutečnost: {data['actual']:>20,.2f} ZION")
    if abs(data['actual'] - data['expected']) >= 0.01:
        print(f"   Rozdíl: {data['actual'] - data['expected']:>20,.2f} ZION ❌")
    print()
