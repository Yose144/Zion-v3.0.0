#!/usr/bin/env python3
"""Detailní výpis všech premine adres a jejich balancí"""
import sys
sys.path.insert(0, "/app")

from src.core.new_zion_blockchain import NewZionBlockchain
from src.core.premine import get_premine_addresses

bc = NewZionBlockchain()
premine = get_premine_addresses()

print(f"\n💰 KOMPLETNÍ SEZNAM PREMINE ADRES A BALANCÍ")
print(f"=" * 100)

# Seskupit podle typu
by_type = {}
for addr, info in premine.items():
    t = info.get('type', 'unknown')
    if t not in by_type:
        by_type[t] = []
    by_type[t].append((addr, info))

for addr_type, addresses in by_type.items():
    print(f"\n📦 {addr_type.upper()}")
    print(f"-" * 100)
    
    type_total = 0
    for addr, info in addresses:
        balance = bc.balances.get(addr, 0)
        type_total += balance
        
        print(f"   Adresa: {addr}")
        print(f"   Účel:   {info.get('purpose', 'N/A')}")
        print(f"   Balance: {balance:>20,.0f} ZION {'✅' if balance == info['amount'] else '❌'}")
        print()
    
    print(f"   CELKEM ({addr_type}): {type_total:>20,.0f} ZION")
    print()

# Celkový součet
total = sum(bc.balances.get(addr, 0) for addr in premine.keys())
print(f"\n{'=' * 100}")
print(f"💎 CELKOVÝ PREMINE: {total:>20,.0f} ZION")
print(f"   Očekáváno:       {16282857143:>20,} ZION")
print(f"   Rozdíl:          {total - 16282857143:>20,.0f} ZION")
print(f"{'=' * 100}\n")
