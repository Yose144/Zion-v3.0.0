#!/usr/bin/env python3
"""Kontrola balancí premine adres"""
import sys
sys.path.insert(0, "/app")

from src.core.new_zion_blockchain import NewZionBlockchain
from src.core.premine import get_premine_addresses, PREMINE_TOTAL

bc = NewZionBlockchain()
premine_addresses = get_premine_addresses()

print(f"📊 Kontrola balancí premine adres")
print(f"=" * 80)

total_balance = 0
addresses_checked = 0
addresses_with_balance = 0
mismatches = []

for address, info in premine_addresses.items():
    expected = info['amount']
    actual = bc.balances.get(address, 0)
    total_balance += actual
    addresses_checked += 1
    
    if actual > 0:
        addresses_with_balance += 1
    
    match = "✅" if actual == expected else "❌"
    
    if actual != expected:
        mismatches.append({
            'address': address,
            'expected': expected,
            'actual': actual,
            'type': info.get('type', 'unknown'),
            'purpose': info.get('purpose', 'N/A')
        })
        print(f"{match} {address[:30]}...")
        print(f"   Typ: {info.get('type', 'unknown')}")
        print(f"   Účel: {info.get('purpose', 'N/A')[:50]}")
        print(f"   Očekáváno: {expected:,} ZION")
        print(f"   Skutečnost: {actual:,} ZION")
        print(f"   Rozdíl: {actual - expected:,} ZION")
        print()

print(f"\n📈 Shrnutí:")
print(f"   Kontrolováno adres: {addresses_checked}")
print(f"   Adres s balancí: {addresses_with_balance}")
print(f"   Celková balance: {total_balance:,} ZION")
print(f"   Očekávaný premine: {PREMINE_TOTAL:,} ZION")
print(f"   Rozdíl: {total_balance - PREMINE_TOTAL:,} ZION")

if mismatches:
    print(f"\n⚠️  Nalezeno {len(mismatches)} neshod!")
    for m in mismatches[:5]:
        print(f"   • {m['address'][:30]}... ({m['type']}): {m['actual']:,} vs {m['expected']:,}")
else:
    print(f"\n✅ Všechny premine adresy mají správnou balanci!")

# Zkontroluj prvních 5 adres detailně
print(f"\n🔍 Detail prvních 5 adres:")
for i, (address, info) in enumerate(list(premine_addresses.items())[:5]):
    actual = bc.balances.get(address, 0)
    print(f"\n{i+1}. {address[:35]}...")
    print(f"   Typ: {info.get('type', 'unknown')}")
    print(f"   Účel: {info.get('purpose', 'N/A')[:60]}")
    print(f"   Balance: {actual:,} ZION")
    print(f"   Očekáváno: {info['amount']:,} ZION")
    print(f"   Status: {'✅ OK' if actual == info['amount'] else '❌ NESEDÍ'}")
