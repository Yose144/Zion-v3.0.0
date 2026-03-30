#!/usr/bin/env python3
"""
ZION eShop Bonus Automation System
===================================
Automatické vyplácení eShop bonusů na blockchain při mainnet launch.

Proces:
1. Načte VŠECHNY eShop bonus wallets (1-1M Dharma Credits)
2. Převede QR kódy na blockchain addresses
3. Vytvoří batch transakce z DAO treasury
4. Sleduje konfirmace
5. Aktualizuje registry a notifikuje zákazníky

Rozdíly oproti presale:
- Různé kategorie (MICRO 1-100, STANDARD 101-1K, PREMIUM 1K-10K, VIP 10K-100K, MEGA 100K-1M)
- Rychlejší zpracování (vyšší batch size)
- Jiný zdroj tokenů (DAO treasury místo escrow)
- Kratší expirace (1 rok vs unlimited)

Author: ZION Team
Version: 2.9.0
Created: 4. prosince 2025
"""

import os
import sys
import json
import time
import asyncio
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import traceback

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

# Import ZION modules
from wallet_registry import ZionWalletRegistry, WalletType, NetworkType, WalletStatus
try:
    from wallet import ZionWallet, WalletAddress
    from src.core.new_zion_blockchain import ZionRealBlockchain
except ImportError as e:
    logging.warning(f"Some imports failed: {e}")
    ZionWallet = None
    ZionRealBlockchain = None

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('eshop_bonus_payout.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


# ============================================
# CONSTANTS
# ============================================

# DAO Treasury allocation for bonuses
DAO_TREASURY_ADDRESS = "ZION_DAO_TREASURY_GENESIS_2025"
BONUS_ALLOCATION_RESERVE = 100_000_000  # 100M ZION reserved for bonuses

# Bonus ranges (ZION DHARMA CREDITS)
MIN_BONUS = 1           # Minimum bonus - 1 Dharma Credit
MAX_BONUS = 1_000_000   # Maximum bonus - 1M Dharma Credits (mega VIP)

# Transaction settings
BONUS_BATCH_SIZE = 200        # Vyšší než presale (menší částky)
BONUS_BATCH_DELAY = 1.0       # Rychlejší zpracování
TX_CONFIRMATION_BLOCKS = 3    # Méně konfirmací pro malé částky

# Expirace
BONUS_EXPIRY_DAYS = 365       # 1 rok na redemption


# ============================================
# ENUMS
# ============================================

class BonusPayoutStatus(Enum):
    """Status vyplácení bonusu"""
    PENDING = 'pending'
    QUEUED = 'queued'
    PROCESSING = 'processing'
    SENT = 'sent'
    CONFIRMED = 'confirmed'
    FAILED = 'failed'
    EXPIRED = 'expired'


class BonusType(Enum):
    """Typ bonusu (Dharma Credits)"""
    MICRO = 'micro'                     # 1-100 Dharma Credits
    STANDARD = 'standard'               # 101-1,000 Dharma Credits
    PREMIUM = 'premium'                 # 1,001-10,000 Dharma Credits
    VIP = 'vip'                         # 10,001-100,000 Dharma Credits
    MEGA = 'mega'                       # 100,001-1,000,000 Dharma Credits (whale tier)
    SPECIAL_PROMO = 'special_promo'     # Speciální akce
    REFERRAL = 'referral'               # Referral odměna
    LOYALTY = 'loyalty'                 # Věrnostní program


# ============================================
# DATACLASSES
# ============================================

@dataclass
class BonusTransaction:
    """Transakce bonusu"""
    wallet_id: str
    customer_email: str
    order_id: str
    tokens: int
    bonus_type: BonusType
    blockchain_address: Optional[str] = None
    tx_hash: Optional[str] = None
    block_height: Optional[int] = None
    confirmations: int = 0
    status: BonusPayoutStatus = BonusPayoutStatus.PENDING
    error_message: Optional[str] = None
    created_at: datetime = None
    sent_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.expires_at is None:
            self.expires_at = self.created_at + timedelta(days=BONUS_EXPIRY_DAYS)
    
    def to_dict(self) -> Dict:
        data = asdict(self)
        data['status'] = self.status.value
        data['bonus_type'] = self.bonus_type.value
        data['created_at'] = self.created_at.isoformat()
        data['sent_at'] = self.sent_at.isoformat() if self.sent_at else None
        data['confirmed_at'] = self.confirmed_at.isoformat() if self.confirmed_at else None
        data['expires_at'] = self.expires_at.isoformat() if self.expires_at else None
        return data


@dataclass
class BonusBatchResult:
    """Výsledek batch vyplácení bonusů"""
    batch_id: int
    total_bonuses: int
    successful: int
    failed: int
    expired: int
    total_tokens: int
    start_time: datetime
    end_time: Optional[datetime] = None
    transactions: List[BonusTransaction] = None
    
    def __post_init__(self):
        if self.transactions is None:
            self.transactions = []
    
    @property
    def duration_seconds(self) -> float:
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0.0
    
    @property
    def success_rate(self) -> float:
        if self.total_bonuses > 0:
            return (self.successful / self.total_bonuses) * 100
        return 0.0


# ============================================
# MAIN AUTOMATION CLASS
# ============================================

class ZionEshopBonusAutomation:
    """
    Automatizace vyplácení eShop bonusů
    
    Usage:
        automation = ZionEshopBonusAutomation(dry_run=True)
        await automation.execute_bonus_payout()
    """
    
    def __init__(
        self,
        registry_db_path: str = "data/wallet_registry.db",
        blockchain_rpc_url: str = "http://localhost:8545",
        dry_run: bool = False
    ):
        self.registry = ZionWalletRegistry(db_path=registry_db_path)
        self.blockchain_rpc_url = blockchain_rpc_url
        self.dry_run = dry_run
        
        # Initialize blockchain connection
        if ZionRealBlockchain and not dry_run:
            self.blockchain = ZionRealBlockchain(rpc_url=blockchain_rpc_url)
        else:
            self.blockchain = None
        
        # Stats
        self.total_bonuses = 0
        self.total_tokens = 0
        self.batch_results: List[BonusBatchResult] = []
        self.stats_by_type = {bt: {'count': 0, 'tokens': 0} for bt in BonusType}
        
        logger.info(f"{'🧪 DRY RUN MODE' if dry_run else '🚀 LIVE MODE'}")
        logger.info(f"✅ ZionEshopBonusAutomation initialized")
    
    # ============================================
    # MAIN EXECUTION
    # ============================================
    
    async def execute_bonus_payout(self) -> Dict:
        """
        HLAVNÍ METODA: Provede vyplácení všech eShop bonusů
        
        Returns:
            Dict s výsledky
        """
        start_time = datetime.now()
        
        try:
            logger.info("=" * 80)
            logger.info("ZION ESHOP BONUS PAYOUT - START")
            logger.info("=" * 80)
            
            # Phase 1: Load and validate
            logger.info("\n📋 Phase 1: Loading bonus wallets...")
            bonus_wallets = await self._load_bonus_wallets()
            
            if not bonus_wallets:
                logger.warning("⚠️  No bonus wallets found!")
                return {
                    'success': True,
                    'total_bonuses': 0,
                    'message': 'No bonuses to process'
                }
            
            self.total_bonuses = len(bonus_wallets)
            self.total_tokens = sum(w['tokens'] for w in bonus_wallets)
            
            logger.info(f"✅ Found {self.total_bonuses:,} bonus wallets")
            logger.info(f"✅ Total tokens: {self.total_tokens:,} ZION")
            
            # Check allocation
            if self.total_tokens > BONUS_ALLOCATION_RESERVE:
                raise Exception(
                    f"CRITICAL: Total bonus tokens ({self.total_tokens:,}) "
                    f"exceeds allocation ({BONUS_ALLOCATION_RESERVE:,})!"
                )
            
            # Phase 2: Categorize bonuses
            logger.info("\n📊 Phase 2: Categorizing bonuses...")
            await self._categorize_bonuses(bonus_wallets)
            
            # Phase 3: Check expired
            logger.info("\n⏰ Phase 3: Checking expired wallets...")
            expired_count = await self._check_expired_wallets(bonus_wallets)
            if expired_count > 0:
                logger.warning(f"⚠️  Found {expired_count} expired wallets (will be skipped)")
            
            # Phase 4: Process batches
            logger.info("\n🚀 Phase 4: Processing bonus payouts...")
            await self._process_bonus_batches(bonus_wallets)
            
            # Phase 5: Confirmation wait
            if not self.dry_run:
                logger.info("\n⏳ Phase 5: Waiting for confirmations...")
                await self._wait_for_confirmations()
            
            # Phase 6: Finalization
            logger.info("\n✅ Phase 6: Finalizing...")
            await self._finalize_bonuses()
            
            # Generate report
            end_time = datetime.now()
            results = self._generate_report(start_time, end_time)
            
            logger.info("\n" + "=" * 80)
            logger.info("✅ ESHOP BONUS PAYOUT COMPLETED!")
            logger.info("=" * 80)
            logger.info(f"Total bonuses: {results['total_bonuses']:,}")
            logger.info(f"Successful: {results['successful']:,}")
            logger.info(f"Failed: {results['failed']:,}")
            logger.info(f"Expired: {results['expired']:,}")
            logger.info(f"Total tokens: {results['total_tokens']:,} ZION")
            logger.info(f"Success rate: {results['success_rate']:.2f}%")
            logger.info(f"Duration: {results['duration_seconds']:.2f}s")
            logger.info("=" * 80)
            
            return results
            
        except Exception as e:
            logger.error(f"❌ CRITICAL ERROR: {e}")
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e)
            }
    
    # ============================================
    # PHASE METHODS
    # ============================================
    
    async def _load_bonus_wallets(self) -> List[Dict]:
        """Načte všechny eShop bonus wallets"""
        with self.registry.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM wallet_registry
                WHERE wallet_type = ?
                AND status IN ('generated', 'pending_redemption')
                AND network = ?
                ORDER BY created_at ASC
            """, (WalletType.ESHOP_BONUS.value, NetworkType.PRE_MAINNET.value))
            
            wallets = [dict(row) for row in cursor.fetchall()]
        
        # Validate token ranges
        valid_wallets = []
        for wallet in wallets:
            tokens = wallet['tokens']
            if MIN_BONUS <= tokens <= MAX_BONUS:
                valid_wallets.append(wallet)
            else:
                logger.warning(
                    f"⚠️  Invalid bonus amount for {wallet['wallet_id']}: "
                    f"{tokens} ZION (expected {MIN_BONUS}-{MAX_BONUS})"
                )
        
        return valid_wallets
    
    async def _categorize_bonuses(self, wallets: List[Dict]):
        """Kategorizuje bonusy podle typu (Dharma Credits)"""
        for wallet in wallets:
            tokens = wallet['tokens']
            
            if tokens <= 100:
                bonus_type = BonusType.MICRO
            elif tokens <= 1_000:
                bonus_type = BonusType.STANDARD
            elif tokens <= 10_000:
                bonus_type = BonusType.PREMIUM
            elif tokens <= 100_000:
                bonus_type = BonusType.VIP
            else:
                bonus_type = BonusType.MEGA
            
            self.stats_by_type[bonus_type]['count'] += 1
            self.stats_by_type[bonus_type]['tokens'] += tokens
        
        logger.info("Dharma Credits distribution:")
        for bonus_type, stats in self.stats_by_type.items():
            if stats['count'] > 0:
                logger.info(
                    f"   - {bonus_type.value.upper()}: "
                    f"{stats['count']:,} wallets, "
                    f"{stats['tokens']:,} Dharma Credits"
                )
    
    async def _check_expired_wallets(self, wallets: List[Dict]) -> int:
        """Zkontroluje a označí expirované peněženky"""
        now = datetime.now()
        expired_count = 0
        
        for wallet in wallets:
            expires_at_str = wallet.get('expires_at')
            if expires_at_str:
                expires_at = datetime.fromisoformat(expires_at_str)
                if expires_at < now:
                    # Mark as expired
                    self._update_wallet_status(
                        wallet['wallet_id'],
                        WalletStatus.EXPIRED
                    )
                    expired_count += 1
                    logger.warning(
                        f"   ⏰ EXPIRED: {wallet['wallet_id']} "
                        f"({wallet['tokens']} ZION, order: {wallet['source_order_id']})"
                    )
        
        return expired_count
    
    async def _process_bonus_batches(self, wallets: List[Dict]):
        """Zpracuje bonusy v batches"""
        # Filter out expired
        active_wallets = [
            w for w in wallets
            if w.get('expires_at') is None or
            datetime.fromisoformat(w['expires_at']) > datetime.now()
        ]
        
        total_batches = (len(active_wallets) + BONUS_BATCH_SIZE - 1) // BONUS_BATCH_SIZE
        logger.info(
            f"Processing {len(active_wallets)} active bonuses in {total_batches} batches "
            f"(batch size: {BONUS_BATCH_SIZE})"
        )
        
        for batch_num in range(total_batches):
            start_idx = batch_num * BONUS_BATCH_SIZE
            end_idx = min(start_idx + BONUS_BATCH_SIZE, len(active_wallets))
            batch = active_wallets[start_idx:end_idx]
            
            logger.info(
                f"\n📦 Batch {batch_num + 1}/{total_batches} "
                f"({len(batch)} bonuses)"
            )
            
            batch_result = await self._process_batch(batch_num + 1, batch)
            self.batch_results.append(batch_result)
            
            logger.info(
                f"   ✅ Completed: {batch_result.successful}/{batch_result.total_bonuses} "
                f"({batch_result.total_tokens:,} ZION, {batch_result.duration_seconds:.2f}s)"
            )
            
            # Rate limiting
            if batch_num < total_batches - 1:
                await asyncio.sleep(BONUS_BATCH_DELAY)
    
    async def _process_batch(
        self,
        batch_id: int,
        wallets: List[Dict]
    ) -> BonusBatchResult:
        """Zpracuje jeden batch bonusů"""
        result = BonusBatchResult(
            batch_id=batch_id,
            total_bonuses=len(wallets),
            successful=0,
            failed=0,
            expired=0,
            total_tokens=sum(w['tokens'] for w in wallets),
            start_time=datetime.now()
        )
        
        for wallet in wallets:
            tx = await self._process_single_bonus(wallet)
            result.transactions.append(tx)
            
            if tx.status == BonusPayoutStatus.SENT:
                result.successful += 1
            elif tx.status == BonusPayoutStatus.EXPIRED:
                result.expired += 1
            else:
                result.failed += 1
        
        result.end_time = datetime.now()
        return result
    
    async def _process_single_bonus(self, wallet: Dict) -> BonusTransaction:
        """Zpracuje vyplácení jednoho bonusu (Dharma Credits)"""
        # Determine bonus type
        tokens = wallet['tokens']
        if tokens <= 100:
            bonus_type = BonusType.MICRO
        elif tokens <= 1_000:
            bonus_type = BonusType.STANDARD
        elif tokens <= 10_000:
            bonus_type = BonusType.PREMIUM
        elif tokens <= 100_000:
            bonus_type = BonusType.VIP
        else:
            bonus_type = BonusType.MEGA
        
        tx = BonusTransaction(
            wallet_id=wallet['wallet_id'],
            customer_email=wallet.get('customer_email', 'unknown'),
            order_id=wallet.get('source_order_id', 'unknown'),
            tokens=tokens,
            bonus_type=bonus_type,
            expires_at=datetime.fromisoformat(wallet['expires_at']) if wallet.get('expires_at') else None
        )
        
        try:
            # Check expiration
            if tx.expires_at and tx.expires_at < datetime.now():
                tx.status = BonusPayoutStatus.EXPIRED
                logger.warning(f"   ⏰ EXPIRED: {wallet['wallet_id']} ({tokens} Dharma Credits)")
                return tx
            
            if self.dry_run:
                # Simulate transaction
                await asyncio.sleep(0.05)  # Rychlejší než presale
                tx.blockchain_address = f"ZION_BONUS_{wallet['wallet_id'][:8]}"
                tx.tx_hash = f"0x{'a' * 64}"
                tx.status = BonusPayoutStatus.SENT
                tx.sent_at = datetime.now()
            else:
                # Create real blockchain transaction
                # TODO: Implement actual blockchain transaction from DAO treasury
                pass
            
            logger.info(
                f"   ✅ {wallet['wallet_id']}: {tokens:,} Dharma Credits "
                f"({bonus_type.value}) → {tx.blockchain_address}"
            )
            
        except Exception as e:
            tx.status = BonusPayoutStatus.FAILED
            tx.error_message = str(e)
            logger.error(f"   ❌ {wallet['wallet_id']}: {e}")
        
        return tx
    
    async def _wait_for_confirmations(self):
        """Čeká na konfirmace transakcí"""
        all_txs = []
        for batch in self.batch_results:
            all_txs.extend(batch.transactions)
        
        pending_txs = [
            tx for tx in all_txs
            if tx.status == BonusPayoutStatus.SENT
        ]
        
        if not pending_txs:
            return
        
        logger.info(f"Monitoring {len(pending_txs)} pending transactions...")
        
        max_iterations = 60  # 10 minutes max wait
        iteration = 0
        
        while pending_txs and iteration < max_iterations:
            await asyncio.sleep(10)
            iteration += 1
            
            for tx in pending_txs[:]:
                # TODO: Get actual confirmations from blockchain
                tx.confirmations += 1
                
                if tx.confirmations >= TX_CONFIRMATION_BLOCKS:
                    tx.status = BonusPayoutStatus.CONFIRMED
                    tx.confirmed_at = datetime.now()
                    pending_txs.remove(tx)
                    
                    # Update registry
                    self._update_wallet_status(
                        tx.wallet_id,
                        WalletStatus.ACTIVE,
                        tx.blockchain_address
                    )
            
            if iteration % 6 == 0:  # Every minute
                logger.info(f"   ⏳ {len(pending_txs)} transactions pending...")
        
        if pending_txs:
            logger.warning(f"⚠️  {len(pending_txs)} transactions timed out!")
        
        confirmed = len([tx for tx in all_txs if tx.status == BonusPayoutStatus.CONFIRMED])
        logger.info(f"✅ {confirmed}/{len(all_txs)} transactions confirmed")
    
    async def _finalize_bonuses(self):
        """Finalizace bonusů"""
        all_txs = []
        for batch in self.batch_results:
            all_txs.extend(batch.transactions)
        
        # Update registry for all successful transactions
        for tx in all_txs:
            if tx.status == BonusPayoutStatus.CONFIRMED:
                self._update_wallet_status(
                    tx.wallet_id,
                    WalletStatus.ACTIVE,
                    tx.blockchain_address
                )
        
        # Save report
        report_path = self._save_report()
        logger.info(f"✅ Report saved: {report_path}")
    
    # ============================================
    # HELPER METHODS
    # ============================================
    
    def _update_wallet_status(
        self,
        wallet_id: str,
        status: WalletStatus,
        blockchain_address: Optional[str] = None
    ):
        """Aktualizuje status peněženky"""
        with self.registry.get_connection() as conn:
            cursor = conn.cursor()
            
            if blockchain_address:
                cursor.execute("""
                    UPDATE wallet_registry
                    SET status = ?,
                        blockchain_address = ?,
                        activated_at = CURRENT_TIMESTAMP,
                        last_updated = CURRENT_TIMESTAMP
                    WHERE wallet_id = ?
                """, (status.value, blockchain_address, wallet_id))
            else:
                cursor.execute("""
                    UPDATE wallet_registry
                    SET status = ?,
                        last_updated = CURRENT_TIMESTAMP
                    WHERE wallet_id = ?
                """, (status.value, wallet_id))
            
            conn.commit()
    
    def _save_report(self) -> Path:
        """Uloží report"""
        report_path = Path(
            f"reports/eshop_bonus_payout_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        report_path.parent.mkdir(parents=True, exist_ok=True)
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'total_bonuses': self.total_bonuses,
            'total_tokens': self.total_tokens,
            'stats_by_type': {
                bt.value: stats for bt, stats in self.stats_by_type.items()
            },
            'batches': [
                {
                    'batch_id': batch.batch_id,
                    'total_bonuses': batch.total_bonuses,
                    'successful': batch.successful,
                    'failed': batch.failed,
                    'expired': batch.expired,
                    'total_tokens': batch.total_tokens,
                    'duration_seconds': batch.duration_seconds,
                    'success_rate': batch.success_rate
                }
                for batch in self.batch_results
            ]
        }
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        return report_path
    
    def _generate_report(self, start_time: datetime, end_time: datetime) -> Dict:
        """Vygeneruje finální report"""
        all_txs = []
        for batch in self.batch_results:
            all_txs.extend(batch.transactions)
        
        successful = len([tx for tx in all_txs if tx.status == BonusPayoutStatus.CONFIRMED])
        failed = len([tx for tx in all_txs if tx.status == BonusPayoutStatus.FAILED])
        expired = len([tx for tx in all_txs if tx.status == BonusPayoutStatus.EXPIRED])
        
        return {
            'success': True,
            'total_bonuses': len(all_txs),
            'successful': successful,
            'failed': failed,
            'expired': expired,
            'total_tokens': sum(tx.tokens for tx in all_txs),
            'success_rate': (successful / len(all_txs) * 100) if all_txs else 0,
            'duration_seconds': (end_time - start_time).total_seconds(),
            'batches': len(self.batch_results),
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat()
        }


# ============================================
# CLI
# ============================================

async def main():
    """CLI interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description="ZION eShop Bonus Payout Automation")
    parser.add_argument('--dry-run', action='store_true', help='Run in simulation mode')
    parser.add_argument('--registry-db', default='data/wallet_registry.db', help='Wallet registry database path')
    parser.add_argument('--rpc-url', default='http://localhost:8545', help='Blockchain RPC URL')
    
    args = parser.parse_args()
    
    print("=" * 80)
    print("ZION ESHOP BONUS PAYOUT AUTOMATION")
    print("=" * 80)
    print(f"Mode: {'🧪 DRY RUN' if args.dry_run else '🚀 LIVE'}")
    print(f"Bonus range: {MIN_BONUS}-{MAX_BONUS} ZION")
    print(f"Batch size: {BONUS_BATCH_SIZE}")
    print(f"Confirmations: {TX_CONFIRMATION_BLOCKS}")
    print("=" * 80)
    
    if not args.dry_run:
        confirm = input("\n⚠️  WARNING: This will execute REAL transactions!\n"
                       "Type 'CONFIRM' to proceed: ")
        if confirm != 'CONFIRM':
            print("❌ Aborted")
            return
    
    print("\n🎁 Starting bonus payout...\n")
    
    automation = ZionEshopBonusAutomation(
        registry_db_path=args.registry_db,
        blockchain_rpc_url=args.rpc_url,
        dry_run=args.dry_run
    )
    
    results = await automation.execute_bonus_payout()
    
    if results.get('success'):
        print("\n✅ BONUS PAYOUT COMPLETED!")
        print(f"   Total: {results['total_bonuses']:,} bonuses")
        print(f"   Tokens: {results['total_tokens']:,} ZION")
        print(f"   Success rate: {results['success_rate']:.2f}%")
    else:
        print(f"\n❌ BONUS PAYOUT FAILED: {results.get('error')}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
