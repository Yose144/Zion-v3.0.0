#!/usr/bin/env python3
"""Kontrola genesis bloku - transakce vs premine adresy"""
import sys
sys.path.insert(0, "/app")

from src.core.new_zion_blockchain import NewZionBlockchain
from src.core.premine import get_premine_addresses

bc = NewZionBlockchain()
premine = get_premine_addresses()
genesis = bc.blocks[0] if bc.blocks else None

print(f"\n🧬 ANALÝZA GENESIS BLOKU")
print(f"=" * 100)

if not genesis:
    print("❌ Genesis blok nenalezen!")
    sys.exit(1)

print(f"\nGenesis hash: {genesis['hash']}")
print(f"Timestamp: {genesis['timestamp']}")
print(f"Miner: {genesis.get('miner', 'N/A')}")
print(f"Difficulty: {genesis.get('difficulty', 'N/A')}")

# Zkontroluj transakce
txs = genesis.get('transactions', [])
print(f"\n📋 Transakce v genesis bloku: {len(txs)}")
print(f"   Očekáváno premine adres: {len(premine)}")

if len(txs) != len(premine):
    print(f"⚠️  POZOR: Počet transakcí ({len(txs)}) != počet premine adres ({len(premine)})")

# Zkontroluj každou transakci
print(f"\n✅ Kontrola všech transakcí:")
print(f"-" * 100)

tx_total = 0
missing_addresses = set(premine.keys())

for i, tx in enumerate(txs):
    receiver = tx.get('receiver', 'N/A')
    amount = tx.get('amount', 0)
    purpose = tx.get('purpose', 'N/A')
    tx_total += amount
    
    if receiver in missing_addresses:
        missing_addresses.remove(receiver)
    
    expected_amount = premine.get(receiver, {}).get('amount', 0) if receiver in premine else 0
    match = "✅" if amount == expected_amount else "❌"
    
    print(f"{i+1:2d}. {match} {receiver[:45]}")
    print(f"    Částka: {amount:>20,.0f} ZION")
    if amount != expected_amount:
        print(f"    Očekáváno: {expected_amount:>20,.0f} ZION ❌")
    print(f"    Účel: {purpose[:70]}")
    print()

print(f"-" * 100)
print(f"💰 Celkem v genesis transakcích: {tx_total:>20,.0f} ZION")
print(f"   Očekávaný premine:            {16282857143:>20,} ZION")
print(f"   Rozdíl:                       {tx_total - 16282857143:>20,.0f} ZION")

if missing_addresses:
    print(f"\n⚠️  CHYBĚJÍCÍ ADRESY ({len(missing_addresses)}):")
    for addr in missing_addresses:
        print(f"   • {addr}")
else:
    print(f"\n✅ Všechny premine adresy mají transakci v genesis bloku!")

print(f"\n{'=' * 100}\n")
