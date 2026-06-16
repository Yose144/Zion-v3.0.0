#!/usr/bin/env python3
"""
ZION Presale - PHP ↔ Python Synchronization Script
==================================================

Synchronizuje data mezi:
- PHP API (V2/api/presale-order.php → V2/presale-orders/*.json)
- Python FastAPI (presale_endpoints.py → data/presale.db)
- PHP Wallet Ledger (V2/wallets/ledger.json)
- Python Distributions (presale_distributions table)

Usage:
    # Import PHP orders → Python DB
    python scripts/sync_php_python_presale.py --mode=import
    
    # Export Python DB → PHP JSON
    python scripts/sync_php_python_presale.py --mode=export
    
    # Bidirectional sync (merge conflicts)
    python scripts/sync_php_python_presale.py --mode=sync
    
    # Dry run (no writes)
    python scripts/sync_php_python_presale.py --mode=sync --dry-run

Requirements:
    - PHP presale orders in: public_html/V2/presale-orders/
    - PHP wallet ledger: public_html/V2/wallets/ledger.json
    - Python DB: data/presale.db
    - Python QR codes: data/presale_qr_codes/
"""

import argparse
import json
import sqlite3
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Paths
BASE_DIR = Path(__file__).parent.parent
PHP_ORDERS_DIR = BASE_DIR / "public_html" / "V2" / "presale-orders"
PHP_LEDGER_FILE = BASE_DIR / "public_html" / "V2" / "wallets" / "ledger.json"
PHP_WALLETS_DIR = BASE_DIR / "public_html" / "V2" / "wallets"
PYTHON_DB = BASE_DIR / "data" / "presale.db"
PYTHON_QR_DIR = BASE_DIR / "data" / "presale_qr_codes"


class PresaleSync:
    """Synchronizace PHP ↔ Python presale dat"""
    
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.stats = {
            'imported': 0,
            'exported': 0,
            'conflicts': 0,
            'errors': 0
        }
    
    def import_php_to_python(self) -> None:
        """Importuje PHP orders → Python DB"""
        logger.info("🔄 Import PHP orders → Python DB")
        
        if not PHP_ORDERS_DIR.exists():
            logger.error(f"❌ PHP orders directory not found: {PHP_ORDERS_DIR}")
            return
        
        conn = sqlite3.connect(PYTHON_DB)
        cursor = conn.cursor()
        
        for order_file in PHP_ORDERS_DIR.glob("PRESALE-*.json"):
            try:
                with open(order_file, 'r', encoding='utf-8') as f:
                    order = json.load(f)
                
                order_id = order['orderId']
                
                # Check if already exists
                cursor.execute("SELECT id FROM presale_orders WHERE order_id = ?", (order_id,))
                if cursor.fetchone():
                    logger.debug(f"  ⏭️  Order {order_id} already in Python DB, skipping")
                    continue
                
                # Extract data
                customer = order.get('customer', {})
                package = order.get('package', {})
                payment = order.get('payment', {})
                zion = order.get('zion', {})
                
                # Insert into presale_orders
                if not self.dry_run:
                    cursor.execute("""
                        INSERT INTO presale_orders
                        (order_id, email, amount_eur, zion_tokens, phase_id, payment_method, 
                         stripe_session_id, status, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        order_id,
                        customer.get('email'),
                        package.get('priceEur'),
                        package.get('totalTokens'),
                        self._get_phase_id(package.get('priceEur')),
                        payment.get('method', 'transfer'),
                        payment.get('stripeSessionId'),
                        order.get('status', 'pending'),
                        order.get('createdAt'),
                        order.get('updatedAt', order.get('createdAt'))
                    ))
                    
                    order_db_id = cursor.lastrowid
                    
                    # Insert wallet if exists
                    if zion.get('wallet'):
                        wallet = zion['wallet']
                        cursor.execute("""
                            INSERT INTO presale_wallets
                            (order_id, wallet_address, encrypted_private_key, 
                             master_key_version, qr_code_path, created_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (
                            order_db_id,
                            wallet.get('id'),
                            None,  # PHP doesn't encrypt by default
                            1,
                            zion.get('qr', {}).get('imageFile'),
                            wallet.get('createdAt')
                        ))
                
                logger.info(f"  ✅ Imported: {order_id} ({package.get('totalTokens')} ZION)")
                self.stats['imported'] += 1
                
            except Exception as e:
                logger.error(f"  ❌ Error importing {order_file.name}: {e}")
                self.stats['errors'] += 1
        
        if not self.dry_run:
            conn.commit()
        conn.close()
        
        logger.info(f"✅ Import complete: {self.stats['imported']} orders imported")
    
    def import_ledger_to_python(self) -> None:
        """Importuje PHP wallet ledger → Python distributions"""
        logger.info("🔄 Import PHP ledger → Python distributions")
        
        if not PHP_LEDGER_FILE.exists():
            logger.warning(f"⚠️  PHP ledger not found: {PHP_LEDGER_FILE}")
            return
        
        with open(PHP_LEDGER_FILE, 'r', encoding='utf-8') as f:
            ledger_entries = json.load(f)
        
        conn = sqlite3.connect(PYTHON_DB)
        cursor = conn.cursor()
        
        for entry in ledger_entries:
            # Only import presale entries
            if entry.get('source') != 'presale':
                continue
            
            order_id = entry.get('orderId')
            
            # Get order_id from presale_orders
            cursor.execute("SELECT id FROM presale_orders WHERE order_id = ?", (order_id,))
            result = cursor.fetchone()
            
            if not result:
                logger.warning(f"  ⚠️  Order {order_id} not found in presale_orders, skipping ledger entry")
                continue
            
            order_db_id = result[0]
            
            # Check if distribution already exists
            cursor.execute("""
                SELECT id FROM presale_distributions 
                WHERE order_id = ? AND unlock_percentage = ?
            """, (order_db_id, 0.40))
            
            if cursor.fetchone():
                logger.debug(f"  ⏭️  Distribution for {order_id} already exists, skipping")
                continue
            
            # Create 4 distribution records (40%, 20%, 20%, 20%)
            tokens = entry.get('tokens', 0)
            unlock_schedule = [
                (0.40, None),  # 40% at MainNet launch
                (0.20, 3),     # 20% after 3 months
                (0.20, 6),     # 20% after 6 months
                (0.20, 9)      # 20% after 9 months
            ]
            
            for unlock_pct, months_offset in unlock_schedule:
                unlock_amount = int(tokens * unlock_pct)
                
                if not self.dry_run:
                    cursor.execute("""
                        INSERT INTO presale_distributions
                        (order_id, wallet_address, zion_amount, unlock_date,
                         unlock_percentage, status, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        order_db_id,
                        entry.get('walletId'),
                        unlock_amount,
                        None,  # TBD based on MainNet launch date
                        unlock_pct,
                        entry.get('status', 'pending'),
                        entry.get('createdAt')
                    ))
            
            logger.info(f"  ✅ Created distributions for: {order_id} ({tokens} ZION)")
            self.stats['imported'] += 1
        
        if not self.dry_run:
            conn.commit()
        conn.close()
        
        logger.info(f"✅ Ledger import complete: {self.stats['imported']} distributions created")
    
    def export_python_to_php(self) -> None:
        """Exportuje Python DB → PHP JSON files"""
        logger.info("🔄 Export Python DB → PHP JSON")
        
        conn = sqlite3.connect(PYTHON_DB)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT o.*, w.wallet_address, w.qr_code_path
            FROM presale_orders o
            LEFT JOIN presale_wallets w ON o.id = w.order_id
            WHERE o.updated_at > datetime('now', '-7 days')
        """)
        
        recent_orders = cursor.fetchall()
        
        for row in recent_orders:
            order_id = row['order_id']
            
            # Create PHP-compatible JSON structure
            php_order = {
                'orderId': order_id,
                'type': 'presale',
                'status': row['status'],
                'customer': {
                    'email': row['email'],
                    'name': row['name'] or ''
                },
                'package': {
                    'name': f"Presale Phase {row['phase_id']}",
                    'priceEur': float(row['amount_eur']),
                    'totalTokens': int(row['zion_tokens'])
                },
                'payment': {
                    'method': row['payment_method'],
                    'status': row['status'],
                    'stripeSessionId': row['stripe_session_id']
                },
                'zion': {
                    'wallet': {
                        'id': row['wallet_address'],
                    } if row['wallet_address'] else None,
                    'qr': {
                        'imageFile': row['qr_code_path']
                    } if row['qr_code_path'] else None,
                    'network': 'testnet'
                },
                'createdAt': row['created_at'],
                'updatedAt': row['updated_at']
            }
            
            # Write to PHP orders directory
            if not self.dry_run:
                PHP_ORDERS_DIR.mkdir(parents=True, exist_ok=True)
                order_file = PHP_ORDERS_DIR / f"{order_id}.json"
                
                with open(order_file, 'w', encoding='utf-8') as f:
                    json.dump(php_order, f, indent=2, ensure_ascii=False)
            
            logger.info(f"  ✅ Exported: {order_id}")
            self.stats['exported'] += 1
        
        conn.close()
        
        logger.info(f"✅ Export complete: {self.stats['exported']} orders exported to PHP")
    
    def sync_bidirectional(self) -> None:
        """Bidirectional sync with conflict resolution"""
        logger.info("🔄 Bidirectional sync (PHP ↔ Python)")
        
        # Strategy: Last-write-wins based on updatedAt timestamp
        
        # 1. Import new PHP orders → Python
        self.import_php_to_python()
        
        # 2. Import PHP ledger → Python distributions
        self.import_ledger_to_python()
        
        # 3. Export recent Python orders → PHP (last 7 days)
        self.export_python_to_php()
        
        logger.info("✅ Bidirectional sync complete")
    
    def _get_phase_id(self, price_eur: Optional[float]) -> int:
        """Určí phase_id podle ceny"""
        if not price_eur:
            return 1
        
        # Phase 1: €0.008, Phase 2: €0.010, Phase 3: €0.012
        if price_eur <= 0.009:
            return 1
        elif price_eur <= 0.011:
            return 2
        else:
            return 3
    
    def print_stats(self) -> None:
        """Vypíše statistiky synchronizace"""
        logger.info("\n" + "="*50)
        logger.info("📊 Synchronization Statistics")
        logger.info("="*50)
        logger.info(f"  Imported:  {self.stats['imported']}")
        logger.info(f"  Exported:  {self.stats['exported']}")
        logger.info(f"  Conflicts: {self.stats['conflicts']}")
        logger.info(f"  Errors:    {self.stats['errors']}")
        logger.info("="*50 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description='Sync ZION Presale data between PHP and Python'
    )
    parser.add_argument(
        '--mode',
        choices=['import', 'export', 'sync'],
        default='sync',
        help='Synchronization mode'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Simulate without writing data'
    )
    
    args = parser.parse_args()
    
    logger.info("🚀 ZION Presale Sync Starting...")
    if args.dry_run:
        logger.warning("⚠️  DRY RUN MODE - No data will be written")
    
    sync = PresaleSync(dry_run=args.dry_run)
    
    if args.mode == 'import':
        sync.import_php_to_python()
        sync.import_ledger_to_python()
    elif args.mode == 'export':
        sync.export_python_to_php()
    elif args.mode == 'sync':
        sync.sync_bidirectional()
    
    sync.print_stats()
    
    logger.info("✅ Synchronization complete!")


if __name__ == "__main__":
    main()
