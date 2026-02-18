#!/usr/bin/env python3
import sqlite3

conn = sqlite3.connect('zion_pool.db')
c = conn.cursor()

print("=" * 80)
print("🎯 ZION 2.8 - FINÁLNÍ VÝSLEDKY")
print("=" * 80)

# Naše testy
c.execute("""
    SELECT address, algorithm, COUNT(*) as total, SUM(is_valid) as valid
    FROM shares 
    WHERE address LIKE '%Zion%' OR address LIKE '%TEST%'
    GROUP BY address, algorithm 
    ORDER BY MAX(timestamp) DESC
""")

print("\n📊 NAŠE MINING TESTY:")
print("-" * 80)
for addr, algo, total, valid in c.fetchall():
    print(f"\n{addr[:50]}")
    print(f"  Algorithm: {algo}")
    print(f"  Total Shares: {total}")
    print(f"  Valid Shares: {valid}")
    print(f"  Acceptance: {valid/total*100:.1f}%")

# Celkem
c.execute("""
    SELECT COUNT(*) as total, SUM(is_valid) as valid
    FROM shares 
    WHERE address LIKE '%Zion%' OR address LIKE '%TEST%'
""")
total, valid = c.fetchone()

print("\n" + "=" * 80)
print(f"📈 CELKEM: {total} shares | {valid} valid | {valid/total*100:.1f}% acceptance")

# Bloky
c.execute("SELECT COUNT(*) FROM blocks")
block_count = c.fetchone()[0]
print(f"🏆 BLOKY: {block_count} v databázi")

if block_count > 0:
    print("\nPoslední bloky:")
    c.execute("""
        SELECT height, hash, total_shares, reward_amount 
        FROM blocks 
        ORDER BY height DESC 
        LIMIT 5
    """)
    for height, hash_val, shares, reward in c.fetchall():
        print(f"  Block #{height}: {hash_val[:30]}... ({shares} shares, {reward} ZION)")

conn.close()
print("=" * 80)
