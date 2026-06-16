#!/usr/bin/env python3
"""
Create test presale database with demo data for testing distribution.
"""

import sqlite3
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.core.presale_wallet import generate_presale_wallet

def create_test_presale_db():
    """Create test presale database with demo orders."""
    
    db_path = project_root / "data" / "presale.db"
    
    # Remove existing if present
    if db_path.exists():
        db_path.unlink()
        print(f"🗑️  Removed existing DB: {db_path}")
    
    # Create connection
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS presale_orders (
            order_id TEXT PRIMARY KEY,
            customer_name TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            total_tokens REAL NOT NULL,
            payment_status TEXT DEFAULT 'pending',
            payment_method TEXT,
            payment_reference TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            distribution_status TEXT DEFAULT 'pending',
            distribution_tx_hash TEXT,
            distribution_completed_at TIMESTAMP
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS presale_wallets (
            wallet_id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            public_address TEXT NOT NULL,
            private_key_encrypted TEXT NOT NULL,
            qr_code_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES presale_orders(order_id)
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS presale_distributions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            wallet_address TEXT NOT NULL,
            amount REAL NOT NULL,
            tx_hash TEXT,
            status TEXT DEFAULT 'pending',
            confirmations INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            error_message TEXT,
            FOREIGN KEY (order_id) REFERENCES presale_orders(order_id)
        )
    """)
    
    print("✅ Database tables created")
    
    # Create test orders with real zion1 wallets
    test_orders = [
        {
            'order_id': 'TEST_001',
            'customer_name': 'Rasta Testovací',
            'customer_email': 'test1@newearth.cz',
            'total_tokens': 100000.0,
            'payment_status': 'paid',
            'payment_method': 'crypto',
            'payment_reference': 'BTC_TX_001'
        },
        {
            'order_id': 'TEST_002',
            'customer_name': 'JAH Tester',
            'customer_email': 'test2@newearth.cz',
            'total_tokens': 250000.0,
            'payment_status': 'paid',
            'payment_method': 'crypto',
            'payment_reference': 'ETH_TX_002'
        },
        {
            'order_id': 'TEST_003',
            'customer_name': 'Zion Validator',
            'customer_email': 'test3@newearth.cz',
            'total_tokens': 500000.0,
            'payment_status': 'paid',
            'payment_method': 'bank_transfer',
            'payment_reference': 'BANK_REF_003'
        },
        {
            'order_id': 'TEST_004',
            'customer_name': 'Peace & Love',
            'customer_email': 'test4@newearth.cz',
            'total_tokens': 75000.0,
            'payment_status': 'paid',
            'payment_method': 'crypto',
            'payment_reference': 'USDT_TX_004'
        },
        {
            'order_id': 'TEST_005',
            'customer_name': 'Babylon Tester',
            'customer_email': 'test5@newearth.cz',
            'total_tokens': 150000.0,
            'payment_status': 'pending',  # This one should be skipped
            'payment_method': 'crypto',
            'payment_reference': 'PENDING_005'
        }
    ]
    
    print("\n📝 Creating test orders with real zion1 wallets...")
    
    for order in test_orders:
        # Insert order
        cursor.execute("""
            INSERT INTO presale_orders 
            (order_id, customer_name, customer_email, total_tokens, 
             payment_status, payment_method, payment_reference)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            order['order_id'],
            order['customer_name'],
            order['customer_email'],
            order['total_tokens'],
            order['payment_status'],
            order['payment_method'],
            order['payment_reference']
        ))
        
        # Generate real zion1 wallet
        public_address, private_key = generate_presale_wallet()
        
        # Insert wallet
        cursor.execute("""
            INSERT INTO presale_wallets 
            (order_id, public_address, private_key_encrypted, qr_code_path)
            VALUES (?, ?, ?, ?)
        """, (
            order['order_id'],
            public_address,
            private_key,  # In real system would be encrypted
            ''  # QR code path
        ))
        
        status_emoji = "✅" if order['payment_status'] == 'paid' else "⏳"
        print(f"{status_emoji} {order['order_id']}: {order['customer_name']} - {order['total_tokens']:,.0f} ZION")
        print(f"   Wallet: {public_address}")
    
    conn.commit()
    
    # Summary
    cursor.execute("SELECT COUNT(*) FROM presale_orders WHERE payment_status = 'paid'")
    paid_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT SUM(total_tokens) FROM presale_orders WHERE payment_status = 'paid'")
    total_tokens = cursor.fetchone()[0]
    
    print(f"\n{'='*80}")
    print(f"✅ TEST PRESALE DATABASE CREATED!")
    print(f"{'='*80}")
    print(f"Location: {db_path}")
    print(f"Total orders: {len(test_orders)}")
    print(f"Paid orders: {paid_count}")
    print(f"Total tokens (paid): {total_tokens:,.0f} ZION")
    print(f"{'='*80}\n")
    
    conn.close()

if __name__ == "__main__":
    create_test_presale_db()
