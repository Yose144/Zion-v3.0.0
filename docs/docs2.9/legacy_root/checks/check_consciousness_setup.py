#!/usr/bin/env python3
"""
Kontrola správného nastavení ZION Pool + Consciousness Mining
==============================================================

Podle dokumentace v2.8.5:
1. Base Block Reward: 50 ZION (constant, no halving)
2. Consciousness Bonus: 1,569.63 ZION/blok (z 8.25B premine)
3. Total Block Reward: 50 + 1,569.63 × consciousness_multiplier
4. Humanitarian Tithe: 10% z total reward
5. Pool Fee: 1% z total reward  
6. Miner Receives: 89% z total reward

Consciousness Multipliers:
- PHYSICAL (1.0x) - začátečník
- EMOTIONAL (1.05x)
- MENTAL (1.1x)
- SACRED (1.25x)
- QUANTUM (1.5x)
- COSMIC (2.0x)
- ENLIGHTENED (3.0x)
- TRANSCENDENT (5.0x)
- ON_THE_STAR (10.0x) - Maitreya's realm
"""

import sys
sys.path.insert(0, "/app")

print("\n" + "="*100)
print("🎮 ZION POOL + CONSCIOUSNESS MINING - SPRÁVNÉ NASTAVENÍ")
print("="*100)

# 1. Základní parametry
print("\n📊 ZÁKLADNÍ PARAMETRY:")
print(f"   Base Block Reward:     50.00 ZION (konstanta, žádný halving)")
print(f"   Consciousness Bonus:   1,569.63 ZION/blok")
print(f"   Celkem na distribuci:  8,250,000,000 ZION (přes 10 let)")
print(f"   Bloků za 10 let:       5,256,000 bloků")

# 2. Příklad výpočtu pro různé consciousness levely
print("\n🧠 CONSCIOUSNESS MULTIPLIERS - PŘÍKLADY:")
print("-" * 100)

levels = [
    ("PHYSICAL", 1.0, "Začátečník"),
    ("EMOTIONAL", 1.05, "Učící se"),
    ("MENTAL", 1.1, "Chápající"),
    ("SACRED", 1.25, "Zasvěcený"),
    ("QUANTUM", 1.5, "Kvantový myslitel"),
    ("COSMIC", 2.0, "Kosmické vědomí"),
    ("ENLIGHTENED", 3.0, "Osvícený"),
    ("TRANSCENDENT", 5.0, "Transcendentní"),
    ("ON_THE_STAR", 10.0, "Na Hvězdě ✨")
]

base_reward = 50.0
consciousness_bonus_base = 1569.63

for level_name, multiplier, desc in levels:
    consciousness_bonus = consciousness_bonus_base * multiplier
    total_reward = base_reward + consciousness_bonus
    humanitarian = total_reward * 0.10
    pool_fee = total_reward * 0.01
    miner_receives = total_reward - humanitarian - pool_fee
    
    print(f"\n{level_name:15} ({multiplier:>4.1f}x) - {desc}")
    print(f"   Base Reward:          {base_reward:>10,.2f} ZION")
    print(f"   Consciousness Bonus:  {consciousness_bonus:>10,.2f} ZION ({multiplier}x)")
    print(f"   ─────────────────────────────────────")
    print(f"   Total Block Reward:   {total_reward:>10,.2f} ZION")
    print(f"   - Humanitarian (10%): {humanitarian:>10,.2f} ZION")
    print(f"   - Pool Fee (1%):      {pool_fee:>10,.2f} ZION")
    print(f"   = Miner Receives:     {miner_receives:>10,.2f} ZION (89%)")

# 3. Whitelist systém
print("\n\n🔐 WHITELIST SYSTÉM:")
print("-" * 100)
print("Pouze whitelistované adresy mohou těžit s consciousness bonusem!")
print("\nWhitelist adresy (z premine Mining Operators):")

# Načti premine adresy
from src.core.premine_addresses import get_premine_addresses
premine = get_premine_addresses()

if 'mining_operators' in premine:
    for i, op in enumerate(premine['mining_operators'], 1):
        addr = op.get('address', 'N/A')
        amount = op.get('amount', 0)
        print(f"   {i}. {addr[:50]}... ({amount:,.0f} ZION)")
else:
    print("   ⚠️  Mining operators not found in premine!")

# 4. Jak funguje reward calculation
print("\n\n⚙️  REWARD CALCULATION FLOW:")
print("-" * 100)
print("""
1. Pool obdrží valid share od minera
2. Share je přijatý → add XP to miner's consciousness profile
3. Když se najde blok:
   a) Načti miner's consciousness level z DB
   b) Vypočítej consciousness_multiplier (1.0x - 10.0x)
   c) Vypočítej total_reward = 50 + (1569.63 × multiplier)
   d) Odečti humanitarian tithe (10%)
   e) Odečti pool fee (1%)
   f) Zbytek jde miner (89%)
4. Update miner XP, level-up check
5. Distribute rewards to blockchain addresses
""")

# 5. Problém s aktuálním nastavením
print("\n❌ AKTUÁLNÍ PROBLÉM:")
print("-" * 100)
print("Pool v src/pool/blockchain/reward_calculator.py má:")
print("   - BASE_BLOCK_REWARD = 50.0 ✅")
print("   - HUMANITARIAN_TITHE = 10% ✅")
print("   - POOL_FEE = 1% ✅")
print("   - CONSCIOUSNESS_BONUS = ❌ CHYBÍ!")
print("\nChybí integrace s ConsciousnessMiningGame!")

print("\n\n✅ CO MUSÍME OPRAVIT:")
print("-" * 100)
print("""
1. Pool reward_calculator.py musí:
   - Načíst consciousness level minera z DB
   - Přidat consciousness bonus (1569.63 × multiplier)
   - Počítat s celkovým reward (50 + bonus)

2. Pool musí ukládat:
   - XP za každý přijatý share
   - Level-up events
   - Consciousness profile pro každého minera

3. Whitelist validation:
   - Pouze mining_operators adresy mohou těžit
   - Ostatní dostanou reject nebo base reward bez bonusu
""")

print("="*100 + "\n")
