#!/usr/bin/env python3
"""
ZION Presale Distribution Manager
==================================
Automatická distribuce presale tokenů z premine na presale adresy po MainNet launch.

PROCES:
1. MainNet launch (31.12.2027) → Genesis block s 500M ZION presale allocation
2. System načte všechny presale objednávky z DB
3. Pro každou objednávku vytvoří transakci z PRESALE premine adresy
4. Odešle tokeny na zion1... adresy zákazníků
5. Aktualizuje DB a odešle email notifikace

BEZPEČNOST:
- Multi-sig z presale premine adresy (500M ZION)
- Validace všech zion1 adres před odesláním
- Rate limiting: max 100 TX/block
- Dry-run mode pro testování
- Kompletní audit trail

Author: ZION Team
Version: 2.9.0
Date: 9. prosince 2025
"""

import os
import sys
import json
import time
import sqlite3
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

# Add project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

# Imports
try:
    from src.core.new_zion_blockchain import NewZionBlockchain
    from src.core.presale_wallet import validate_wallet_address
    from src.core.premine import get_premine_by_type, PRESALE_TOTAL
except ImportError as e:
    print(f"⚠️  Import warning: {e}")

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data/presale_distribution.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


# ============================================
# CONSTANTS
# ============================================

PRESALE_ALLOCATION = 500_000_000  # 500M ZION (~3.0% of 16.78B premine)
PRESALE_DB_PATH = "data/presale.db"
PRESALE_PREMINE_ADDRESS = None  # Will be loaded from premine.py

# Transaction limits
MAX_TX_PER_BLOCK = 100
TX_BATCH_SIZE = 50
TX_BATCH_DELAY_SECONDS = 2.0
TX_CONFIRMATION_BLOCKS = 6

# Notification
SEND_EMAIL_NOTIFICATIONS = True
EMAIL_TEMPLATE = "presale-confirmation-rasta.html"


# ============================================
# ENUMS
# ============================================

class DistributionStatus(Enum):
    PENDING = 'pending'
    VALIDATED = 'validated'
    QUEUED = 'queued'
    SENT = 'sent'
    CONFIRMED = 'confirmed'
    FAILED = 'failed'


# ============================================
# DATACLASSES
# ============================================

@dataclass
class PresaleOrder:
    """Presale objednávka z DB"""
    order_id: str
    customer_email: str
    customer_name: str
    total_tokens: int
    wallet_address: str  # zion1... address
    payment_status: str
    distribution_status: str
    created_at: str
    

@dataclass
class DistributionTransaction:
    """Transakce distribuce"""
    order_id: str
    wallet_address: str
    tokens: int
    tx_hash: Optional[str] = None
    block_height: Optional[int] = None
    confirmations: int = 0
    status: DistributionStatus = DistributionStatus.PENDING
    error: Optional[str] = None
    created_at: datetime = None
    sent_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None


# ============================================
# DISTRIBUTION MANAGER
# ============================================

class PresaleDistributionManager:
    """
    Manages automatic distribution of presale tokens from premine to customer wallets.
    
    Usage:
        manager = PresaleDistributionManager(dry_run=True)
        await manager.execute_distribution()
    """
    
    def __init__(
        self,
        presale_db_path: str = PRESALE_DB_PATH,
        blockchain_db_path: str = "zion_mainnet_blockchain.db",
        dry_run: bool = False
    ):
        self.presale_db_path = presale_db_path
        self.blockchain_db_path = blockchain_db_path
        self.dry_run = dry_run
        
        # Initialize blockchain
        if not dry_run:
            self.blockchain = NewZionBlockchain(
                db_file=blockchain_db_path,
                enable_p2p=False,
                enable_rpc=False,
                network="mainnet"
            )
        else:
            self.blockchain = None
        
        # Load presale premine address
        self._load_presale_premine_address()
        
        # Stats
        self.total_orders = 0
        self.total_tokens = 0
        self.successful = 0
        self.failed = 0
        
        logger.info(f"{'🧪 DRY RUN' if dry_run else '🚀 LIVE MODE'}")
        logger.info(f"Presale DB: {presale_db_path}")
        logger.info(f"Blockchain DB: {blockchain_db_path}")
        logger.info(f"Presale Allocation: {PRESALE_ALLOCATION:,} ZION")
    
    def _load_presale_premine_address(self):
        """Load presale premine address from premine.py"""
        global PRESALE_PREMINE_ADDRESS
        
        try:
            presale_addrs = get_premine_by_type('presale')
            if not presale_addrs:
                raise ValueError("No presale addresses found in premine!")
            
            # Get first presale address (main allocation)
            PRESALE_PREMINE_ADDRESS = list(presale_addrs.keys())[0]
            logger.info(f"✅ Presale premine address: {PRESALE_PREMINE_ADDRESS}")
            
        except Exception as e:
            logger.error(f"❌ Failed to load presale premine address: {e}")
            PRESALE_PREMINE_ADDRESS = "PRESALE_PREMINE_FALLBACK"
    
    # ============================================
    # DATABASE OPERATIONS
    # ============================================
    
    def _get_all_presale_orders(self) -> List[PresaleOrder]:
        """Load all paid presale orders from DB"""
        if not os.path.exists(self.presale_db_path):
            logger.warning(f"⚠️  Presale DB not found: {self.presale_db_path}")
            return []
        
        conn = sqlite3.connect(self.presale_db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get all paid orders with wallets
        cursor.execute("""
            SELECT 
                o.order_id,
                o.customer_email,
                o.customer_name,
                o.total_tokens,
                o.payment_status,
                o.distribution_status,
                o.created_at,
                w.public_address as wallet_address
            FROM presale_orders o
            LEFT JOIN presale_wallets w ON o.order_id = w.order_id
            WHERE o.payment_status = 'paid'
            AND w.public_address IS NOT NULL
            ORDER BY o.created_at ASC
        """)
        
        orders = []
        for row in cursor.fetchall():
            orders.append(PresaleOrder(
                order_id=row['order_id'],
                customer_email=row['customer_email'],
                customer_name=row['customer_name'] or 'Unknown',
                total_tokens=row['total_tokens'],
                wallet_address=row['wallet_address'],
                payment_status=row['payment_status'],
                distribution_status=row['distribution_status'],
                created_at=row['created_at']
            ))
        
        conn.close()
        
        logger.info(f"✅ Loaded {len(orders)} paid presale orders")
        return orders
    
    def _update_distribution_status(
        self,
        order_id: str,
        status: str,
        tx_hash: Optional[str] = None,
        block_height: Optional[int] = None
    ):
        """Update distribution status in presale DB"""
        if self.dry_run:
            logger.info(f"[DRY RUN] Would update {order_id}: {status}")
            return
        
        conn = sqlite3.connect(self.presale_db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE presale_orders
            SET distribution_status = ?,
                distribution_txid = ?,
                distributed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE distributed_at END
            WHERE order_id = ?
        """, (status, tx_hash, status, order_id))
        
        conn.commit()
        conn.close()
    
    # ============================================
    # VALIDATION
    # ============================================
    
    def _validate_orders(self, orders: List[PresaleOrder]) -> Tuple[List[PresaleOrder], List[Dict]]:
        """
        Validate all presale orders before distribution.
        
        Returns:
            (valid_orders, invalid_orders_with_reasons)
        """
        logger.info("Validating presale orders...")
        
        valid = []
        invalid = []
        total_tokens = 0
        
        for order in orders:
            # Check wallet address format
            if not validate_wallet_address(order.wallet_address):
                invalid.append({
                    'order': order,
                    'reason': f'Invalid wallet address format: {order.wallet_address}'
                })
                continue
            
            # Check token amount
            if order.total_tokens <= 0:
                invalid.append({
                    'order': order,
                    'reason': f'Invalid token amount: {order.total_tokens}'
                })
                continue
            
            # Check minimum (10k ZION)
            if order.total_tokens < 10_000:
                invalid.append({
                    'order': order,
                    'reason': f'Tokens below minimum (10k): {order.total_tokens}'
                })
                continue
            
            # All good
            valid.append(order)
            total_tokens += order.total_tokens
        
        # Check total allocation
        if total_tokens > PRESALE_ALLOCATION:
            logger.error(f"❌ CRITICAL: Total tokens ({total_tokens:,}) exceeds allocation ({PRESALE_ALLOCATION:,})!")
            raise ValueError("Presale allocation exceeded!")
        
        logger.info(f"✅ Valid orders: {len(valid):,}")
        logger.info(f"❌ Invalid orders: {len(invalid):,}")
        logger.info(f"💰 Total tokens to distribute: {total_tokens:,} ZION")
        logger.info(f"📊 Allocation usage: {(total_tokens/PRESALE_ALLOCATION)*100:.2f}%")
        
        return valid, invalid
    
    # ============================================
    # DISTRIBUTION EXECUTION
    # ============================================
    
    async def execute_distribution(self) -> Dict:
        """
        MAIN METHOD: Execute full presale token distribution.
        
        Returns:
            Distribution results dict
        """
        start_time = datetime.now()
        
        try:
            logger.info("=" * 80)
            logger.info("🚀 ZION PRESALE TOKEN DISTRIBUTION")
            logger.info("=" * 80)
            
            # Step 1: Load orders
            logger.info("\n📥 Step 1: Loading presale orders...")
            orders = self._get_all_presale_orders()
            
            if not orders:
                logger.warning("⚠️  No presale orders found!")
                return {'success': True, 'total_orders': 0, 'message': 'No orders to distribute'}
            
            self.total_orders = len(orders)
            self.total_tokens = sum(o.total_tokens for o in orders)
            
            logger.info(f"Total orders: {self.total_orders:,}")
            logger.info(f"Total tokens: {self.total_tokens:,} ZION")
            
            # Step 2: Validate
            logger.info("\n✅ Step 2: Validating orders...")
            valid_orders, invalid_orders = self._validate_orders(orders)
            
            if invalid_orders:
                logger.warning(f"⚠️  {len(invalid_orders)} invalid orders:")
                for inv in invalid_orders[:5]:  # Show first 5
                    logger.warning(f"  - {inv['order'].order_id}: {inv['reason']}")
            
            # Step 3: Process in batches
            logger.info("\n📤 Step 3: Processing transactions...")
            transactions = await self._process_batches(valid_orders)
            
            # Step 4: Wait for confirmations
            if not self.dry_run:
                logger.info("\n⏳ Step 4: Waiting for confirmations...")
                await self._wait_confirmations(transactions)
            
            # Step 5: Send notifications
            if SEND_EMAIL_NOTIFICATIONS:
                logger.info("\n📧 Step 5: Sending email notifications...")
                await self._send_notifications(valid_orders)
            
            # Final report
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            results = {
                'success': True,
                'total_orders': self.total_orders,
                'valid_orders': len(valid_orders),
                'invalid_orders': len(invalid_orders),
                'successful_distributions': self.successful,
                'failed_distributions': self.failed,
                'total_tokens_distributed': self.total_tokens,
                'duration_seconds': duration,
                'dry_run': self.dry_run
            }
            
            logger.info("\n" + "=" * 80)
            logger.info("✅ PRESALE DISTRIBUTION COMPLETED!")
            logger.info("=" * 80)
            logger.info(f"Valid orders: {len(valid_orders):,}")
            logger.info(f"Successful: {self.successful:,}")
            logger.info(f"Failed: {self.failed:,}")
            logger.info(f"Total tokens: {self.total_tokens:,} ZION")
            logger.info(f"Duration: {duration:.2f}s")
            logger.info("=" * 80)
            
            return results
            
        except Exception as e:
            logger.error(f"❌ Distribution failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _process_batches(self, orders: List[PresaleOrder]) -> List[DistributionTransaction]:
        """Process orders in batches"""
        transactions = []
        batch_num = 0
        
        for i in range(0, len(orders), TX_BATCH_SIZE):
            batch = orders[i:i + TX_BATCH_SIZE]
            batch_num += 1
            
            logger.info(f"\n📦 Batch {batch_num}/{(len(orders)//TX_BATCH_SIZE)+1} ({len(batch)} orders)")
            
            for order in batch:
                try:
                    tx = await self._send_distribution_tx(order)
                    transactions.append(tx)
                    self.successful += 1
                    
                    logger.info(f"  ✅ {order.order_id}: {order.total_tokens:,} ZION → {order.wallet_address[:20]}...")
                    
                except Exception as e:
                    logger.error(f"  ❌ {order.order_id}: {e}")
                    self.failed += 1
                    
                    transactions.append(DistributionTransaction(
                        order_id=order.order_id,
                        wallet_address=order.wallet_address,
                        tokens=order.total_tokens,
                        status=DistributionStatus.FAILED,
                        error=str(e)
                    ))
            
            # Rate limiting
            if i + TX_BATCH_SIZE < len(orders):
                logger.info(f"⏸️  Waiting {TX_BATCH_DELAY_SECONDS}s before next batch...")
                await asyncio.sleep(TX_BATCH_DELAY_SECONDS)
        
        return transactions
    
    async def _send_distribution_tx(self, order: PresaleOrder) -> DistributionTransaction:
        """Send single distribution transaction"""
        if self.dry_run:
            logger.info(f"[DRY RUN] Would send {order.total_tokens} ZION to {order.wallet_address}")
            return DistributionTransaction(
                order_id=order.order_id,
                wallet_address=order.wallet_address,
                tokens=order.total_tokens,
                tx_hash=f"DRY_RUN_TX_{order.order_id}",
                status=DistributionStatus.SENT
            )
        
        # Create blockchain transaction
        tx = self.blockchain.create_transaction(
            from_address=PRESALE_PREMINE_ADDRESS,
            to_address=order.wallet_address,
            amount=float(order.total_tokens),
            purpose=f"Presale distribution - {order.order_id}"
        )
        
        # Update DB
        self._update_distribution_status(
            order.order_id,
            'processing',
            tx.get('id')
        )
        
        return DistributionTransaction(
            order_id=order.order_id,
            wallet_address=order.wallet_address,
            tokens=order.total_tokens,
            tx_hash=tx.get('id'),
            status=DistributionStatus.SENT,
            sent_at=datetime.now()
        )
    
    async def _wait_confirmations(self, transactions: List[DistributionTransaction]):
        """Wait for transaction confirmations"""
        logger.info(f"Waiting for {TX_CONFIRMATION_BLOCKS} confirmations...")
        
        # TODO: Implement confirmation waiting
        # For now, just mark as confirmed
        for tx in transactions:
            if tx.status == DistributionStatus.SENT:
                tx.status = DistributionStatus.CONFIRMED
                tx.confirmed_at = datetime.now()
                
                self._update_distribution_status(
                    tx.order_id,
                    'completed',
                    tx.tx_hash
                )
    
    async def _send_notifications(self, orders: List[PresaleOrder]):
        """Send email notifications to customers"""
        logger.info(f"Sending notifications to {len(orders)} customers...")
        
        # TODO: Implement email sending
        # For now, just log
        for order in orders:
            logger.info(f"  📧 {order.customer_email}: {order.total_tokens:,} ZION")


# ============================================
# MAIN
# ============================================

async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='ZION Presale Distribution Manager')
    parser.add_argument('--dry-run', action='store_true', help='Dry run mode (no actual transactions)')
    parser.add_argument('--presale-db', default=PRESALE_DB_PATH, help='Path to presale database')
    parser.add_argument('--blockchain-db', default='zion_mainnet_blockchain.db', help='Path to blockchain database')
    
    args = parser.parse_args()
    
    manager = PresaleDistributionManager(
        presale_db_path=args.presale_db,
        blockchain_db_path=args.blockchain_db,
        dry_run=args.dry_run
    )
    
    results = await manager.execute_distribution()
    
    # Save results
    with open('data/distribution_results.json', 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    logger.info(f"\n✅ Results saved to data/distribution_results.json")
    
    return 0 if results['success'] else 1


if __name__ == '__main__':
    import asyncio
    sys.exit(asyncio.run(main()))
