#!/usr/bin/env python3
"""Kontrola stavu blockchainu a genesis bloku"""
import sys
sys.path.insert(0, "/app")

from src.core.new_zion_blockchain import NewZionBlockchain

bc = NewZionBlockchain()
print(f"📊 Blockchain height: {len(bc.blocks)}")

if bc.blocks:
    genesis = bc.blocks[0]
    print(f"\n🧬 Genesis block:")
    print(f"   Hash: {genesis['hash'][:16]}...")
    print(f"   Timestamp: {genesis['timestamp']}")
    print(f"   Difficulty: {genesis.get('difficulty', 'N/A')}")
    print(f"   Miner: {genesis.get('miner', 'N/A')}")
    
    if genesis.get('transactions'):
        print(f"\n💰 Genesis transakce:")
        print(f"   Celkem: {len(genesis['transactions'])} transakcí")
        total_premine = sum(tx['amount'] for tx in genesis['transactions'])
        print(f"   Total premine: {total_premine:,} ZION")
        print(f"\n   První 5 transakcí:")
        for i, tx in enumerate(genesis['transactions'][:5]):
            print(f"   {i+1}. {tx['amount']:>15,} ZION -> {tx['receiver'][:25]}... ({tx.get('purpose', 'N/A')[:30]}...)")
    
    # Poslední 3 bloky
    print(f"\n📦 Poslední bloky:")
    for block in bc.blocks[-3:]:
        print(f"   Height {block['height']}: {block['hash'][:16]}... (txs: {len(block.get('transactions', []))})")
else:
    print("❌ Blockchain je prázdný!")
